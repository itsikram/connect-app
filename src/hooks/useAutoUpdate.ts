import * as React from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../lib/api';
import {
  getRemoteConfig,
  setRemoteConfig,
  subscribeRemoteConfig,
  type ConnectRemoteConfig,
} from '../lib/remoteConfig';
import {
  addProgressListener,
  addStatusListener,
  canInstallPackages,
  compareVersions,
  describeUpdateError,
  downloadAndInstall,
  getInstalledVersion,
  isAppUpdateSupported,
  openInstallPermissionSettings,
} from '../lib/appUpdate';

export type UpdatePhase =
  | 'available'
  | 'permission'
  | 'downloading'
  | 'installing'
  | 'failed';

export type UpdateCheck = 'idle' | 'checking' | 'up_to_date' | 'available' | 'error';

export type UpdatePrefs = {
  /** Download and install by itself; when off, ask before updating. */
  autoUpdate: boolean;
  /** Only download automatically on Wi-Fi (or ethernet). */
  wifiOnly: boolean;
};

export type AppUpdateState = {
  /** Update dialog. */
  visible: boolean;
  phase: UpdatePhase;
  progress: number;
  /** Version being offered or installed. */
  version: string;
  check: UpdateCheck;
  /** Admin's App Version; empty until the server answered. */
  latestVersion: string;
  /** When the server was last asked (ms), 0 when never. */
  lastCheckedAt: number;
  /** Plain-language reason of the last failure. */
  error: string;
  prefs: UpdatePrefs;
};

type Target = { version: string; apkUrl: string };

// Re-check admin's latest version at most this often when the app resumes.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
// Automatic attempts (downloads and prompts) per version per day,
// so a broken APK or a cancelled install does not nag on every launch.
const MAX_ATTEMPTS_PER_DAY = 3;
const ATTEMPTS_KEY = 'appUpdate.attempts';
// APK link that turned out not to be newer than the installed build.
const SKIPPED_KEY = 'appUpdate.skipped';
const PREFS_KEY = 'appUpdate.prefs';

const DEFAULT_PREFS: UpdatePrefs = { autoUpdate: true, wifiOnly: false };

const today = (): string => new Date().toISOString().slice(0, 10);

async function takeAttempt(version: string): Promise<boolean> {
  try {
    const stored = JSON.parse((await AsyncStorage.getItem(ATTEMPTS_KEY)) || '{}');
    const count =
      stored.date === today() && stored.version === version ? stored.count || 0 : 0;
    if (count >= MAX_ATTEMPTS_PER_DAY) return false;
    await AsyncStorage.setItem(
      ATTEMPTS_KEY,
      JSON.stringify({ date: today(), version, count: count + 1 }),
    );
    return true;
  } catch (_) {
    return true;
  }
}

const skipKey = ({ version, apkUrl }: Target) => `${version}|${apkUrl}`;

async function isSkipped(target: Target): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SKIPPED_KEY)) === skipKey(target);
  } catch (_) {
    return false;
  }
}

async function isOnWifi(): Promise<boolean> {
  try {
    const net = await NetInfo.fetch();
    return net.type === 'wifi' || net.type === 'ethernet';
  } catch (_) {
    return true;
  }
}

