import axiosInstance from './axios';

export const getTransactions = async () => {
  const response = await axiosInstance.get('/transactions');
  return response.data;
};

export const uploadStatement = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);

  return axiosInstance.post("/transactions/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onUploadProgress?.(percent);
    },
  });
};

export const updateTransaction = async (id, updates) => {
  const response = await axiosInstance.put(`/transactions/${id}`, updates);
  return response.data;
};

export const deleteTransaction = async (id) => {
  const response = await axiosInstance.delete(`/transactions/${id}`);
  return response.data;
};