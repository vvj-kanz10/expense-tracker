import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api', // adjust if your backend base path is different
});

// Attach JWT token to every request, if one exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;