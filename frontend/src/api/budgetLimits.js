import axiosInstance from './axios';

export const getBudgetLimits = async () => {
  const response = await axiosInstance.get('/budget-limits');
  return response.data;
};

export const setBudgetLimit = async (category, amount) => {
  const response = await axiosInstance.post('/budget-limits', { category, amount });
  return response.data;
};

export const deleteBudgetLimit = async (id) => {
  const response = await axiosInstance.delete(`/budget-limits/${id}`);
  return response.data;
};

export const getBudgetSuggestions = async () => {
  const response = await axiosInstance.get('/budget-suggestions');
  return response.data;
};