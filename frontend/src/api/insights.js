import axiosInstance from './axios';

export const getSavingsSuggestions = async (stats) => {
  const response = await axiosInstance.post('/insights/savings', stats);
  return response.data;
};