import axiosInstance from './axios';

export const getBudgetLimits = async () => {
  const response = await axiosInstance.get('/budget-limits');
  return response.data;
};

export const setBudgetLimit = async (category, amount) => {
  const response = await axiosInstance.post('/budget-limits', { category, amount });
  return response.data;
};