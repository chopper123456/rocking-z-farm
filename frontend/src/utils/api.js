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
  getAll: (params) => api.get('/fields', { params }), // params: { onMapOnly: true }
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

// Equipment API (assets + maintenance, parts, fuel, operators)
export const equipmentAPI = {
  getAll: (params) => api.get('/equipment', { params }), // params: { activeOnly: true }
  getOne: (id) => api.get(`/equipment/${id}`),
  create: (data) => api.post('/equipment', data),
  update: (id, data) => api.put(`/equipment/${id}`, data),
  delete: (id) => api.delete(`/equipment/${id}`),
  getMaintenance: (assetId) => api.get(`/equipment/${assetId}/maintenance`),
  addMaintenance: (assetId, formData) => api.post(`/equipment/${assetId}/maintenance`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getSchedule: (assetId) => api.get(`/equipment/${assetId}/schedule`),
  addSchedule: (assetId, data) => api.post(`/equipment/${assetId}/schedule`, data),
  getParts: (assetId) => api.get(`/equipment/${assetId}/parts`),
  addPart: (assetId, data) => api.post(`/equipment/${assetId}/parts`, data),
  getFuel: (assetId) => api.get(`/equipment/${assetId}/fuel`),
  addFuel: (assetId, data) => api.post(`/equipment/${assetId}/fuel`, data),
  getOperators: (assetId) => api.get(`/equipment/${assetId}/operators`),
  addOperator: (assetId, data) => api.post(`/equipment/${assetId}/operators`, data),
};

// Equipment John Deere sync & reports
export const equipmentJDAPI = {
  sync: () => api.post('/equipment-jd/sync'),
  refreshOnMap: () => api.post('/equipment-jd/refresh-on-map'),
  syncHours: (assetId) => api.post(`/equipment-jd/sync-hours/${assetId}`),
  connections: () => api.get('/equipment-jd/connections'),
  fieldUsage: () => api.get('/equipment-jd/field-usage'),
  alerts: () => api.get('/equipment-jd/alerts'),
  hoursOfOperation: (jdAssetId) => api.get(`/equipment-jd/machines/${encodeURIComponent(jdAssetId)}/hours-of-operation`),
  engineHours: (jdAssetId) => api.get(`/equipment-jd/machines/${encodeURIComponent(jdAssetId)}/engine-hours`),
  machineAlerts: (jdAssetId) => api.get(`/equipment-jd/machines/${encodeURIComponent(jdAssetId)}/alerts`),
  operators: () => api.get('/equipment-jd/operators'),
  maintenanceCosts: (year) => api.get(`/equipment-jd/reports/maintenance-costs?year=${year}`),
  fuelReport: (year) => api.get(`/equipment-jd/reports/fuel?year=${year}`),
  utilization: (params) => api.get('/equipment-jd/reports/utilization', { params }),
  depreciation: () => api.get('/equipment-jd/reports/depreciation'),
};

// Fields John Deere sync
export const fieldsJDAPI = {
  sync: () => api.post('/fields-jd/sync'),
  farms: () => api.get('/fields-jd/farms'),
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
