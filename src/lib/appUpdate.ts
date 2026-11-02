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

export type AppInfo = {
  packageName: string;
  versionName: string;
  versionCode: number;
  firstInstallTime: number;
  lastUpdateTime: number;
  targetSdk: number;
  minSdk: number;
  /** Package that installed Connect, e.g. a browser, file manager or Connect itself. */
  installer: string | null;
  /** Native code folder in use: arm64, arm, x86 or x86_64. */
  abi: string;
  supportedAbis: string[];
  /** Memory page size: 4096 on most phones, 16384 on newer ones. */
  pageSize: number;
};

/** Install details for the About screen; null where the native module is missing. */
export async function getAppInfo(): Promise<AppInfo | null> {
  if (!AppUpdate?.getAppInfo) return null;
  const info = await AppUpdate.getAppInfo();
  return {
    ...info,
    versionCode: Number(info?.versionCode) || 0,
    firstInstallTime: Number(info?.firstInstallTime) || 0,
    lastUpdateTime: Number(info?.lastUpdateTime) || 0,
    supportedAbis: Array.isArray(info?.supportedAbis) ? info.supportedAbis : [],
  };
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
  cb: (status: InstallStatus, message?: string, code?: number) => void,
) {
  const sub = emitter?.addListener('AppUpdateStatus', e =>
    cb(e?.status, e?.message, typeof e?.code === 'number' ? e.code : undefined),
  );
  return () => sub?.remove();
}

/**
 * Plain-language reason for a failed download or install. [code] is
 * Android's PackageInstaller.STATUS_* of the install session.
 */
export function describeUpdateError(message?: string, code?: number): string {
  const text = String(message || '');
  if (code === 3 || /ABORTED|cancel/i.test(text)) {
    return 'The install was cancelled.';
  }
  if (/UPDATE_INCOMPATIBLE|signatures? do not match|INCONSISTENT_CERTIFICATES/i.test(text)) {
    return 'This update is signed differently from the Connect app on this phone. Uninstall Connect, then install it again from the website.';
  }
  if (code === 6 || /INSUFFICIENT_STORAGE|No space|ENOSPC/i.test(text)) {
    return 'Not enough free storage. Free up some space and try again.';
  }
  if (/NO_MATCHING_ABIS/i.test(text)) {
    return "This phone's processor is not supported by this update.";
  }
  if (/OLDER_SDK/i.test(text)) {
    return 'This update needs a newer version of Android.';
  }
  if (/VERSION_DOWNGRADE/i.test(text)) {
    return 'The update is older than the installed app.';
  }
  if (code === 2 || /BLOCKED|USER_RESTRICTED|VERIFICATION/i.test(text)) {
    return 'The phone or its security app blocked the install. Allow it, or install the update from the website.';
  }
  if (code === 4 || /not a valid APK|PARSE_FAILED|INVALID/i.test(text)) {
    return 'The downloaded file is damaged or not a valid app. Try again later.';
  }
  if (/HTTP|timeout|Unable to resolve host|failed to connect|Download incomplete/i.test(text)) {
    return 'The download failed. Check your internet connection and try again.';
  }
  return text || 'Something went wrong.';
}
