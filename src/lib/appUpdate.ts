import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

// Android self-update (android/.../update/AppUpdateModule.kt). The latest
// version and APK link are set in admin → Settings → General.
const AppUpdate = Platform.OS === 'android' ? NativeModules.AppUpdate : null;
// Runs while the app starts, so a problem here must never close the app.
let emitter: NativeEventEmitter | null = null;
try {
  emitter = AppUpdate ? new NativeEventEmitter(AppUpdate) : null;
} catch (error) {
  console.warn('App update events unavailable:', error);
}

export type InstallStatus =
  | 'installing'
  | 'pending_user_action'
  | 'success'
  | 'failed';

export const isAppUpdateSupported = (): boolean => !!AppUpdate;

/** Compares 1.2.3-style versions; non-numeric suffixes are ignored. */
export function compareVersions(a: string, b: string): number {
  const toNums = (v: string) =>
    (v || '')
      .split('.')
      .map(part => parseInt(String(part).replace(/[^0-9].*$/, ''), 10) || 0);
  const aa = toNums(a);
  const bb = toNums(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const x = aa[i] || 0;
    const y = bb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** versionName of the installed APK (not the JS bundle). */
export async function getInstalledVersion(): Promise<string> {
  const info = await AppUpdate.getInstalledVersion();
  return String(info?.versionName || '0.0.0');
}

export const canInstallPackages = (): Promise<boolean> =>
  AppUpdate.canInstallPackages();

export const openInstallPermissionSettings = (): Promise<boolean> =>
  AppUpdate.openInstallPermissionSettings();

/**
 * Downloads the APK and starts installing it. Rejects with code "not_newer"
 * when the APK is not newer than the installed build.
 */
export const downloadAndInstall = (
  apkUrl: string,
  version: string,
): Promise<boolean> => AppUpdate.downloadAndInstall(apkUrl, version);

export function addProgressListener(cb: (progress: number) => void) {
  const sub = emitter?.addListener('AppUpdateProgress', e =>
    cb(Number(e?.progress) || 0),
  );
  return () => sub?.remove();
}

export function addStatusListener(
  cb: (status: InstallStatus, message?: string) => void,
) {
  const sub = emitter?.addListener('AppUpdateStatus', e =>
    cb(e?.status, e?.message),
  );
  return () => sub?.remove();
}
