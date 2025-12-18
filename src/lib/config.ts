import { Platform } from 'react-native';

// Environment configuration types
interface EnvironmentConfig {
  API_BASE_URL: string;
  SOCKET_BASE_URL: string;
  API_TIMEOUT: number;
  MEDIAPIPE_BASE_URL: string;
  LOGO_URL: string;
  DEFAULT_PROFILE_URL: string;
  DEFAULT_COVER_URL: string;
  DEFAULT_NOTIFICATION_SOUND_URL: string;
  DEFAULT_RINGTONE_URL: string;
  CALLING_BEEP_URL: string;
  LUDU_BACKGROUND_URL: string;
  REACT_LIKE_URL: string;
  REACT_LOVE_URL: string;
  REACT_HAHA_URL: string;
}

type Environment = 'development' | 'staging' | 'production';

// Get the appropriate development server URL based on platform
// IMPORTANT: Android emulator uses 10.0.2.2 to access host machine's localhost
// For physical Android devices, change the Android URL below to your local network IP (e.g., 192.168.0.101)
const getDevServerUrl = (): string => {
  return "http://192.168.0.100:4000";

  if (Platform.OS === 'android') {
    // For Android emulator: use 10.0.2.2 (maps to host machine's localhost)
    // For physical Android device: change to your local IP (e.g., "http://192.168.0.101:4000")
    return "http://10.0.2.2:4000";
  }
  // For iOS simulator and other platforms, use local network IP
  // Alternative: use production server for development
  // return "https://connect-server-y1ku.onrender.com";
};

const getDevMediapipeServerUrl = (): string => {
  if (Platform.OS === 'android') {
    // For Android emulator: use 10.0.2.2
    // For physical Android device: change to your local IP (e.g., "http://192.168.0.101:5000")
    return "https://emotion-detection-z1b2.onrender.com";
  }
  return "https://emotion-detection-z1b2.onrender.com";
};

// Development server URLs (local network)
const devServerUrl = getDevServerUrl();
const devMediapipeServerUrl = getDevMediapipeServerUrl();

// Production server URLs
const prodServerUrl = "https://connect-server-y1ku.onrender.com"
const prodMediapipeServerUrl = "https://emotion-detection-z1b2.onrender.com" // Keep local for now, update if needed

const ENV: Record<Environment, EnvironmentConfig> = {
  development: {
    API_BASE_URL: `${devServerUrl}/api/`,
    SOCKET_BASE_URL: devServerUrl,
    API_TIMEOUT: 10000,
    MEDIAPIPE_BASE_URL: devMediapipeServerUrl,
    LOGO_URL: '/assets/images/logo.png',
    DEFAULT_PROFILE_URL: '/assets/images/default-profile-pic.png',
    DEFAULT_COVER_URL: '/assets/images/default-cover.png',
    DEFAULT_NOTIFICATION_SOUND_URL: '/assets/audio/notification_sound.mp3',
    DEFAULT_RINGTONE_URL: '/assets/audio/default-ringtone.mp3',
    LUDU_BACKGROUND_URL: '/assets/images/ludu-background.png',
    CALLING_BEEP_URL: '/assets/audio/calling-beep.mp3',
    REACT_LIKE_URL: '/assets/images/reacts/reactLike.svg',
    REACT_LOVE_URL: '/assets/images/reacts/reactLove.svg',
    REACT_HAHA_URL: '/assets/images/reacts/reactHaha.svg',
  },
  staging: {
    API_BASE_URL: `${prodServerUrl}/api/`,
    SOCKET_BASE_URL: prodServerUrl,
    API_TIMEOUT: 15000,
    MEDIAPIPE_BASE_URL: prodMediapipeServerUrl,
    LOGO_URL: '/assets/images/logo.png',
    DEFAULT_PROFILE_URL: '/assets/images/default-profile-pic.png',
    DEFAULT_COVER_URL: '/assets/images/default-cover.png',
    DEFAULT_NOTIFICATION_SOUND_URL: '/assets/audio/notification_sound.mp3',
    DEFAULT_RINGTONE_URL: '/assets/audio/default-ringtone.mp3',
    LUDU_BACKGROUND_URL: '/assets/images/ludu-background.png',
    CALLING_BEEP_URL: '/assets/audio/calling-beep.mp3',
    REACT_LIKE_URL: '/assets/images/reacts/reactLike.svg',
    REACT_LOVE_URL: '/assets/images/reacts/reactLove.svg',
    REACT_HAHA_URL: '/assets/images/reacts/reactHaha.svg',
  },
  production: {
    API_BASE_URL: `${prodServerUrl}/api/`,
    SOCKET_BASE_URL: prodServerUrl,
    API_TIMEOUT: 20000,
    MEDIAPIPE_BASE_URL: prodMediapipeServerUrl,
    LOGO_URL: '/assets/images/logo.png',
    DEFAULT_PROFILE_URL: '/assets/images/default-profile-pic.png',
    DEFAULT_COVER_URL: '/assets/images/default-cover.png',
    DEFAULT_NOTIFICATION_SOUND_URL: '/assets/audio/notification_sound.mp3',
    DEFAULT_RINGTONE_URL: '/assets/audio/default-ringtone.mp3',
    LUDU_BACKGROUND_URL: '/assets/images/ludu-background.png',
    CALLING_BEEP_URL: '/assets/audio/calling-beep.mp3',
    REACT_LIKE_URL: '/assets/images/reacts/reactLike.svg',
    REACT_LOVE_URL: '/assets/images/reacts/reactLove.svg',
    REACT_HAHA_URL: '/assets/images/reacts/reactHaha.svg',
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

export default config; 