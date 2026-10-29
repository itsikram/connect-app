import * as React from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  downloadAndInstall,
  getInstalledVersion,
  isAppUpdateSupported,
  openInstallPermissionSettings,
} from '../lib/appUpdate';

export type UpdatePhase = 'permission' | 'downloading' | 'installing' | 'failed';

type Target = { version: string; apkUrl: string };

// Re-check admin's latest version at most this often when the app resumes.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
// Automatic attempts (downloads and permission prompts) per version per day,
// so a broken APK or a cancelled install does not nag on every launch.
const MAX_ATTEMPTS_PER_DAY = 3;
const ATTEMPTS_KEY = 'appUpdate.attempts';
// APK link that turned out not to be newer than the installed build.
const SKIPPED_KEY = 'appUpdate.skipped';

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

/**
 * Android auto-update: when admin's App Version is higher than the installed
 * versionName, downloads the admin's APK URL and installs it.
 */
export function useAutoUpdate() {
  const [visible, setVisible] = React.useState(false);
  const [phase, setPhase] = React.useState<UpdatePhase>('downloading');
  const [progress, setProgress] = React.useState(0);
  const [version, setVersion] = React.useState('');
  const targetRef = React.useRef<Target | null>(null);
  const busyRef = React.useRef(false);
  const lastCheckRef = React.useRef(0);
  const awaitingPermissionRef = React.useRef(false);

  const startDownload = React.useCallback(async () => {
    const target = targetRef.current;
    if (!target || busyRef.current) return;
    busyRef.current = true;
    setPhase('downloading');
    setProgress(0);
    setVisible(true);
    try {
      await downloadAndInstall(target.apkUrl, target.version);
      setPhase('installing');
    } catch (e: any) {
      if (e?.code === 'not_newer') {
        // Admin's version is ahead of the APK it links to: wait for a new link.
        console.warn('App update skipped:', e?.message);
        AsyncStorage.setItem(SKIPPED_KEY, skipKey(target)).catch(() => {});
        setVisible(false);
      } else {
        console.warn('App update failed:', e?.message);
        setPhase('failed');
      }
    } finally {
      busyRef.current = false;
    }
  }, []);

  const applyConfig = React.useCallback(
    async (cfg: ConnectRemoteConfig | null) => {
      const latest = String(cfg?.appVersion || '').trim();
      const apkUrl = String(cfg?.apkUrl || '').trim();
      if (!latest || !apkUrl || busyRef.current) return;
      try {
        const installed = await getInstalledVersion();
        if (compareVersions(latest, installed) <= 0) return;
        const target = { version: latest, apkUrl };
        if (await isSkipped(target)) return;
        targetRef.current = target;
        setVersion(latest);

        if (!(await canInstallPackages())) {
          // One-time "Install unknown apps" permission for Connect.
          if (await takeAttempt(latest)) {
            setPhase('permission');
            setVisible(true);
          }
          return;
        }
        if (await takeAttempt(latest)) startDownload();
      } catch (e) {
        console.warn('App update check failed:', e);
      }
    },
    [startDownload],
  );

  const checkForUpdate = React.useCallback(async () => {
    if (Date.now() - lastCheckRef.current < CHECK_INTERVAL_MS) return;
    lastCheckRef.current = Date.now();
    try {
      const res = await api.get('/connect/');
      if (res?.data && typeof res.data === 'object') setRemoteConfig(res.data);
    } catch (_) {
      lastCheckRef.current = 0;
    }
  }, []);

  React.useEffect(() => {
    if (!isAppUpdateSupported()) return;
    const initial = getRemoteConfig();
    if (initial) applyConfig(initial);
    const unsubscribeConfig = subscribeRemoteConfig(applyConfig);
    const removeProgress = addProgressListener(setProgress);
    const removeStatus = addStatusListener(status => {
      if (status === 'failed') setPhase('failed');
      else if (status === 'success') setVisible(false);
      else setPhase('installing');
    });

    checkForUpdate();
    const appStateSub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (awaitingPermissionRef.current) {
        // Back from the "Install unknown apps" screen.
        awaitingPermissionRef.current = false;
        canInstallPackages()
          .then(allowed => (allowed ? startDownload() : undefined))
          .catch(() => {});
        return;
      }
      checkForUpdate();
    });

    return () => {
      unsubscribeConfig();
      removeProgress();
      removeStatus();
      appStateSub.remove();
    };
  }, [applyConfig, checkForUpdate, startDownload]);

  const allowInstalls = React.useCallback(() => {
    awaitingPermissionRef.current = true;
    openInstallPermissionSettings().catch(() => {
      awaitingPermissionRef.current = false;
    });
  }, []);

  return {
    visible,
    phase,
    progress,
    version,
    dismiss: React.useCallback(() => setVisible(false), []),
    allowInstalls,
    retry: startDownload,
  };
}
