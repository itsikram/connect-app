import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Environment configuration types
interface EnvironmentConfig {
  API_BASE_URL: string;
  SOCKET_BASE_URL: string;
  API_TIMEOUT: number;
  MEDIAPIPE_BASE_URL: string;
  FACE_SERVICE_URL: string;
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

const liveServerUrl = 'https://connect-server-7h7d.onrender.com';

const isExpoTunnelHost = (host: string): boolean =>
  host.endsWith('.exp.direct') ||
  host.endsWith('.ngrok.io') ||
  host.endsWith('.ngrok-free.app') ||
  host.endsWith('.loca.lt');

// Tunnel development uses the public server; LAN/localhost development uses
// the local API so local changes remain available without a tunnel.
const getDevServerUrl = (): string => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host && isExpoTunnelHost(host)) {
    return liveServerUrl;
  }

  if (
    host &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    host !== '[::1]' &&
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  ) {
    return `http://${host}:4000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://127.0.0.1:4000';
};

const getDevMediapipeServerUrl = (): string =>
  process.env.EXPO_PUBLIC_FACE_SERVICE_URL?.trim() || 'http://192.168.1.102:5001';

// Development server URLs (local network)
const devServerUrl = getDevServerUrl();
const devMediapipeServerUrl = getDevMediapipeServerUrl();

// Production server URLs
const prodServerUrl = liveServerUrl;
const prodMediapipeServerUrl = process.env.EXPO_PUBLIC_FACE_SERVICE_URL?.trim() || '';

const ENV: Record<Environment, EnvironmentConfig> = {
  development: {
    API_BASE_URL: `${devServerUrl}/api/`,
    SOCKET_BASE_URL: devServerUrl,
    API_TIMEOUT: 15000,
    MEDIAPIPE_BASE_URL: devMediapipeServerUrl,
    FACE_SERVICE_URL: process.env.EXPO_PUBLIC_FACE_SERVICE_URL?.trim() || devMediapipeServerUrl,
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
    FACE_SERVICE_URL: process.env.EXPO_PUBLIC_FACE_SERVICE_URL?.trim() || prodMediapipeServerUrl,
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
    FACE_SERVICE_URL: process.env.EXPO_PUBLIC_FACE_SERVICE_URL?.trim() || prodMediapipeServerUrl,
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
    // The API exposes account creation at /signup (not /register).
    REGISTER: '/auth/signup',
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
