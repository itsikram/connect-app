import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: config.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Clear stored auth data
        await AsyncStorage.multiRemove(['authToken', 'user']);
        // You can redirect to login screen here if needed
        console.log('Session expired, please login again');
      } catch (storageError) {
        console.error('Error clearing auth data:', storageError);
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      // You can show a network error message to the user
    }

    return Promise.reject(error);
  },
);

// API service methods
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),

  signup: userData => api.post('/auth/signup', userData),

  logout: () => api.post('/auth/logout'),

  refreshToken: () => api.post('/auth/refresh'),
};

export const userAPI = {
  getProfile: () => api.get('/user/profile'),

  updateProfile: userData => api.post('/user/profile', userData),

  changePassword: passwordData =>
    api.post('/user/change-password', passwordData),
};

// Generic API methods
export const apiService = {
  get: (url, config = {}) => api.get(url, config),
  post: (url, data = {}, config = {}) => api.post(url, data, config),
  put: (url, data = {}, config = {}) => api.put(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),
};

// Export the configured axios instance
export default api;
