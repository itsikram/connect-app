import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

export interface MenuOption {
  id: string;
  label: string;
  icon?: string;
}

const Native = NativeModules.FloatingOverlay as {
  canDrawOverlays: () => Promise<boolean>;
  requestOverlayPermission: () => Promise<boolean>;
  startOverlay: () => Promise<boolean>;
  stopOverlay: () => Promise<boolean>;
  isServiceRunning: () => Promise<boolean>;
  setMenuOptions: (options: MenuOption[]) => Promise<boolean>;
} | undefined;

const eventEmitter = Native ? new NativeEventEmitter(NativeModules.FloatingOverlay) : null;

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

export async function isOverlayServiceRunning(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    return await Native.isServiceRunning();
  } catch (error) {
    return false;
  }
}

export async function setOverlayMenuOptions(options: MenuOption[]): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    // Check if service is running first
    const isRunning = await isOverlayServiceRunning();
    if (!isRunning) {
      console.warn('Overlay service is not running, cannot set menu options');
      return false;
    }
    return await Native.setMenuOptions(options);
  } catch (error) {
    // Extract error message properly for React Native promise rejections
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : error?.message || JSON.stringify(error) || 'Unknown error';
    console.error('Error setting overlay menu options:', errorMessage);
    return false;
  }
}

export function addOverlayMenuClickListener(listener: (optionId: string) => void): () => void {
  if (!eventEmitter) return () => {};
  
  const subscription = eventEmitter.addListener('FloatingOverlayMenuItemClick', (event: { optionId: string }) => {
    listener(event.optionId);
  });
  
  return () => {
    subscription.remove();
  };
}



