import axiosInstance from '../axios/axiosInstance';

export const createGuestSession = () =>
  axiosInstance.post('/guest-session');

export const getGuestSession = (id) =>
  axiosInstance.get(`/guest-session/${id}`);

export const updateGuestSession = (id, data) =>
  axiosInstance.put(`/guest-session/${id}`, data);

export const claimGuestSession = (id) =>
  axiosInstance.post(`/guest-session/${id}/claim`);
