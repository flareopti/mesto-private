import { createCardElement, deleteCard, updateCardLikes } from './components/card.js';
import { openModalWindow, closeModalWindow, setCloseModalWindowEventListeners } from './components/modal.js';
import { enableValidation, clearValidation } from './components/validation.js';
import { getUserInfo, getCardList, setUserInfo, setUserAvatar, addCard, removeCard, changeLikeCardStatus } from './components/api.js';

const imagePlaceholder = new URL('../images/image-unavailable.svg', import.meta.url).href;

const validationSettings = {
  formSelector: '.popup__form:not([name="remove-card"])',
  inputSelector: '.popup__input',
  submitButtonSelector: '.popup__button',
  inactiveButtonClass: 'popup__button_disabled',
  inputErrorClass: 'popup__input_type_error',
  errorClass: 'popup__error_visible',
};
const placesWrap = document.querySelector('.places__list');
const pageStatus = document.querySelector('.page__status');
const retryButton = document.querySelector('.page__retry');
const notification = document.querySelector('.page__notification');
const profileTitle = document.querySelector('.profile__title');
const profileDescription = document.querySelector('.profile__description');
const profileAvatar = document.querySelector('.profile__image');
const openProfileFormButton = document.querySelector('.profile__edit-button');
const openCardFormButton = document.querySelector('.profile__add-button');
const profilePopup = document.querySelector('.popup_type_edit');
const profileForm = profilePopup.querySelector('.popup__form');
const profileTitleInput = profileForm.querySelector('.popup__input_type_name');
const profileDescriptionInput = profileForm.querySelector('.popup__input_type_description');
const cardPopup = document.querySelector('.popup_type_new-card');
const cardForm = cardPopup.querySelector('.popup__form');
const cardNameInput = cardForm.querySelector('.popup__input_type_card-name');
const cardLinkInput = cardForm.querySelector('.popup__input_type_url');
const avatarPopup = document.querySelector('.popup_type_edit-avatar');
const avatarForm = avatarPopup.querySelector('.popup__form');
const avatarInput = avatarForm.querySelector('.popup__input');
const imagePopup = document.querySelector('.popup_type_image');
const imageElement = imagePopup.querySelector('.popup__image');
const imageCaption = imagePopup.querySelector('.popup__caption');
const removePopup = document.querySelector('.popup_type_remove-card');
const removeForm = removePopup.querySelector('.popup__form');
const infoPopup = document.querySelector('.popup_type_info');
const infoTitle = infoPopup.querySelector('.popup__title');
const infoList = infoPopup.querySelector('.popup__info');
const infoLikesTitle = infoPopup.querySelector('.popup__text');
const infoUsersList = infoPopup.querySelector('.popup__list');
const definitionTemplate = document.querySelector('#popup-info-definition-template');
const userPreviewTemplate = document.querySelector('#popup-info-user-preview-template');
let userId = '';
let pendingDeletion = null;
let infoRequestId = 0;
let notificationTimeout;

const showError = (error) => {
  console.error(error);
  notification.textContent = 'Не удалось выполнить запрос. Проверьте соединение и попробуйте ещё раз.';
  notification.hidden = false;
  clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(() => { notification.hidden = true; }, 6000);
};

const updateProfile = (user) => {
  profileTitle.textContent = user.name;
  profileDescription.textContent = user.about;
  profileAvatar.style.backgroundImage = `url(${JSON.stringify(user.avatar)})`;
};

const prepareForm = (form) => {
  if (form.dataset.pending === 'true') return false;
  form.querySelector('.popup__request-error').textContent = '';
  clearValidation(form, validationSettings);
  infoRequestId += 1;
  return true;
};

// All data changes happen in onSuccess after the server confirms the operation.
const submitForm = async (form, popup, loadingText, request, onSuccess) => {
  if (form.dataset.pending === 'true') return;
  const button = form.querySelector('.popup__button');
  const errorElement = form.querySelector('.popup__request-error');
  const inputs = [...form.querySelectorAll('.popup__input')];
  const originalText = button.textContent;
  form.dataset.pending = 'true';
  errorElement.textContent = '';
  button.textContent = loadingText;
  button.disabled = true;
  button.classList.add('popup__button_disabled');
  inputs.forEach((input) => { input.disabled = true; });
  try {
    const data = await request();
    onSuccess(data);
    closeModalWindow(popup);
  } catch (error) {
    console.error(error);
    errorElement.textContent = 'Не удалось сохранить изменения. Попробуйте ещё раз.';
  } finally {
    form.dataset.pending = 'false';
    inputs.forEach((input) => { input.disabled = false; });
    button.textContent = originalText;
    button.disabled = !form.checkValidity();
    button.classList.toggle('popup__button_disabled', button.disabled);
  }
};

const handlePreviewPicture = ({ name, link }) => {
  infoRequestId += 1;
  imageElement.src = link;
  imageElement.alt = name;
  imageCaption.textContent = name;
  openModalWindow(imagePopup);
};

const handleLikeClick = async (cardId, isLiked, element, button) => {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const data = await changeLikeCardStatus(cardId, isLiked);
    updateCardLikes(element, data.likes, userId);
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
};

