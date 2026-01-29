import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// Livestock API
export const livestockAPI = {
  getAll: () => api.get('/livestock'),
  getOne: (id) => api.get(`/livestock/${id}`),
  create: (data) => api.post('/livestock', data),
  update: (id, data) => api.put(`/livestock/${id}`, data),
  delete: (id) => api.delete(`/livestock/${id}`),
};

// Fields API
export const fieldsAPI = {
  getAll: () => api.get('/fields'),
  create: (data) => api.post('/fields', data),
  update: (id, data) => api.put(`/fields/${id}`, data),
  delete: (id) => api.delete(`/fields/${id}`),
};

// Field Reports API
export const fieldReportsAPI = {
  getByFieldAndYear: (fieldName, year) => api.get(`/field-reports/${fieldName}/${year}`),
  getYears: (fieldName) => api.get(`/field-reports/${fieldName}/years`),
  create: (formData) => api.post('/field-reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  download: (id) => api.get(`/field-reports/download/${id}`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/field-reports/${id}`),
};

// Equipment API
export const equipmentAPI = {
  getAll: () => api.get('/equipment'),
  create: (data) => api.post('/equipment', data),
  delete: (id) => api.delete(`/equipment/${id}`),
};

// Grain API
export const grainAPI = {
  getAll: () => api.get('/grain'),
  create: (data) => api.post('/grain', data),
  update: (id, data) => api.put(`/grain/${id}`, data),
  delete: (id) => api.delete(`/grain/${id}`),
};

// Inventory API
export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
};

export default api;
