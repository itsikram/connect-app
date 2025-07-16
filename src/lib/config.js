// Environment configuration
// const ENV = {
//   development: {
//     API_BASE_URL: 'http://192.168.0.108:4000/api/',
//     API_TIMEOUT: 10000,
//   },
//   staging: {
//     API_BASE_URL: 'http://192.168.0.108:4000/api/',
//     API_TIMEOUT: 15000,
//   },
//   production: {
//     API_BASE_URL: 'http://192.168.0.108:4000/api/',
//     API_TIMEOUT: 20000,
//   },
// };
const ENV = {
  development: {
    API_BASE_URL: 'https://connectbd.onrender.com/api/',
    API_TIMEOUT: 10000,
  },
  staging: {
    API_BASE_URL: 'https://connectbd.onrender.com/api/',
    API_TIMEOUT: 15000,
  },
  production: {
    API_BASE_URL: 'https://connectbd.onrender.com/api/',
    API_TIMEOUT: 20000,
  },
};

// Get current environment (you can set this via environment variables)
const getEnvironment = () => {
  // For React Native, you might want to use __DEV__ or environment variables
  if (__DEV__) {
    return 'development';
  }
  // You can add logic here to detect staging vs production
  return 'production';
};

export const config = ENV[getEnvironment()];

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
  },
  USER: {
    PROFILE: '/user/profile',
    UPDATE_PROFILE: '/user/profile',
    CHANGE_PASSWORD: '/user/change-password',
  },
  // Add more endpoint categories as needed
};

export default config; 