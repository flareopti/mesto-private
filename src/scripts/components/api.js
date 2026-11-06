const environment = import.meta.env ?? {};

const config = {
  baseUrl: `https://mesto.nomoreparties.co/v1/${environment.VITE_MESTO_GROUP || 'apf-cohort-203'}`,
  headers: {
    authorization: environment.VITE_MESTO_TOKEN || '',
    'Content-Type': 'application/json',
  },
};

const getResponseData = (response) => {
  if (response.ok) return response.json();
  return Promise.reject(new Error(`Ошибка сервера: ${response.status}`));
};

const request = (path, options = {}) => fetch(`${config.baseUrl}${path}`, {
  ...options,
  headers: config.headers,
  signal: AbortSignal.timeout(20000),
}).then(getResponseData);

export const getUserInfo = () => request('/users/me');
export const getCardList = () => request('/cards');
export const setUserInfo = ({ name, about }) => request('/users/me', {
  method: 'PATCH', body: JSON.stringify({ name, about }),
});
export const setUserAvatar = (avatar) => request('/users/me/avatar', {
  method: 'PATCH', body: JSON.stringify({ avatar }),
});
export const addCard = ({ name, link }) => request('/cards', {
  method: 'POST', body: JSON.stringify({ name, link }),
});
export const removeCard = (cardId) => request(`/cards/${encodeURIComponent(cardId)}`, {
  method: 'DELETE',
});
export const changeLikeCardStatus = (cardId, isLiked) => request(`/cards/likes/${encodeURIComponent(cardId)}`, {
  method: isLiked ? 'DELETE' : 'PUT',
});
