import axiosInstance from './axios';

export const getGoals = async () => {
  const response = await axiosInstance.get('/goals');
  return response.data;
};

export const createGoal = async (goal) => {
  const response = await axiosInstance.post('/goals', goal);
  return response.data;
};

export const contributeToGoal = async (id, amount) => {
  const response = await axiosInstance.post(`/goals/${id}/contribute`, { amount });
  return response.data;
};

export const withdrawFromGoal = async (id, amount) => {
  const response = await axiosInstance.post(`/goals/${id}/withdraw`, { amount });
  return response.data;
};

export const deleteGoal = async (id) => {
  const response = await axiosInstance.delete(`/goals/${id}`);
  return response.data;
};