const handleDeleteClick = (cardId, element) => {
  if (removeForm.dataset.pending === 'true') return;
  infoRequestId += 1;
  pendingDeletion = { cardId, element };
  removeForm.querySelector('.popup__request-error').textContent = '';
  openModalWindow(removePopup);
};

const formatDate = (date) => date.toLocaleDateString('ru-RU', {
  year: 'numeric', month: 'long', day: 'numeric',
});

const createInfoString = (term, description) => {
  const element = definitionTemplate.content.querySelector('.popup__info-item').cloneNode(true);
  element.querySelector('.popup__info-term').textContent = term;
  element.querySelector('.popup__info-description').textContent = description;
  return element;
};

const createUserPreview = (user) => {
  const element = userPreviewTemplate.content.querySelector('.popup__list-item').cloneNode(true);
  element.textContent = user.name;
  element.title = user.name;
  return element;
};

const handleInfoClick = async (cardId, button) => {
  const requestId = ++infoRequestId;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    const cards = await getCardList();
    if (requestId !== infoRequestId) return;
    const card = cards.find((item) => item._id === cardId);
    if (!card) throw new Error('Карточка уже удалена. Обновите страницу.');
    infoTitle.textContent = card.name;
    infoList.replaceChildren(
      createInfoString('Автор:', card.owner.name),
      createInfoString('Дата создания:', formatDate(new Date(card.createdAt))),
      createInfoString('Количество лайков:', card.likes.length),
    );
    infoLikesTitle.textContent = card.likes.length ? 'Оценили фотографию' : 'Пока нет лайков';
    infoUsersList.replaceChildren(...card.likes.map(createUserPreview));
    openModalWindow(infoPopup);
  } catch (error) {
    if (requestId === infoRequestId) showError(error);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
};

const createCard = (data) => createCardElement(data, userId, {
  onPreviewPicture: handlePreviewPicture,
  onLikeIcon: handleLikeClick,
  onDeleteCard: handleDeleteClick,
  onInfoClick: handleInfoClick,
});

const loadPage = async () => {
  retryButton.hidden = true;
  pageStatus.hidden = false;
  pageStatus.textContent = 'Загрузка профиля и карточек…';
  try {
    const [cards, user] = await Promise.all([getCardList(), getUserInfo()]);
    userId = user._id;
    updateProfile(user);
    placesWrap.replaceChildren(...cards.map(createCard));
    pageStatus.textContent = cards.length ? '' : 'Здесь пока нет фотографий. Добавьте первое место!';
    pageStatus.hidden = cards.length > 0;
    [profileAvatar, openProfileFormButton, openCardFormButton].forEach((button) => { button.disabled = false; });
  } catch (error) {
    console.error(error);
    pageStatus.textContent = 'Не удалось загрузить данные. Проверьте соединение и настройки API.';
    retryButton.hidden = false;
  }
};

profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!profileForm.checkValidity()) return;
  const values = { name: profileTitleInput.value.trim(), about: profileDescriptionInput.value.trim() };
  submitForm(profileForm, profilePopup, 'Сохранение…', () => setUserInfo(values), updateProfile);
});

avatarForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!avatarForm.checkValidity()) return;
  const avatar = avatarInput.value.trim();
  submitForm(avatarForm, avatarPopup, 'Сохранение…', () => setUserAvatar(avatar), updateProfile);
});

cardForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!cardForm.checkValidity()) return;
  const values = { name: cardNameInput.value.trim(), link: cardLinkInput.value.trim() };
  submitForm(cardForm, cardPopup, 'Создание…', () => addCard(values), (card) => {
    placesWrap.prepend(createCard(card));
    pageStatus.hidden = true;
  });
});

removeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pendingDeletion) return;
  const { cardId, element } = pendingDeletion;
  submitForm(removeForm, removePopup, 'Удаление…', () => removeCard(cardId), () => {
    deleteCard(element);
    pendingDeletion = null;
    if (!placesWrap.children.length) {
      pageStatus.textContent = 'Здесь пока нет фотографий. Добавьте первое место!';
      pageStatus.hidden = false;
    }
  });
});

openProfileFormButton.addEventListener('click', () => {
  if (!prepareForm(profileForm)) return;
  profileTitleInput.value = profileTitle.textContent;
  profileDescriptionInput.value = profileDescription.textContent;
  openModalWindow(profilePopup);
});

profileForm.addEventListener('input', () => {
  if (profileTitleInput.value === profileTitle.textContent && profileDescriptionInput.value === profileDescription.textContent) {
    const button = profileForm.querySelector('.popup__button');
    button.disabled = true;
    button.classList.add('popup__button_disabled');
  }
});

profileAvatar.addEventListener('click', () => {
  if (!prepareForm(avatarForm)) return;
  avatarForm.reset();
  openModalWindow(avatarPopup);
});

openCardFormButton.addEventListener('click', () => {
  if (!prepareForm(cardForm)) return;
  cardForm.reset();
  openModalWindow(cardPopup);
});

imageElement.addEventListener('error', () => {
  if (imageElement.src !== imagePlaceholder) imageElement.src = imagePlaceholder;
});
retryButton.addEventListener('click', loadPage);
// Validation listeners precede the handler that checks unchanged profile values.
// Listeners on inputs execute before the input event reaches profileForm.
enableValidation(validationSettings);
document.querySelectorAll('.popup').forEach(setCloseModalWindowEventListeners);
loadPage();
