import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IncomingCallPushDetail, emitIncomingCallFromPush, emitRejectCallFromPush } from './callEvents';

const STORAGE_KEY = '@pending_incoming_call';
const STALE_MS = 90 * 1000;

export type PendingIncomingCall = IncomingCallPushDetail & {
  action?: string;
  declined?: boolean;
};

function normalizePending(raw: any): PendingIncomingCall | null {
  if (!raw) return null;
  const from = String(raw.from || raw.callerId || '');
  const channelName = String(raw.channelName || '');
  if (!from || !channelName) return null;
  const ts = Number(raw.ts || Date.now());
  if (Date.now() - ts > STALE_MS) return null;
  const isAudio = raw.isAudio !== false && raw.isAudio !== 'false';
  return {
    from,
    channelName,
    callerName: raw.callerName,
    callerProfilePic: raw.callerProfilePic,
    isAudio,
    autoAccept: Boolean(raw.autoAccept) || raw.action === 'accept_call',
    ringtoneId: raw.ringtoneId,
    action: raw.action,
    declined: Boolean(raw.declined) || raw.action === 'decline_call',
  };
}

export async function persistPendingIncomingCall(detail: PendingIncomingCall): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...detail, ts: Date.now() }),
    );
  } catch (_) {}
}

export async function consumePendingIncomingCall(): Promise<PendingIncomingCall | null> {
  let stored: PendingIncomingCall | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      stored = normalizePending(JSON.parse(raw));
    }
  } catch (_) {}
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (_) {}

  if (Platform.OS === 'android') {
    try {
      const native = NativeModules.CallNotificationModule;
      if (native?.getPendingCallAction) {
        const pending = await native.getPendingCallAction();
        const fromNative = normalizePending(pending);
        if (fromNative) return fromNative;
      }
    } catch (_) {}
  }

  return stored;
}

export function dispatchPendingIncomingCall(pending: PendingIncomingCall): void {
  if (pending.declined) {
    emitRejectCallFromPush(pending);
    return;
  }
  emitIncomingCallFromPush(pending);
}
