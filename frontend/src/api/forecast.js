import axiosInstance from './axios';

// Month-end forecast for the latest running month.
// Uses the shared axios instance so the base URL and JWT header are handled in one place.
export const getForecast = () =>
  axiosInstance.get('/forecast').then((res) => res.data);