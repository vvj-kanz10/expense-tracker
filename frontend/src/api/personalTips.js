import axiosInstance from './axios';

// Saved tips only (never calls Gemini). Returns [] when nothing is saved for the current numbers.
// month looks like "2026-09"
export const getCachedPersonalTips = (month) =>
  axiosInstance
    .get('/personal-tips/cached', { params: { month } })
    .then((res) => res.data);

// Saved tips if the numbers are unchanged, otherwise generates new ones with Gemini
export const generatePersonalTips = (month) =>
  axiosInstance
    .post('/personal-tips', null, { params: { month } })
    .then((res) => res.data);