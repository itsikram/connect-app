import AsyncStorage from '@react-native-async-storage/async-storage';
import config, {
  builtInLiveServerUrls,
  setServerUrl,
  usesLiveServer,
} from './config';

// Published by connect-web (public/app-config.json). Edit that file to move the
// app to new servers without rebuilding it:
//   { "serverUrls": ["https://a.example.com", "https://b.example.com"] }
// The single "serverUrl" field is only read by older app builds.
const REMOTE_SERVER_CONFIG_URL =
  process.env.EXPO_PUBLIC_SERVER_CONFIG_URL?.trim() ||
  'https://connect-bd.online/app-config.json';

const STORAGE_KEY = 'connect.serverUrl';
const LIST_STORAGE_KEY = 'connect.serverUrls';
const FETCH_TIMEOUT_MS = 4000;
// A server that just failed is skipped by API requests and the socket for
// this long, so neither keeps waiting on it.
const SERVER_DOWN_COOLDOWN_MS = 60 * 1000;

// https only, so a tampered or mistyped config cannot downgrade traffic to
// plain http. Optional port and path prefix; no query string or fragment.
const SERVER_URL_PATTERN =
  /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9._~\/-]*)?$/;

const normalizeServerUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const url = value.trim().replace(/\/+$/, '');
  return SERVER_URL_PATTERN.test(url) ? url : null;
};

const normalizeServerList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const list = Array.from(
    new Set(value.map(normalizeServerUrl).filter((url): url is string => !!url)),
  );
  return list.length ? list : null;
};

let serverList: string[] = builtInLiveServerUrls
  .map(normalizeServerUrl)
  .filter((url): url is string => !!url);
const downUntil = new Map<string, number>();
const listeners = new Set<(serverUrl: string) => void>();

const isServerDown = (url: string): boolean => {
  const until = downUntil.get(url);
  if (!until) return false;
  if (until > Date.now()) return true;
  downUntil.delete(url);
  return false;
};

const pickRandomServer = (list: string[]): string => {
  const healthy = list.filter((url) => !isServerDown(url));
  const pool = healthy.length ? healthy : list;
  // Spread new installs across the servers.
  return pool[Math.floor(Math.random() * pool.length)];
};

const applyServerUrl = (serverUrl: string): void => {
  if (serverUrl === config.SOCKET_BASE_URL) return;
  setServerUrl(serverUrl);
  if (__DEV__) {
    console.log('🌐 Server URL set to:', serverUrl);
  }
  listeners.forEach((listener) => {
    try {
      listener(serverUrl);
    } catch (_) {
      // A listener error must not stop the switch.
    }
  });
};

const persistServerUrl = (serverUrl: string): void => {
  AsyncStorage.setItem(STORAGE_KEY, serverUrl).catch(() => {});
};

// Keep the current server when it is still in the list; otherwise pick one.
const applyServerList = (list: string[], preferred?: string | null): void => {
  serverList = list;
  const current =
    preferred && list.includes(preferred) && !isServerDown(preferred)
      ? preferred
      : list.includes(config.SOCKET_BASE_URL) &&
          !isServerDown(config.SOCKET_BASE_URL)
        ? config.SOCKET_BASE_URL
        : pickRandomServer(list);
  applyServerUrl(current);
  persistServerUrl(current);
};

let cachePromise: Promise<void> | null = null;

const loadCachedServerUrl = (): Promise<void> => {
  if (!cachePromise) {
    cachePromise = AsyncStorage.multiGet([STORAGE_KEY, LIST_STORAGE_KEY])
      .then(([[, storedUrl], [, storedList]]) => {
        let cachedList: string[] | null = null;
        try {
          cachedList = normalizeServerList(JSON.parse(storedList || 'null'));
        } catch (_) {
          cachedList = null;
        }
        applyServerList(cachedList || serverList, normalizeServerUrl(storedUrl));
      })
      .catch(() => {
        if (serverList.length) applyServerList(serverList);
      });
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
    const list = normalizeServerList((await response.json())?.serverUrls);
    if (!list) return;
    applyServerList(list);
    await AsyncStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    // Offline or config unreachable: keep the cached / built-in servers.
    if (__DEV__) {
      console.warn('Could not fetch server config:', error);
    }
  } finally {
    clearTimeout(timer);
  }
};

let initPromise: Promise<void> | null = null;

// Applies the last known servers, then refreshes them from connect-bd.online.
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

/** Servers this build can switch between (one in local development). */
export const getServerList = (): string[] =>
  usesLiveServer && serverList.length ? serverList : [config.SOCKET_BASE_URL];

/** True when another server is available to fail over to. */
export const canFailover = (): boolean => getServerList().length > 1;

/**
 * `failedUrl` is down: move API and socket traffic to the next server that
 * has not failed recently. Returns the new server, or null when there is
 * nowhere else to go.
 */
export const failoverFrom = (failedUrl: string): string | null => {
  const list = getServerList();
  if (list.length < 2) return null;
  const failed = failedUrl.replace(/\/+$/, '');
  downUntil.set(failed, Date.now() + SERVER_DOWN_COOLDOWN_MS);

  // Another caller already moved off the failed server.
  if (config.SOCKET_BASE_URL !== failed && list.includes(config.SOCKET_BASE_URL)) {
    return config.SOCKET_BASE_URL;
  }

  const start = list.indexOf(failed);
  let next = list[(start + 1) % list.length];
  for (let step = 1; step < list.length; step += 1) {
    const candidate = list[(start + step) % list.length];
    if (!isServerDown(candidate)) {
      next = candidate;
      break;
    }
  }
  console.warn(`🔄 Server ${failed} unavailable, switching to ${next}`);
  applyServerUrl(next);
  persistServerUrl(next);
  return next;
};

/** Called with the new server origin whenever the app switches servers. */
export const onServerUrlChange = (
  listener: (serverUrl: string) => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
