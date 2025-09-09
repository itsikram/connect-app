// Environment configuration types
interface EnvironmentConfig {
  API_BASE_URL: string;
  SOCKET_BASE_URL: string;
  API_TIMEOUT: number;
}

type Environment = 'development' | 'staging' | 'production';

const ENV: Record<Environment, EnvironmentConfig> = {
  development: {
    API_BASE_URL: 'http://192.168.1.102:4000/api/',
    SOCKET_BASE_URL: 'http://192.168.1.102:4000',
    API_TIMEOUT: 10000,
  },
  staging: {
    API_BASE_URL: 'http://192.168.1.102:4000/api/',
    SOCKET_BASE_URL: 'http://192.168.1.102:4000',
    API_TIMEOUT: 10000,
  },
  production: {
    API_BASE_URL: 'http://192.168.1.100:4000/api/',
    SOCKET_BASE_URL: 'http://192.168.1.100:4000',
    API_TIMEOUT: 20000,
  },
};

// Get current environment (you can set this via environment variables)
const getEnvironment = (): Environment => {
  // For React Native, you might want to use __DEV__ or environment variables
  if (__DEV__) {
    return 'development';
  }
  // You can add logic here to detect staging vs production
  return 'production';
};

export const config: EnvironmentConfig = ENV[getEnvironment()];

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
} as const;

// UI theme tokens (shared spacing, radius, typography, icon sizes)
export const UI = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  typography: {
    title: 18,
    body: 14,
    caption: 12,
    small: 10,
  },
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
  },
} as const;

export default config; 