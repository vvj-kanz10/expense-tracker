import axiosInstance from './axios';

export const getSavingsSuggestions = (stats) => 
  axiosInstance.post('/insights/savings', stats).then((res) => res.data);

// Only looks for tips already saved for these exact numbers (never calls the AI)
export const getCachedSuggestions = (stats) => 
  axiosInstance.post('/insights/savings/cached', stats).then((res) => res.data);