import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

// const token = AsyncStorage.getItem('authToken').then(token => {
//   console.log('token', token);
//   return token;
// });
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjdiZjFlNDAwOTM5NWFkZDAzZTFlMjMyIiwiaWF0IjoxNzU2MTQ3OTEzLCJleHAiOjE3NTg3Mzk5MTN9.7IsgytoCFMiOs2gVD-0_yWD4SEZHYlGkOI-BumvLe7Y";

// Create axios instance with default configuration
const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: config.API_TIMEOUT,
  headers: {
    'Authorization' : `${token}`,
    "User-Agent": "MyCustomUserAgent",
    "Access-Control-Allow-Origin": "*",
  }
});

console.log('API Base URL:', config.API_BASE_URL);
console.log('API Timeout:', config.API_TIMEOUT);

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
      console.error('Network error details:', {
        code: error.code,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout
        }
      });
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
  getProfile: (profileId) => api.get(`/profile?profileId=${profileId}`),

  updateProfile: userData => api.post('/profile', userData),

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
