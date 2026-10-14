import axiosInstance from './axios';

export const getChargeInsights = () =>
  axiosInstance.get('/charges').then((res) => res.data);