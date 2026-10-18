import { NativeModules, Platform } from 'react-native';

/**
 * Android foreground service for a call in progress (OngoingCallService.kt).
 * Without it Android silences the microphone once the app is not visible, so
 * the other side heard nothing after the screen was turned off or the user
 * left the app mid-call. Start it while the app is on screen: when placing or
 * answering a call (Android refuses a microphone service started later from
 * the background). It stops when the call ends (callSession.setActiveCallKind).
 */

let running = false;

export function startOngoingCallService(options: { isVideo: boolean; peerName?: string }): void {
  if (Platform.OS !== 'android') return;
  const native = NativeModules.CallNotificationModule;
  if (!native?.startOngoingCall) return;
  // Callers start it after an async permission check; the call may have
  // ended meanwhile. Required lazily: callSession imports this module.
  const { getActiveCallKind } = require('./callSession');
  const kind = getActiveCallKind();
  if (kind !== 'audio' && kind !== 'video') return;
  running = true;
  native
    .startOngoingCall({ isVideo: options.isVideo, peerName: options.peerName || null })
    .catch(() => {});
}

export function stopOngoingCallService(): void {
  if (Platform.OS !== 'android' || !running) return;
  running = false;
  NativeModules.CallNotificationModule?.stopOngoingCall?.()?.catch?.(() => {});
}
