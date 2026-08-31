import { AppState } from 'react-native';
import api from './api';
import { idOf } from '../utils/optimisticMessage';

export function sameProfileId(a?: any, b?: any): boolean {
  const left = idOf(a);
  const right = idOf(b);
  return Boolean(left) && left === right;
}

export function isAppFocused(): boolean {
  return AppState.currentState === 'active';
}

/** Tell the caller's overlay the callee's device is ringing (works even if their socket emit is delayed). */
export async function notifyCallerRinging(callerId?: string): Promise<void> {
  const to = idOf(callerId);
  if (!to) return;
  try {
    await api.post('/notification/call/notify-ringing', { callerId: to });
  } catch (_) {}
}
