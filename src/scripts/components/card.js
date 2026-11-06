const imagePlaceholder = new URL('../../images/image-unavailable.svg', import.meta.url).href;
const cardTemplate = document.querySelector('#card-template');

export const updateCardLikes = (element, likes, userId) => {
  const button = element.querySelector('.card__like-button');
  const isLiked = likes.some((user) => user._id === userId);
  button.classList.toggle('card__like-button_is-active', isLiked);
  button.setAttribute('aria-pressed', String(isLiked));
  button.setAttribute('aria-label', isLiked ? 'Снять лайк' : 'Поставить лайк');
  element.querySelector('.card__like-count').textContent = likes.length;
};

export const deleteCard = (element) => element.remove();

export const createCardElement = (data, userId, {
  onPreviewPicture, onLikeIcon, onDeleteCard, onInfoClick,
}) => {
  const element = cardTemplate.content.querySelector('.card').cloneNode(true);
  const image = element.querySelector('.card__image');
  const title = element.querySelector('.card__title');
  const likeButton = element.querySelector('.card__like-button');
  const deleteButton = element.querySelector('.card__control-button_type_delete');
  const infoButton = element.querySelector('.card__control-button_type_info');
  element.dataset.cardId = data._id;
  image.src = data.link;
  image.alt = data.name;
  image.setAttribute('aria-label', `Открыть фотографию: ${data.name}`);
  title.textContent = data.name;
  image.addEventListener('click', () => onPreviewPicture(data));
  image.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPreviewPicture(data);
    }
  });
  image.addEventListener('error', () => {
    image.classList.add('card__image_unavailable');
    image.src = imagePlaceholder;
  }, { once: true });
  updateCardLikes(element, data.likes, userId);
  likeButton.addEventListener('click', () => {
    onLikeIcon(data._id, likeButton.getAttribute('aria-pressed') === 'true', element, likeButton);
  });
  if (data.owner._id === userId) {
    deleteButton.addEventListener('click', () => onDeleteCard(data._id, element));
  } else {
    deleteButton.remove();
  }
  infoButton.addEventListener('click', () => onInfoClick(data._id, infoButton));
  return element;
};
