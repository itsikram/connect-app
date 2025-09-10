import { NativeModules, Platform } from 'react-native';

const Native = NativeModules.FloatingOverlay as {
  canDrawOverlays: () => Promise<boolean>;
  requestOverlayPermission: () => Promise<boolean>;
  startOverlay: () => Promise<boolean>;
  stopOverlay: () => Promise<boolean>;
} | undefined;

export async function ensureOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!Native) return false;
  const allowed = await Native.canDrawOverlays();
  if (allowed) return true;
  await Native.requestOverlayPermission();
  // user navigates to settings; can't confirm synchronously
  return false;
}

export async function startSystemOverlay(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  return Native.startOverlay();
}

export async function stopSystemOverlay(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  return Native.stopOverlay();
}



