const getErrorElement = (form, input) => form.querySelector(`#${input.id}-error`);

const showInputError = (form, input, message, settings) => {
  input.classList.add(settings.inputErrorClass);
  input.setAttribute('aria-invalid', 'true');
  const error = getErrorElement(form, input);
  error.textContent = message;
  error.classList.add(settings.errorClass);
};

const hideInputError = (form, input, settings) => {
  input.classList.remove(settings.inputErrorClass);
  input.removeAttribute('aria-invalid');
  const error = getErrorElement(form, input);
  error.textContent = '';
  error.classList.remove(settings.errorClass);
};

const checkInputValidity = (form, input, settings) => {
  input.setCustomValidity('');
  if (input.validity.patternMismatch) {
    input.setCustomValidity(input.dataset.errorMessage);
  } else if (input.required && !input.value.trim()) {
    input.setCustomValidity('Заполните это поле.');
  } else if (input.minLength > 0 && input.value.trim().length < input.minLength) {
    input.setCustomValidity(`Используйте не менее ${input.minLength} символов.`);
  } else if (input.maxLength > 0 && input.value.length > input.maxLength) {
    input.setCustomValidity(`Используйте не более ${input.maxLength} символов.`);
  }
  if (input.validity.valid) hideInputError(form, input, settings);
  else showInputError(form, input, input.validationMessage, settings);
};

const hasInvalidInput = (inputs) => inputs.some((input) => !input.validity.valid);
const disableSubmitButton = (button, settings) => {
  button.disabled = true;
  button.classList.add(settings.inactiveButtonClass);
};
const enableSubmitButton = (button, settings) => {
  button.disabled = false;
  button.classList.remove(settings.inactiveButtonClass);
};
const toggleButtonState = (inputs, button, settings) => {
  if (hasInvalidInput(inputs)) disableSubmitButton(button, settings);
  else enableSubmitButton(button, settings);
};
const setEventListeners = (form, settings) => {
  const inputs = [...form.querySelectorAll(settings.inputSelector)];
  const button = form.querySelector(settings.submitButtonSelector);
  inputs.forEach((input) => input.addEventListener('input', () => {
    checkInputValidity(form, input, settings);
    toggleButtonState(inputs, button, settings);
  }));
  disableSubmitButton(button, settings);
};

export const clearValidation = (form, settings) => {
  form.querySelectorAll(settings.inputSelector).forEach((input) => {
    input.setCustomValidity('');
    hideInputError(form, input, settings);
  });
  disableSubmitButton(form.querySelector(settings.submitButtonSelector), settings);
};

export const enableValidation = (settings) => {
  document.querySelectorAll(settings.formSelector).forEach((form) => setEventListeners(form, settings));
};
