import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

// Helper function to check if token exists and has valid format
const isValidToken = (token) => {
  if (!token) return false;

  // Check if token has the expected JWT format (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log('❌ Invalid token format - not a JWT token');
    return false;
  }

  console.log('✅ Token format looks valid');
  return true;
};

// Create axios instance with default configuration
const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: config.API_TIMEOUT,
  headers: {
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

      if (token && isValidToken(token)) {
        config.headers.Authorization = token;
      } else {
        if (token && !isValidToken(token)) {
          await AsyncStorage.multiRemove(['authToken', 'user']);
        }
      }
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
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

    // Handle JWT verification errors (500 status with JWT error)
    if (error.response?.status === 500 && error.response?.data?.message?.includes('JsonWebTokenError')) {
      console.log('🚨 JWT verification failed - token may be expired or invalid');
      try {
        // Clear stored auth data
        await AsyncStorage.multiRemove(['authToken', 'user']);
        console.log('🗑️ Cleared invalid token from storage');
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

export const chatAPI = {
  getChatList: (profileId) => api.get(`/message/chatList?profileId=${profileId}`),
};


export const friendAPI = {
  getFriendList: (profileId) => api.get(`/friend/getFriends?profileId=${profileId}`),
  getFriendRequest: (profileId) => api.get(`/friend/getRequest?profileId=${profileId}`),
  getFriendSuggestions: (profileId) => api.get(`/friend/getSuggetions?profileId=${profileId}`),
  sendFriendRequest: (profileId) => api.post(`/friend/sendRequest?profileId=${profileId}`),
  acceptFriendRequest: (profileId) => api.post(`/friend/reqAccept`, { profile: profileId }),
  deleteFriendRequest: (profileId) => api.post(`/friend/reqDelete`,{ profile: profileId }),
  removeFriend: (profileId) => api.post(`/friend/removeFriend?profileId=${profileId}`),
};

// Debug function to check stored tokens
export const debugAuth = async () => {
  try {
    const [userData, token] = await AsyncStorage.multiGet(['user', 'authToken']);
    console.log('🔍 Debug Auth Storage:');
    console.log('👤 User data:', userData[1] ? 'Found' : 'Not found');
    console.log('🔑 Token:', token[1] ? `${token[1].substring(0, 50)}...` : 'Not found');

    if (token[1]) {
      console.log('🔍 Token validation:', isValidToken(token[1]));
      console.log('📏 Token length:', token[1].length);
    }

    return { user: userData[1], token: token[1] };
  } catch (error) {
    console.error('❌ Error debugging auth:', error);
    return { user: null, token: null };
  }
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
