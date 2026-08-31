import * as Notifications from 'expo-notifications';
import {
  parseIncomingCallNotificationData,
  stopIncomingCallAlert,
} from './incomingCallAlerts';
import { emitIncomingCallFromPush, emitRejectCallFromPush } from './callEvents';
import { notifyCallerRinging } from './callStatus';
import { persistPendingIncomingCall } from './pendingIncomingCall';
import api from './api';

export function isDeclineAction(actionId?: string | null): boolean {
  const id = String(actionId || '');
  return (
    id === 'reject_call' ||
    id === 'decline_call' ||
    id.endsWith('reject_call') ||
    id.endsWith('decline_call')
  );
}

export function isAcceptAction(actionId?: string | null): boolean {
  const id = String(actionId || '');
  return id === 'accept_call' || id.endsWith('accept_call');
}

export async function rejectIncomingCallViaApi(payload: {
  from?: string;
  callerId?: string;
  channelName?: string;
  isAudio?: boolean | string;
}): Promise<void> {
  const callerId = String(payload.from || payload.callerId || '');
  const channelName = String(payload.channelName || '');
  if (!callerId || !channelName) return;
  try {
    await api.post('/notification/call/reject-push', {
      callerId,
      channelName,
      isAudio: payload.isAudio === true || payload.isAudio === 'true' ? 'true' : 'false',
    });
  } catch (_) {}
}

export async function handleIncomingCallNotificationAction(
  data: any,
  actionId?: string | null,
): Promise<void> {
  const parsed = parseIncomingCallNotificationData(data) || {
    from: String(data?.callerId || data?.from || ''),
    channelName: String(data?.channelName || ''),
    callerName: data?.callerName,
    callerProfilePic: data?.callerProfilePic,
    isAudio: data?.isAudio === true || data?.isAudio === 'true',
    autoAccept: false,
    ringtoneId: data?.ringtoneId,
  };
  if (!parsed.from || !parsed.channelName) return;

  if (isDeclineAction(actionId)) {
    await persistPendingIncomingCall({ ...parsed, declined: true, action: 'decline_call' });
    await stopIncomingCallAlert(parsed.channelName);
    await rejectIncomingCallViaApi(parsed);
    emitRejectCallFromPush(parsed);
    try {
      const notifeeModule = require('@notifee/react-native');
      await notifeeModule.default?.stopForegroundService?.();
    } catch (_) {}
    return;
  }

  const autoAccept = isAcceptAction(actionId);
  await persistPendingIncomingCall({
    ...parsed,
    autoAccept,
    action: autoAccept ? 'accept_call' : 'open',
  });
  notifyCallerRinging(parsed.from);
  emitIncomingCallFromPush({
    ...parsed,
    autoAccept,
  });
}

export function notifeeActionId(detail: any): string | undefined {
  return detail?.pressAction?.id || detail?.pressAction?.identifier;
}

export function expoActionId(response: Notifications.NotificationResponse): string {
  return response.actionIdentifier || '';
}
