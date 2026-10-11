import AsyncStorage from '@react-native-async-storage/async-storage';
import config, { setServerUrl, usesLiveServer } from './config';

// Published by connect-web (public/app-config.json). Edit that file to move the
// app to a new server without rebuilding it:
//   { "serverUrl": "https://your-server.example.com" }
const REMOTE_SERVER_CONFIG_URL =
  process.env.EXPO_PUBLIC_SERVER_CONFIG_URL?.trim() ||
  'https://connect-bd.online/app-config.json';

const STORAGE_KEY = 'connect.serverUrl';
const FETCH_TIMEOUT_MS = 4000;

// https only, so a tampered or mistyped config cannot downgrade traffic to
// plain http. Optional port and path prefix; no query string or fragment.
const SERVER_URL_PATTERN =
  /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9._~\/-]*)?$/;

const normalizeServerUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const url = value.trim().replace(/\/+$/, '');
  return SERVER_URL_PATTERN.test(url) ? url : null;
};

const applyServerUrl = (serverUrl: string): void => {
  if (serverUrl === config.SOCKET_BASE_URL) return;
  setServerUrl(serverUrl);
  if (__DEV__) {
    console.log('🌐 Server URL set to:', serverUrl);
  }
};

let cachePromise: Promise<void> | null = null;

const loadCachedServerUrl = (): Promise<void> => {
  if (!cachePromise) {
    cachePromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const cached = normalizeServerUrl(stored);
        if (cached) applyServerUrl(cached);
      })
      .catch(() => {});
  }
  return cachePromise;
};

const fetchRemoteServerUrl = async (): Promise<void> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(REMOTE_SERVER_CONFIG_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    if (!response.ok) return;
    const serverUrl = normalizeServerUrl((await response.json())?.serverUrl);
    if (!serverUrl) return;
    applyServerUrl(serverUrl);
    await AsyncStorage.setItem(STORAGE_KEY, serverUrl);
  } catch (error) {
    // Offline or config unreachable: keep the cached / built-in URL.
    if (__DEV__) {
      console.warn('Could not fetch server config:', error);
    }
  } finally {
    clearTimeout(timer);
  }
};

let initPromise: Promise<void> | null = null;

// Applies the last known server URL, then refreshes it from connect-bd.online.
// Resolves once both steps finish (the fetch is bounded by FETCH_TIMEOUT_MS)
// and never rejects. No-op in local development.
export const initServerUrl = (): Promise<void> => {
  if (!usesLiveServer) return Promise.resolve();
  if (!initPromise) {
    initPromise = loadCachedServerUrl().then(fetchRemoteServerUrl);
  }
  return initPromise;
};

// Used by the API client so requests made before App mounts (e.g. call actions
// from a killed app) still use the last known server instead of the built-in one.
export const resolveApiBaseUrl = async (): Promise<string> => {
  if (usesLiveServer) await loadCachedServerUrl();
  return config.API_BASE_URL;
};
