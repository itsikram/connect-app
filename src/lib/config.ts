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

const serverUrl = "http://192.168.0.100:4000"
// const serverUrl = "http://172.20.10.2:4000"
const mediapipeServerUrl = "http://192.168.0.100:5000"
//const serverUrl = "https://connect-server-y1ku.onrender.com"

const ENV: Record<Environment, EnvironmentConfig> = {
  development: {
    API_BASE_URL: `${serverUrl}/api/`,
    SOCKET_BASE_URL: serverUrl,
    API_TIMEOUT: 10000,
    MEDIAPIPE_BASE_URL: mediapipeServerUrl,
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
    API_BASE_URL: `${serverUrl}/api/`,
    SOCKET_BASE_URL: serverUrl,
    API_TIMEOUT: 15000,
    MEDIAPIPE_BASE_URL: mediapipeServerUrl,
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
    API_BASE_URL: `${serverUrl}/api/`,
    SOCKET_BASE_URL: serverUrl,
    API_TIMEOUT: 20000,
    MEDIAPIPE_BASE_URL: mediapipeServerUrl,
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