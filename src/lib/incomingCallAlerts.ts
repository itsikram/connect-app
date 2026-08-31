import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ANDROID_INCOMING_CALL_CHANNEL_ID } from './notificationChannelIds';
import { playIncomingRingtone, stopIncomingRingtone } from './callRingtone';

export const INCOMING_CALL_CATEGORY = 'incoming_call';
const CALL_CHANNELS = ['incoming_calls', 'incoming_calls_v3', ANDROID_INCOMING_CALL_CHANNEL_ID];

let presentedNotificationId: string | null = null;
let lastPresentedChannel: string | null = null;
let lastPresentedAt = 0;
let ringingPayload: {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
} | null = null;
let appStateSub: { remove: () => void } | null = null;

function callNotificationId(channelName?: string) {
  return `incoming_call_${channelName || 'active'}`;
}

function ensureAppStateWatch() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state !== 'active' && ringingPayload) {
      presentIncomingCallNotification(ringingPayload).catch(() => {});
      playIncomingRingtone().catch(() => {});
    }
  });
}

export async function configureIncomingCallChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    const channelConfig: Notifications.NotificationChannelInput = {
      name: 'Incoming Calls',
      description: 'Incoming audio and video calls',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#E53935',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    };
    for (const id of CALL_CHANNELS) {
      try {
        await Notifications.setNotificationChannelAsync(id, channelConfig);
      } catch (error) {
        console.warn('Failed to create call channel', id, error);
      }
    }
  }

  try {
    await Notifications.setNotificationCategoryAsync(INCOMING_CALL_CATEGORY, [
      {
        identifier: 'accept_call',
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'reject_call',
        buttonTitle: 'Decline',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch (error) {
    console.warn('Failed to set incoming call category', error);
  }
}

export async function presentIncomingCallNotification(payload: {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
}): Promise<void> {
  const channelName = payload.channelName || '';
  const now = Date.now();
  if (lastPresentedChannel === channelName && now - lastPresentedAt < 4000) {
    return;
  }
  lastPresentedChannel = channelName;
  lastPresentedAt = now;

  const identifier = callNotificationId(channelName);
  presentedNotificationId = identifier;

  const title = payload.isAudio ? 'Incoming audio call' : 'Incoming video call';
  const body = `${payload.callerName || 'Someone'} is calling`;

  try {
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        sound: true,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: INCOMING_CALL_CATEGORY,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: ANDROID_INCOMING_CALL_CHANNEL_ID,
        data: {
          type: 'incoming_call',
          callerId: payload.callerId,
          callerName: payload.callerName || '',
          callerProfilePic: payload.callerProfilePic || '',
          channelName,
          isAudio: payload.isAudio ? 'true' : 'false',
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('presentIncomingCallNotification failed', error);
  }
}

export async function cancelIncomingCallNotifications(channelName?: string): Promise<void> {
  try {
    if (channelName) {
      await Notifications.dismissNotificationAsync(callNotificationId(channelName)).catch(() => {});
    }
    if (presentedNotificationId) {
      await Notifications.dismissNotificationAsync(presentedNotificationId).catch(() => {});
      presentedNotificationId = null;
    }
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => (n.request.content.data as any)?.type === 'incoming_call')
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch (error) {
    console.warn('cancelIncomingCallNotifications failed', error);
  }
}

/**
 * Ring the device for an incoming call:
 * - Always try looping in-app audio (works in foreground; may continue briefly in background).
 * - When the app is not focused, also post a high-priority OS notification so iOS/Android
 *   play the system call sound even after JS is suspended.
 */
export async function startIncomingCallAlert(payload: {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
}): Promise<void> {
  ringingPayload = payload;
  ensureAppStateWatch();
  playIncomingRingtone().catch(() => {});

  const focused = AppState.currentState === 'active';
  if (!focused) {
    await presentIncomingCallNotification(payload);
  }
}

export async function stopIncomingCallAlert(channelName?: string): Promise<void> {
  ringingPayload = null;
  await stopIncomingRingtone();
  await cancelIncomingCallNotifications(channelName);
}

export function parseIncomingCallNotificationData(data: any) {
  if (!data || data.type !== 'incoming_call') return null;
  return {
    from: String(data.callerId || data.from || ''),
    channelName: String(data.channelName || ''),
    callerName: data.callerName || 'Someone',
    callerProfilePic: data.callerProfilePic || '',
    isAudio: data.isAudio === true || data.isAudio === 'true',
    autoAccept: Boolean(data.autoAccept),
  };
}