// One shared update state, so the update dialog (App.tsx) and the About
// screen show and drive the same download.
let state: AppUpdateState = {
  visible: false,
  phase: 'downloading',
  progress: 0,
  version: '',
  check: 'idle',
  latestVersion: '',
  lastCheckedAt: 0,
  error: '',
  prefs: DEFAULT_PREFS,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<AppUpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getState = () => state;

let target: Target | null = null;
let busy = false;
let lastCheck = 0;
let awaitingPermission = false;

const prefsReady: Promise<void> = AsyncStorage.getItem(PREFS_KEY)
  .then(raw => {
    if (raw) setState({ prefs: { ...DEFAULT_PREFS, ...JSON.parse(raw) } });
  })
  .catch(() => {});

async function startDownload() {
  if (!target || busy) return;
  const current = target;
  busy = true;
  setState({ phase: 'downloading', progress: 0, visible: true, error: '' });
  try {
    await downloadAndInstall(current.apkUrl, current.version);
    setState({ phase: 'installing' });
  } catch (e: any) {
    if (e?.code === 'not_newer') {
      // Admin's version is ahead of the APK it links to: wait for a new link.
      console.warn('App update skipped:', e?.message);
      AsyncStorage.setItem(SKIPPED_KEY, skipKey(current)).catch(() => {});
      target = null;
      setState({ visible: false, check: 'up_to_date' });
    } else {
      console.warn('App update failed:', e?.message);
      setState({ phase: 'failed', error: describeUpdateError(e?.message) });
    }
  } finally {
    busy = false;
  }
}

async function evaluateConfig(cfg: ConnectRemoteConfig | null) {
  const latest = String(cfg?.appVersion || '').trim();
  const apkUrl = String(cfg?.apkUrl || '').trim();
  if (busy) return;
  setState({ latestVersion: latest });
  try {
    await prefsReady;
    const installed = await getInstalledVersion();
    const candidate = { version: latest, apkUrl };
    if (
      !latest ||
      !apkUrl ||
      compareVersions(latest, installed) <= 0 ||
      (await isSkipped(candidate))
    ) {
      target = null;
      setState({ check: 'up_to_date' });
      return;
    }
    target = candidate;
    setState({ check: 'available', version: latest });

    const { autoUpdate, wifiOnly } = state.prefs;
    if (!autoUpdate) {
      if (!state.visible && (await takeAttempt(latest))) {
        setState({ phase: 'available', visible: true });
      }
      return;
    }
    if (wifiOnly && !(await isOnWifi())) return;
    if (!(await canInstallPackages())) {
      // One-time "Install unknown apps" permission for Connect.
      if (await takeAttempt(latest)) setState({ phase: 'permission', visible: true });
      return;
    }
    if (await takeAttempt(latest)) startDownload();
  } catch (e: any) {
    console.warn('App update check failed:', e);
    setState({ check: 'error', error: describeUpdateError(e?.message) });
  }
}

// The remote-config listener and a manual check can ask for the same config
// at once; share one evaluation instead of counting two attempts.
let evaluation: { cfg: ConnectRemoteConfig | null; promise: Promise<void> } | null = null;

function evaluate(cfg: ConnectRemoteConfig | null): Promise<void> {
  if (evaluation && evaluation.cfg === cfg) return evaluation.promise;
  const promise = evaluateConfig(cfg).finally(() => {
    if (evaluation?.promise === promise) evaluation = null;
  });
  evaluation = { cfg, promise };
  return promise;
}

async function fetchConfig(force: boolean) {
  if (!force && Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = Date.now();
  if (force) setState({ check: 'checking', error: '' });
  try {
    const res = await api.get('/connect/');
    setState({ lastCheckedAt: Date.now() });
    if (res?.data && typeof res.data === 'object') {
      setRemoteConfig(res.data);
      await evaluate(getRemoteConfig());
    } else if (force) {
      setState({ check: 'up_to_date' });
    }
  } catch (_) {
    lastCheck = 0;
    if (force) {
      setState({
        check: 'error',
        error: 'Could not reach the server. Check your internet connection.',
      });
    }
  }
}

/** "Check for updates" on the About screen. */
export const checkForUpdatesNow = (): Promise<void> => fetchConfig(true);

/** "Update now": installs the available update regardless of the preferences. */
export async function updateNow(): Promise<void> {
  if (!target || busy) return;
  try {
    if (!(await canInstallPackages())) {
      setState({ phase: 'permission', visible: true });
      return;
    }
  } catch (_) {}
  startDownload();
}

export function allowUpdateInstalls() {
  awaitingPermission = true;
  openInstallPermissionSettings().catch(() => {
    awaitingPermission = false;
  });
}

export async function setUpdatePrefs(patch: Partial<UpdatePrefs>) {
  await prefsReady;
  const prefs = { ...state.prefs, ...patch };
  setState({ prefs });
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  // Turned automatic updates on, or allowed mobile data: act on it now.
  if (patch.autoUpdate === true || patch.wifiOnly === false) {
    evaluate(getRemoteConfig());
  }
}

export const getAppUpdateState = getState;

export function useAppUpdateState(): AppUpdateState {
  return React.useSyncExternalStore(subscribe, getState, getState);
}

const dismiss = () => setState({ visible: false });

/**
 * Android auto-update: when admin's App Version is higher than the installed
 * versionName, downloads the admin's APK URL and installs it. Mount once (App).
 */
export function useAutoUpdate() {
  const current = useAppUpdateState();

  React.useEffect(() => {
    if (!isAppUpdateSupported()) return;
    const initial = getRemoteConfig();
    if (initial) evaluate(initial);
    const unsubscribeConfig = subscribeRemoteConfig(evaluate);
    const removeProgress = addProgressListener(progress => setState({ progress }));
    const removeStatus = addStatusListener((status, message, code) => {
      if (status === 'failed') {
        setState({ phase: 'failed', error: describeUpdateError(message, code) });
      } else if (status === 'success') {
        setState({ visible: false });
      } else {
        setState({ phase: 'installing' });
      }
    });
    // Waiting for Wi-Fi: start once the phone joins one.
    const removeNetInfo = NetInfo.addEventListener(net => {
      if (
        state.check === 'available' &&
        state.prefs.wifiOnly &&
        (net.type === 'wifi' || net.type === 'ethernet')
      ) {
        evaluate(getRemoteConfig());
      }
    });

    fetchConfig(false);
    const appStateSub = AppState.addEventListener('change', appState => {
      if (appState !== 'active') return;
      if (awaitingPermission) {
        // Back from the "Install unknown apps" screen.
        awaitingPermission = false;
        canInstallPackages()
          .then(allowed => (allowed ? startDownload() : undefined))
          .catch(() => {});
        return;
      }
      fetchConfig(false);
    });

    return () => {
      unsubscribeConfig();
      removeProgress();
      removeStatus();
      removeNetInfo();
      appStateSub.remove();
    };
  }, []);

  return {
    visible: current.visible,
    phase: current.phase,
    progress: current.progress,
    version: current.version,
    error: current.error,
    dismiss,
    allowInstalls: allowUpdateInstalls,
    retry: startDownload,
    update: updateNow,
  };
}
