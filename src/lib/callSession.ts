/** Process-wide lock so audio and video overlays cannot both join at once. */
import { DeviceEventEmitter } from 'react-native';
import { setLockScreenCallActive } from './lockScreenCall';
import { stopOngoingCallService } from './ongoingCall';

export type ActiveCallKind = 'audio' | 'video' | 'liveVoice';

let activeCallKind: ActiveCallKind | null = null;

export function isCallBusy(): boolean {
  return activeCallKind != null;
}

export function getActiveCallKind(): ActiveCallKind | null {
  return activeCallKind;
}

export function setActiveCallKind(kind: ActiveCallKind | null): void {
  activeCallKind = kind;
  setLockScreenCallActive(kind === 'audio' || kind === 'video');
  if (kind == null) stopOngoingCallService();
  DeviceEventEmitter.emit('communication-session-active', kind != null);
}

/**
 * Ends the busy state only if `kind` holds it. An overlay cleaning up must not
 * end another one's call (that also stopped the service keeping its
 * microphone alive with the screen off).
 */
export function clearActiveCallKind(kind: ActiveCallKind): void {
  if (activeCallKind === kind) setActiveCallKind(null);
}

/*
 * Calls this device already answered, declined or saw end, by channel. A late
 * push, a notification tapped later or a call saved for a cold start can
 * deliver the same incoming call again: it must not ring again or touch the
 * call in progress. Each call has its own channel; older apps reuse one per
 * pair, so the server's incoming-call event (always a new call) clears it.
 */
const HANDLED_CALL_TTL_MS = 3 * 60 * 1000;
// `${caller}-${callee}` from older apps can carry a genuine redial soon after
// (one that only arrives by push), so such a channel is remembered briefly.
const REUSED_CHANNEL_TTL_MS = 20 * 1000;
const handledCalls = new Map<string, number>();

// Profile ids contain no "-": per-call channels have a third part.
const handledCallTtl = (channelName: string) =>
  channelName.split('-').length >= 3 ? HANDLED_CALL_TTL_MS : REUSED_CHANNEL_TTL_MS;

export function markCallHandled(channelName?: string | null): void {
  if (!channelName) return;
  const now = Date.now();
  handledCalls.forEach((at, key) => {
    if (now - at > HANDLED_CALL_TTL_MS) handledCalls.delete(key);
  });
  handledCalls.set(String(channelName), now);
}

export function wasCallHandled(channelName?: string | null): boolean {
  if (!channelName) return false;
  const at = handledCalls.get(String(channelName));
  return at != null && Date.now() - at <= handledCallTtl(String(channelName));
}

export function forgetHandledCall(channelName?: string | null): void {
  if (channelName) handledCalls.delete(String(channelName));
}

/**
 * A new Agora channel for every call (the web app does the same). Reusing
 * `${caller}-${callee}` for every call between two people let a late event of
 * an earlier call end the next one. 24-char ids stay under Agora's 64 bytes.
 */
export function newCallChannelName(myId: string, peerId: string): string {
  return `${myId}-${peerId}-${Date.now().toString(36)}`;
}
