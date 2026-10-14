import axiosInstance from './axios';

// month looks like "2026-09"; leave it out to get the latest month
export const getLeftoverSplit = (month) =>
  axiosInstance
    .get('/leftover', { params: month ? { month } : {} })
    .then((res) => res.data);