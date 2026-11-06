let activePopup = null;
let previousFocus = null;

const getFocusableElements = (popup) => [...popup.querySelectorAll(
  'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
)];

const handleKeydown = (event) => {
  if (!activePopup) return;
  if (event.key === 'Escape') closeModalWindow(activePopup);
  if (event.key !== 'Tab') return;
  const elements = getFocusableElements(activePopup);
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
};

export const openModalWindow = (popup) => {
  if (activePopup === popup) return;
  if (activePopup) closeModalWindow(activePopup);
  previousFocus = document.activeElement;
  activePopup = popup;
  popup.classList.add('popup_is-opened');
  popup.removeAttribute('inert');
  popup.setAttribute('aria-hidden', 'false');
  document.body.classList.add('page_modal-open');
  document.addEventListener('keydown', handleKeydown);
  getFocusableElements(popup)[0]?.focus();
};

export const closeModalWindow = (popup) => {
  if (activePopup !== popup) return;
  popup.classList.remove('popup_is-opened');
  popup.setAttribute('inert', '');
  popup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('page_modal-open');
  document.removeEventListener('keydown', handleKeydown);
  activePopup = null;
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
};

export const setCloseModalWindowEventListeners = (popup) => {
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-hidden', 'true');
  popup.setAttribute('inert', '');
  const title = popup.querySelector('.popup__title, .popup__caption');
  title.id = `${popup.classList[1]}-title`;
  popup.setAttribute('aria-labelledby', title.id);
  popup.addEventListener('click', (event) => {
    if (event.target === popup || event.target.closest('.popup__close')) {
      closeModalWindow(popup);
    }
  });
};
