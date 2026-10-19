import axiosInstance from './axios';

export const getSplits = async () => {
  const response = await axiosInstance.get('/splits');
  return response.data;
};

// Replaces the parts of one withdrawal. An empty list clears them.
export const saveSplits = async (transactionId, splits) => {
  const response = await axiosInstance.put(`/splits/${transactionId}`, { splits });
  return response.data;
};