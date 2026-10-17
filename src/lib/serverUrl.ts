import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import config, {
  FALLBACK_SERVER_URL,
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
const OPTIONS_STORAGE_KEY = 'connect.serverOptions';
const FETCH_TIMEOUT_MS = 4000;
// The admin panel (Settings → Servers) sets the list, single/multi mode,
// strategy and cooldown; every live server serves them here.
const ADMIN_CONFIG_PATH = '/api/connect/server-config';
const ADMIN_CONFIG_REFRESH_MS = 10 * 60 * 1000;
// A server that just failed is skipped by API requests and the socket for
// this long, so neither keeps waiting on it (admin-configurable).
const DEFAULT_DOWN_COOLDOWN_MS = 60 * 1000;
let serverDownCooldownMs = DEFAULT_DOWN_COOLDOWN_MS;
// "random" spreads installs over the servers; "priority" uses the first healthy one.
let serverStrategy: 'random' | 'priority' = 'random';
// Once admin settings have been received, app-config.json no longer replaces them.
let hasAdminConfig = false;

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

// Every live list ends with the fallback server.
const withFallbackServer = (list: string[]): string[] =>
  list.includes(FALLBACK_SERVER_URL) ? list : [...list, FALLBACK_SERVER_URL];

// True for the fallback server while other servers are listed.
const isFallbackOnly = (url: string | null | undefined, list: string[]): boolean =>
  url === FALLBACK_SERVER_URL && list.some((other) => other !== FALLBACK_SERVER_URL);

let serverList: string[] = withFallbackServer(
  builtInLiveServerUrls
    .map(normalizeServerUrl)
    .filter((url): url is string => !!url),
);
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
  const primaries = list.filter((url) => !isFallbackOnly(url, list));
  const healthy = primaries.filter((url) => !isServerDown(url));
  const pool = healthy.length ? healthy : primaries.length ? primaries : list;
  // Spread new installs across the servers.
  return pool[Math.floor(Math.random() * pool.length)];
};

// Answer/decline from the Android call notification runs in native code with
// the API URL saved by push registration. Re-save it on every switch so those
// actions follow the admin's single/multi server settings too.
const syncNativeCallApiUrl = (): void => {
  if (Platform.OS !== 'android') return;
  AsyncStorage.getItem('authToken')
    .then((authToken) => {
      // Signed out: there is nothing for native code to call.
      if (!authToken) return;
      NativeModules.CallNotificationModule?.savePushConfig?.(
        config.API_BASE_URL,
        authToken,
      );
    })
    .catch(() => {});
};

const applyServerUrl = (serverUrl: string): void => {
  if (serverUrl === config.SOCKET_BASE_URL) return;
  setServerUrl(serverUrl);
  syncNativeCallApiUrl();
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
const applyServerList = (configured: string[], preferred?: string | null): void => {
  const list = withFallbackServer(configured);
  serverList = list;
  const firstHealthy = list.find((url) => !isServerDown(url)) || list[0];
  const current =
    serverStrategy === 'priority'
      ? firstHealthy
      : preferred && list.includes(preferred) && !isServerDown(preferred)
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
    cachePromise = AsyncStorage.multiGet([STORAGE_KEY, LIST_STORAGE_KEY, OPTIONS_STORAGE_KEY])
      .then(([[, storedUrl], [, storedList], [, storedOptions]]) => {
        try {
          const options = JSON.parse(storedOptions || 'null');
          if (options) {
            hasAdminConfig = true;
            applyServerOptions(options);
          }
        } catch (_) {
          // Keep the defaults.
        }
        let cachedList: string[] | null = null;
        try {
          cachedList = normalizeServerList(JSON.parse(storedList || 'null'));
        } catch (_) {
          cachedList = null;
        }
        const list = withFallbackServer(cachedList || serverList);
        const stored = normalizeServerUrl(storedUrl);
        // An app start after a failover to the fallback tries the main servers again.
        applyServerList(list, isFallbackOnly(stored, list) ? null : stored);
      })
      .catch(() => {
        if (serverList.length) applyServerList(serverList);
      });
  }
  return cachePromise;
};

const fetchRemoteServerUrl = async (): Promise<void> => {
  if (hasAdminConfig) return;
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

const applyServerOptions = (value: any): void => {
  if (!value || typeof value !== 'object') return;
  serverStrategy = value.strategy === 'priority' ? 'priority' : 'random';
  const seconds = Number(value.downCooldownSeconds);
  serverDownCooldownMs =
    Number.isFinite(seconds) && seconds >= 5 ? seconds * 1000 : DEFAULT_DOWN_COOLDOWN_MS;
};

const fetchJson = async (url: string): Promise<any> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    return response.ok ? await response.json() : null;
  } finally {
    clearTimeout(timer);
  }
};

// Reads the admin panel's server settings from the first live server that
// answers (an older server build without the endpoint is skipped).
const fetchAdminServerConfig = async (): Promise<void> => {
  const candidates = Array.from(
    new Set([config.SOCKET_BASE_URL, ...serverList, ...builtInLiveServerUrls]),
  )
    .map(normalizeServerUrl)
    .filter((url): url is string => !!url && !isServerDown(url));
  for (const server of candidates) {
    try {
      const body = await fetchJson(`${server}${ADMIN_CONFIG_PATH}`);
      if (applyAdminServerConfig(body)) return;
    } catch (_) {
      // Unreachable: try the next server.
    }
  }
};

/**
 * Apply server settings from the admin panel (fetched, or pushed over the
 * socket as "server-config-changed"). Returns false for an unusable payload.
 */
export const applyAdminServerConfig = (body: any): boolean => {
  if (!usesLiveServer || !body || typeof body !== 'object') return false;
  let list = normalizeServerList(body.serverUrls);
  if (!list) return false;
  if (body.mode === 'single') list = list.slice(0, 1);
  hasAdminConfig = true;
  applyServerOptions(body);
  applyServerList(list);
  AsyncStorage.multiSet([
    [LIST_STORAGE_KEY, JSON.stringify(list)],
    [
      OPTIONS_STORAGE_KEY,
      JSON.stringify({ strategy: serverStrategy, downCooldownSeconds: serverDownCooldownMs / 1000 }),
    ],
  ]).catch(() => {});
  return true;
};

let adminConfigTimer: ReturnType<typeof setInterval> | null = null;

let initPromise: Promise<void> | null = null;

// Applies the last known servers, then refreshes them from connect-bd.online
// (until admin settings have been received). Resolves once both steps finish
// (the fetch is bounded by FETCH_TIMEOUT_MS) and never rejects; the admin
// settings are then fetched in the background. No-op in local development.
export const initServerUrl = (): Promise<void> => {
  if (!usesLiveServer) return Promise.resolve();
  if (!initPromise) {
    initPromise = loadCachedServerUrl()
      .then(fetchRemoteServerUrl)
      .then(() => {
        // The admin settings win over app-config.json. Not awaited, so app
        // start is not held up; a change repoints API and socket when it lands.
        fetchAdminServerConfig();
        if (!adminConfigTimer) {
          adminConfigTimer = setInterval(fetchAdminServerConfig, ADMIN_CONFIG_REFRESH_MS);
        }
      });
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
  downUntil.set(failed, Date.now() + serverDownCooldownMs);

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
