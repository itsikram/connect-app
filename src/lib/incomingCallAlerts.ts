import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ANDROID_INCOMING_CALL_CHANNEL_ID } from './notificationChannelIds';
import { playIncomingRingtone, stopIncomingRingtone } from './callRingtone';
import {
  getIncomingCallChannelId,
  getRingtoneSoundName,
  getStoredRingtoneId,
  MAX_RINGTONE_ID,
  normalizeRingtoneId,
} from './ringtoneAssets';

export const INCOMING_CALL_CATEGORY = 'incoming_call';
const LEGACY_CALL_CHANNELS = ['incoming_calls', 'incoming_calls_v3', ANDROID_INCOMING_CALL_CHANNEL_ID];

const CALL_AUDIO_ATTRIBUTES: Notifications.AudioAttributesInput = {
  usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
  contentType: Notifications.AndroidAudioContentType.SONIFICATION,
  flags: {
    enforceAudibility: true,
    requestHardwareAudioVideoSynchronization: false,
  },
};

let presentedNotificationId: string | null = null;
let lastPresentedChannel: string | null = null;
let lastPresentedAt = 0;
let ringingPayload: {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  ringtoneId?: string;
} | null = null;
let appStateSub: { remove: () => void } | null = null;

function callNotificationId(channelName?: string) {
  return `incoming_call_${channelName || 'active'}`;
}

function allCallChannelIds() {
  const ringtoneChannels = Array.from({ length: MAX_RINGTONE_ID }, (_, i) =>
    getIncomingCallChannelId(String(i + 1)),
  );
  return [...new Set([...LEGACY_CALL_CHANNELS, ...ringtoneChannels])];
}

async function displayAndroidCallForegroundNotification(payload: {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  ringtoneId?: string;
}): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const mod = await import('./callNotificationService');
    const service = mod.callNotificationService;
    if (!service?.displayIncomingCallNotification) return false;
    await service.displayIncomingCallNotification({
      callerId: payload.callerId,
      callerName: payload.callerName || 'Someone',
      callerProfilePic: payload.callerProfilePic,
      channelName: payload.channelName,
      isAudio: payload.isAudio,
      ringtoneId: payload.ringtoneId,
    });
    return true;
  } catch (error) {
    console.warn('Android call foreground notification failed', error);
    return false;
  }
}

async function cancelAndroidCallForegroundNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const mod = await import('./callNotificationService');
    await mod.callNotificationService?.cancelIncomingCallNotification?.();
  } catch (_) {}
}

function ensureAppStateWatch() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active' || !ringingPayload) return;
    // Android pauses in-app audio unless a foreground service is running.
    // Re-post the sticky call notification and restart the ringtone.
    presentIncomingCallNotification(ringingPayload, { force: true }).catch(() => {});
    playIncomingRingtone(ringingPayload.ringtoneId).catch(() => {});
    displayAndroidCallForegroundNotification(ringingPayload).catch(() => {});
  });
}

async function createCallChannel(id: string, sound: string) {
  await Notifications.setNotificationChannelAsync(id, {
    name: 'Incoming Calls',
    description: 'Incoming audio and video calls',
    importance: Notifications.AndroidImportance.MAX,
    sound,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#E53935',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    showBadge: true,
    audioAttributes: CALL_AUDIO_ATTRIBUTES,
  });
}

export async function configureIncomingCallChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    for (let i = 1; i <= MAX_RINGTONE_ID; i += 1) {
      const id = String(i);
      try {
        await createCallChannel(getIncomingCallChannelId(id), getRingtoneSoundName(id));
      } catch (error) {
        console.warn('Failed to create call channel', getIncomingCallChannelId(id), error);
      }
    }

    const selectedId = await getStoredRingtoneId();
    const selectedSound = getRingtoneSoundName(selectedId);
    for (const id of LEGACY_CALL_CHANNELS) {
      try {
        await createCallChannel(id, selectedSound);
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

export async function presentIncomingCallNotification(
  payload: {
    callerId: string;
    callerName?: string;
    callerProfilePic?: string;
    channelName: string;
    isAudio: boolean;
    ringtoneId?: string;
  },
  options?: { force?: boolean },
): Promise<void> {
  const channelName = payload.channelName || '';
  const now = Date.now();
  if (!options?.force && lastPresentedChannel === channelName && now - lastPresentedAt < 4000) {
    return;
  }
  lastPresentedChannel = channelName;
  lastPresentedAt = now;

  const ringtoneId = normalizeRingtoneId(payload.ringtoneId || (await getStoredRingtoneId()));
  const identifier = callNotificationId(channelName);
  presentedNotificationId = identifier;

  const title = payload.isAudio ? 'Incoming audio call' : 'Incoming video call';
  const body = `${payload.callerName || 'Someone'} is calling`;
  const soundName = getRingtoneSoundName(ringtoneId);

  try {
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        sound: Platform.OS === 'ios' ? `${soundName}.mp3` : soundName,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: INCOMING_CALL_CATEGORY,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: getIncomingCallChannelId(ringtoneId),
        data: {
          type: 'incoming_call',
          callerId: payload.callerId,
          callerName: payload.callerName || '',
          callerProfilePic: payload.callerProfilePic || '',
          channelName,
          isAudio: payload.isAudio ? 'true' : 'false',
          ringtoneId,
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
 * - Loop the user's selected ringtone in-app (iOS background audio + Android FGS).
 * - Always post a high-priority OS notification so the call still alerts when
 *   the app is backgrounded or the screen is locked.
 */
export async function startIncomingCallAlert(payload: {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  ringtoneId?: string;
}): Promise<void> {
  const ringtoneId = normalizeRingtoneId(payload.ringtoneId || (await getStoredRingtoneId()));
  ringingPayload = { ...payload, ringtoneId };
  ensureAppStateWatch();
  playIncomingRingtone(ringtoneId).catch(() => {});

  const usedAndroidForeground = await displayAndroidCallForegroundNotification(ringingPayload);
  if (!usedAndroidForeground) {
    await presentIncomingCallNotification(ringingPayload, { force: true });
  }
}

export async function stopIncomingCallAlert(channelName?: string): Promise<void> {
  ringingPayload = null;
  lastPresentedChannel = null;
  lastPresentedAt = 0;
  await stopIncomingRingtone();
  await cancelAndroidCallForegroundNotification();
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
    ringtoneId: normalizeRingtoneId(data.ringtoneId),
  };
}

export { allCallChannelIds };
