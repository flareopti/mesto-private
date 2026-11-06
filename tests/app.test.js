import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const select = (selector) => document.querySelector(selector);
const calls = [];
const user = { _id: 'me', name: 'Иван Лебедев', about: 'Путешественник', avatar: 'https://example.com/avatar.jpg' };
const other = { _id: 'other', name: '<img src=x onerror=alert(1)>' };
const makeCard = (id, owner = user) => ({
  _id: id, name: 'Камчатка', link: 'https://example.com/photo.jpg',
  owner: { ...owner }, likes: [{ ...user }], createdAt: '2026-11-06T12:00:00.000Z',
});
let cards = [makeCard('own'), makeCard('foreign', other)];
let failure = null;
let releaseRequest = null;
let holdNextRequest = false;
const originalConsoleError = console.error;
const loggedErrors = [];
console.error = (error) => loggedErrors.push(error);

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname.replace('/v1/apf-cohort-203', '');
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ path, method, body, headers: options.headers });
  if (holdNextRequest) {
    holdNextRequest = false;
    await new Promise((resolve) => { releaseRequest = resolve; });
  }
  if (failure) {
    const status = failure;
    failure = null;
    return { ok: false, status, json: async () => ({}) };
  }
  let result;
  if (path === '/users/me') {
    if (method === 'PATCH') Object.assign(user, body);
    result = user;
  } else if (path === '/users/me/avatar') {
    Object.assign(user, body);
    result = user;
  } else if (path.startsWith('/cards/likes/')) {
    result = cards.find((card) => card._id === path.split('/').at(-1));
    result.likes = method === 'DELETE' ? [] : [{ ...user }];
  } else if (path === '/cards' && method === 'POST') {
    result = { ...makeCard(`created-${calls.length}`), ...body, likes: [] };
    cards.unshift(result);
  } else if (method === 'DELETE') {
    cards = cards.filter((card) => card._id !== path.split('/').at(-1));
    result = { message: 'Пост удалён' };
  } else if (path === '/cards') result = cards;
  else throw new Error(`Unexpected route ${method} ${path}`);
  return { ok: true, status: 200, json: async () => structuredClone(result) };
};

