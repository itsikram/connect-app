import { NativeModules, Platform } from 'react-native';

/**
 * Tells Android when a call screen is on display, so it stays above the lock
 * screen (LockScreenCallMode.kt) while ringing or in a call, and stops once
 * the call ends or is minimized to the call bar.
 */

let callActive = false;
let callMinimized = false;
// Starts false so nothing is sent until a call screen has actually been up:
// a call that opened the app from the lock screen must not be released
// before its screen appears.
let lastSent = false;

function native() {
  return Platform.OS === 'android' ? NativeModules.CallNotificationModule : null;
}

function sync(): void {
  const next = callActive && !callMinimized;
  if (next === lastSent) return;
  lastSent = next;
  try {
    native()?.setCallScreenActive?.(next)?.catch?.(() => {});
  } catch (_) {}
}

/** An audio or video call (incoming, outgoing or connected) is in progress. */
export function setLockScreenCallActive(active: boolean): void {
  callActive = active;
  sync();
}

/** The call is minimized to the call bar, so the rest of the app is on screen. */
export function setLockScreenCallMinimized(minimized: boolean): void {
  callMinimized = minimized;
  sync();
}

/** Keep the display on while an incoming call rings. */
export function setLockScreenCallRinging(ringing: boolean): void {
  try {
    native()?.setIncomingCallRinging?.(ringing)?.catch?.(() => {});
  } catch (_) {}
}
