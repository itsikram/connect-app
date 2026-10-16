import { Alert, AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Android settings that decide whether the incoming call screen can pop up
 * while Connect is closed:
 * - fullScreenIntent: opens the call screen over the lock screen / when the
 *   screen is off. Granted by default before Android 14; on 14+ the user can
 *   turn it off (or it starts off).
 * - overlay ("Display over other apps"): opens the call screen while the
 *   phone is in use. Without it Android only shows a heads-up notification.
 * - xiaomi: MIUI / HyperOS also need "Show on Lock screen" and "Display
 *   pop-up windows while running in the background", which apps cannot read.
 */
export type IncomingCallScreenStatus = {
  fullScreenIntent: boolean;
  overlay: boolean;
  sdk: number;
  xiaomi?: boolean;
};

const ASKED_KEY_PREFIX = '@incoming_call_screen_asked_';
const DECLINED = 'declined';
// Pressed "Allow" but did not switch it on in Settings: ask again after this.
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function getIncomingCallScreenStatus(): Promise<IncomingCallScreenStatus | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const status = await NativeModules.CallNotificationModule?.getIncomingCallScreenStatus?.();
    return status || null;
  } catch (_) {
    return null;
  }
}

async function shouldAsk(key: string, retry: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ASKED_KEY_PREFIX + key);
    if (!raw) return true;
    if (raw === DECLINED || !retry) return false;
    return Date.now() - Number(raw) > RETRY_AFTER_MS;
  } catch (_) {
    return false;
  }
}

async function remember(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY_PREFIX + key, value);
  } catch (_) {}
}

function ask(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Allow', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Resolves once the user comes back from a Settings screen (or after a minute). */
function waitForReturnFromSettings(): Promise<void> {
  return new Promise((resolve) => {
    let leftApp = false;
    let finished = false;
    let sub: { remove: () => void } | null = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sub?.remove();
      resolve();
    };
    const timer = setTimeout(finish, 60 * 1000);
    sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        leftApp = true;
      } else if (leftApp) {
        finish();
      }
    });
  });
}

async function requestSetting(
  key: string,
  title: string,
  message: string,
  open: () => Promise<boolean> | undefined,
  // Ask again later if still missing. Off for settings the app cannot read back.
  retry = true,
): Promise<void> {
  if (!(await shouldAsk(key, retry))) return;
  const allow = await ask(title, message);
  if (!allow) {
    await remember(key, DECLINED);
    return;
  }
  await remember(key, String(Date.now()));
  try {
    if (await open()) {
      await waitForReturnFromSettings();
    }
  } catch (_) {}
}

/**
 * Ask for whatever is missing so a call can pop up the call screen while the
 * app is closed. Each setting is asked about once; "Not Now" is respected.
 */
export async function ensureIncomingCallScreenPermissions(): Promise<void> {
  const status = await getIncomingCallScreenStatus();
  if (!status) return;
  const native = NativeModules.CallNotificationModule;

  if (!status.fullScreenIntent) {
    await requestSetting(
      'full_screen_intent',
      'Show calls on your lock screen',
      'Allow Connect to use full-screen notifications so the call screen opens when someone calls you, even when the app is closed.',
      () => native?.openFullScreenIntentSettings?.(),
    );
  }

  if (!status.overlay) {
    await requestSetting(
      'overlay',
      'Show calls over other apps',
      'Turn on "Display over other apps" for Connect so the call screen pops up while you are using your phone, even when Connect is closed.',
      () => native?.openOverlaySettings?.(),
    );
  }

  if (status.xiaomi) {
    // Asked once: MIUI does not let apps check these switches.
    await requestSetting(
      'xiaomi_lock_screen',
      'Show calls on your lock screen',
      'On this phone, open "Other permissions" and allow "Show on Lock screen" and "Display pop-up windows while running in the background" so incoming calls appear when the phone is locked.',
      () => native?.openOemCallPermissions?.(),
      false,
    );
  }
}
