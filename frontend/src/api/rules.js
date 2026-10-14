import axiosInstance from './axios';

// axiosInstance already includes the /api prefix and attaches the JWT
export const getRules = () => axiosInstance.get('/rules').then((res) => res.data);

export const deleteRule = (id) => axiosInstance.delete(`/rules/${id}`);