const waitFor = async (condition) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail('UI did not reach expected state');
};
const fill = (selector, value) => {
  const input = select(selector);
  input.value = value;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const submit = (selector) => select(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
const close = (selector) => select(`${selector} .popup__close`).click();
const countCalls = (path, method = 'GET') => calls.filter((call) => call.path === path && call.method === method).length;

await import('../src/scripts/index.js');

await test('Initial data comes from API; only own cards have a delete button', async () => {
  await waitFor(() => document.querySelectorAll('.card').length === 2);
  assert.equal(select('.profile__title').textContent, user.name);
  assert.equal(select('.profile__add-button').disabled, false);
  assert.equal(countCalls('/cards'), 1);
  assert.equal(countCalls('/users/me'), 1);
  assert.ok(select('[data-card-id="own"] .card__control-button_type_delete'));
  assert.equal(select('[data-card-id="foreign"] .card__control-button_type_delete'), null);
  assert.equal(select('[data-card-id="own"] .card__like-count').textContent, '1');
  assert.equal(select('[data-card-id="own"] .card__like-button').getAttribute('aria-pressed'), 'true');
});

await test('Profile opens with current values and remains disabled until a valid change', () => {
  select('.profile__edit-button').click();
  assert.equal(select('#user-name').value, user.name);
  assert.equal(select('.popup_type_edit .popup__button').disabled, true);
  fill('#user-name', 'А');
  assert.equal(select('.popup_type_edit .popup__button').disabled, true);
  assert.match(select('#user-name-error').textContent, /не менее 2/);
  fill('#user-name', 'А'.repeat(41));
  assert.equal(select('.popup_type_edit .popup__button').disabled, true);
  fill('#user-name', 'Иван123');
  assert.equal(select('#user-name').validity.valid, false);
  assert.match(select('#user-name-error').textContent, /Разрешены/);
  fill('#user-name', 'Анна-Мария');
  assert.equal(select('.popup_type_edit .popup__button').disabled, false);
  fill('#user-name', user.name);
  assert.equal(select('.popup_type_edit .popup__button').disabled, true);
});

await test('Failed profile save preserves the form and page; retry updates after response', async () => {
  fill('#user-name', 'Анна-Мария');
  failure = 500;
  submit('.popup_type_edit form');
  assert.equal(select('.popup_type_edit .popup__button').textContent, 'Сохранение…');
  assert.equal(select('.profile__title').textContent, 'Иван Лебедев');
  await waitFor(() => select('.popup_type_edit form').dataset.pending === 'false');
  assert.ok(select('.popup_type_edit').classList.contains('popup_is-opened'));
  assert.equal(select('#user-name').value, 'Анна-Мария');
  assert.ok(select('.popup_type_edit .popup__request-error').textContent);
  submit('.popup_type_edit form');
  await waitFor(() => !select('.popup_type_edit').classList.contains('popup_is-opened'));
  assert.equal(select('.profile__title').textContent, 'Анна-Мария');
});

await test('Avatar URL validation and reset on reopening', async () => {
  select('.profile__image').click();
  assert.equal(select('#user-avatar').value, '');
  fill('#user-avatar', 'invalid');
  assert.equal(select('.popup_type_edit-avatar .popup__button').disabled, true);
  close('.popup_type_edit-avatar');
  select('.profile__image').click();
  assert.equal(select('#user-avatar-error').textContent, '');
  assert.equal(select('#user-avatar').value, '');
  fill('#user-avatar', 'https://example.com/new-avatar.jpg');
  submit('.popup_type_edit-avatar form');
  await waitFor(() => !select('.popup_type_edit-avatar').classList.contains('popup_is-opened'));
  assert.match(select('.profile__image').style.backgroundImage, /new-avatar/);
});

await test('Card creation waits for server and prevents duplicate submissions', async () => {
  select('.profile__add-button').click();
  fill('#place-name', 'Алтай');
  fill('#place-link', 'https://example.com/altai.jpg');
  const previousCount = document.querySelectorAll('.card').length;
  holdNextRequest = true;
  submit('.popup_type_new-card form');
  submit('.popup_type_new-card form');
  assert.equal(document.querySelectorAll('.card').length, previousCount);
  assert.equal(select('.popup_type_new-card .popup__button').textContent, 'Создание…');
  releaseRequest();
  await waitFor(() => document.querySelectorAll('.card').length === previousCount + 1);
  assert.equal(select('.card__title').textContent, 'Алтай');
  assert.equal(countCalls('/cards', 'POST'), 1);
});

await test('Like removal and failures only change the card after success', async () => {
  const card = select('[data-card-id="own"]');
  const button = card.querySelector('.card__like-button');
  button.click();
  await waitFor(() => !button.disabled);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(card.querySelector('.card__like-count').textContent, '0');
  assert.equal(countCalls('/cards/likes/own', 'DELETE'), 1);
  failure = 503;
  button.click();
  await waitFor(() => !button.disabled);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  button.click();
  await waitFor(() => !button.disabled);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
});

await test('Info reloads cards every time, uses templates, formats dates and escapes names', async () => {
  cards.find((card) => card._id === 'foreign').likes = [{ ...other }];
  const before = countCalls('/cards');
  select('[data-card-id="foreign"] .card__control-button_type_info').click();
  await waitFor(() => select('.popup_type_info').classList.contains('popup_is-opened'));
  assert.equal(countCalls('/cards'), before + 1);
  assert.match(select('.popup__info').textContent, /6 ноября 2026/);
  assert.equal(select('.popup__list-item').textContent, other.name);
  assert.equal(select('.popup__list-item img'), null);
  close('.popup_type_info');
  cards.find((card) => card._id === 'foreign').likes = [];
  select('[data-card-id="foreign"] .card__control-button_type_info').click();
  await waitFor(() => select('.popup_type_info').classList.contains('popup_is-opened'));
  assert.equal(countCalls('/cards'), before + 2);
  assert.equal(document.querySelectorAll('.popup__info-item').length, 3);
  assert.equal(document.querySelectorAll('.popup__list-item').length, 0);
  assert.equal(select('.popup_type_info .popup__text').textContent, 'Пока нет лайков');
  close('.popup_type_info');
});

await test('Image opens from keyboard; Escape and overlay close modal', () => {
  const image = select('[data-card-id="own"] .card__image');
  image.focus();
  image.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok(select('.popup_type_image').classList.contains('popup_is-opened'));
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.ok(!select('.popup_type_image').classList.contains('popup_is-opened'));
  assert.equal(document.activeElement, image);
  image.click();
  select('.popup_type_image').click();
  assert.ok(!select('.popup_type_image').classList.contains('popup_is-opened'));
});

await test('Delete cancel sends no request; failed deletion retains card; retry removes it', async () => {
  const selector = '[data-card-id="own"]';
  select(`${selector} .card__control-button_type_delete`).click();
  close('.popup_type_remove-card');
  assert.equal(countCalls('/cards/own', 'DELETE'), 0);
  select(`${selector} .card__control-button_type_delete`).click();
  failure = 500;
  submit('.popup_type_remove-card form');
  await waitFor(() => select('.popup_type_remove-card form').dataset.pending === 'false');
  assert.ok(select(selector));
  submit('.popup_type_remove-card form');
  await waitFor(() => !select(selector));
  assert.equal(countCalls('/cards/own', 'DELETE'), 2);
});

await test('New card form clears previous values and validation errors', () => {
  select('.profile__add-button').click();
  assert.equal(select('#place-name').value, '');
  fill('#place-name', '<script>');
  assert.ok(select('#place-name-error').textContent);
  close('.popup_type_new-card');
  select('.profile__add-button').click();
  assert.equal(select('#place-name-error').textContent, '');
  assert.equal(select('.popup_type_new-card .popup__button').disabled, true);
  close('.popup_type_new-card');
});

await test('API uses JSON headers; all simulated failures are handled', () => {
  assert.ok(calls.every((call) => call.headers['Content-Type'] === 'application/json'));
  assert.ok(loggedErrors.some((error) => /500/.test(error.message)));
  assert.ok(loggedErrors.some((error) => /503/.test(error.message)));
});

console.error = originalConsoleError;
dom.window.close();
