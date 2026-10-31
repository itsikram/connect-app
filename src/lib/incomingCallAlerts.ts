import { AppState, AppStateStatus, NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ANDROID_INCOMING_CALL_CHANNEL_ID } from './notificationChannelIds';
import {
  isIncomingRingtonePlaying,
  playIncomingRingtone,
  stopIncomingRingtone,
} from './callRingtone';
import {
  getIncomingCallChannelId,
  getRingtoneSoundName,
  getStoredRingtoneId,
  MAX_RINGTONE_ID,
  normalizeRingtoneId,
} from './ringtoneAssets';
import { getIncomingCallOsSound } from './expoGo';
import { setLockScreenCallRinging } from './lockScreenCall';
import { wasCallHandled } from './callSession';

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

type RingingPayload = {
  callerId: string;
  callerName?: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  ringtoneId?: string;
};

let presentedNotificationId: string | null = null;
let ringingPayload: RingingPayload | null = null;
let appStateSub: { remove: () => void } | null = null;
let appStateTimer: ReturnType<typeof setTimeout> | null = null;
let alertToken = 0;

function callNotificationId(channelName?: string) {
  return `incoming_call_${channelName || 'active'}`;
}

function allCallChannelIds() {
  const ringtoneChannels = Array.from({ length: MAX_RINGTONE_ID }, (_, i) =>
    getIncomingCallChannelId(String(i + 1)),
  );
  return [...new Set([...LEGACY_CALL_CHANNELS, ...ringtoneChannels])];
}

function sameCall(a: RingingPayload | null, b: RingingPayload): boolean {
  if (!a) return false;
  return a.channelName === b.channelName && a.callerId === b.callerId;
}

function stopAfterRingtoneError(error: unknown): void {
  console.error('Incoming call ringtone failed:', error);
  stopIncomingCallAlert().catch((stopError) => {
    console.error('Failed to stop incoming call ringtone after error:', stopError);
  });
}

/**
 * Android: the in-app ringtone could not play. Ring natively instead of
 * stopping the whole alert, which used to leave the call ringing silently.
 */
function onAndroidRingtoneError(error: unknown, payload: RingingPayload): void {
  console.error('Incoming call ringtone failed, ringing natively:', error);
  if (!ringingPayload || !sameCall(ringingPayload, payload)) return;
  showNativeIncomingCall(payload, false).then((shown) => {
    if (!shown) stopAfterRingtoneError(error);
  });
}

/**
 * App on screen: play the in-app ringtone. A native ring still going for this
 * call (it arrived while the app was closed or in the background) stops only
 * once the in-app one has started, so there is no silent gap.
 */
function playInAppRingtone(payload: RingingPayload): void {
  if (Platform.OS !== 'android') {
    playIncomingRingtone(payload.ringtoneId).catch(stopAfterRingtoneError);
    return;
  }
  playIncomingRingtone(payload.ringtoneId)
    .then(() => {
      if (ringingPayload && sameCall(ringingPayload, payload)) {
        return stopNativeIncomingCallRing();
      }
      return undefined;
    })
    .catch((error) => onAndroidRingtoneError(error, payload));
}

/**
 * Ring with IncomingCallRingService (MediaPlayer in a foreground service,
 * call-style notification, full-screen call screen). Unlike the in-app
 * ringtone or a Notifee foreground service it keeps ringing in the background
 * and on the lock screen, and falls back to a self-ringing notification when
 * Android will not start a foreground service from the background.
 */
async function showNativeIncomingCall(payload: RingingPayload, fullScreen: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const native = NativeModules.CallNotificationModule;
  if (!native?.showNativeIncomingCall) return false;
  try {
    const shown = await native.showNativeIncomingCall(
      {
        callerId: payload.callerId,
        callerName: payload.callerName || 'Someone',
        callerProfilePic: payload.callerProfilePic || '',
        channelName: payload.channelName,
        isAudio: payload.isAudio,
        ringtoneId: payload.ringtoneId || '1',
      },
      fullScreen,
    );
    return shown !== false;
  } catch (error) {
    console.warn('Native incoming call ring failed', error);
    return false;
  }
}

async function displayAndroidCallForegroundNotification(payload: RingingPayload): Promise<boolean> {
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

/**
 * A call that arrived while the app was closed rings natively
 * (IncomingCallRingService) and keeps ringing while the app starts. Stop it
 * once the JS call screen rings, or when the call is answered / ends.
 */
async function stopNativeIncomingCallRing(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await NativeModules.CallNotificationModule?.cancelNativeIncomingCall?.();
  } catch (_) {}
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
    if (appStateTimer) clearTimeout(appStateTimer);
    appStateTimer = setTimeout(() => {
      const payload = ringingPayload;
      if (!payload) return;
      if (state === 'active') {
        cancelAndroidCallForegroundNotification().catch(() => {});
        playInAppRingtone(payload);
        return;
      }
      if (Platform.OS === 'ios') {
        playIncomingRingtone(payload.ringtoneId).catch(stopAfterRingtoneError);
        presentIncomingCallNotification(payload).catch(() => {});
        return;
      }
      // Left the ringing call screen (home button, screen locked): the in-app
      // ringtone stops in the background, so keep ringing natively. No
      // full-screen pop-up: that would turn the screen straight back on.
      stopIncomingRingtone().catch(() => {});
      showNativeIncomingCall(payload, false).then((shown) => {
        if (!shown) displayAndroidCallForegroundNotification(payload).catch(() => {});
      });
    }, 250);
  });
}

async function createCallChannel(id: string, sound: string) {
  await Notifications.setNotificationChannelAsync(id, {
    name: 'Incoming Calls',
    description: 'Incoming audio and video calls',
    importance: Notifications.AndroidImportance.MAX,
    sound,
    vibrationPattern: [100, 400, 200, 400, 200, 400],
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

export async function presentIncomingCallNotification(payload: RingingPayload): Promise<void> {
  const channelName = payload.channelName || '';
  const ringtoneId = normalizeRingtoneId(payload.ringtoneId || (await getStoredRingtoneId()));
  const identifier = callNotificationId(channelName);
  presentedNotificationId = identifier;

  const title = payload.isAudio ? 'Incoming audio call' : 'Incoming video call';
  const body = `${payload.callerName || 'Someone'} is calling`;
  const osSound = getIncomingCallOsSound(ringtoneId);
  const inForeground = AppState.currentState === 'active';
  const ringtoneAlreadyPlaying = isIncomingRingtonePlaying();

  try {
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        sound: inForeground || ringtoneAlreadyPlaying ? undefined : osSound,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: INCOMING_CALL_CATEGORY,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
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
 * Ring for an incoming call:
 * - Foreground: one looping in-app ringtone (no OS notification sound).
 * - iOS / Expo Go background: keep the audio player looping + banner.
 * - Android background / locked: native ring (IncomingCallRingService), with
 *   Notifee and then a plain notification as fallbacks.
 */
export async function startIncomingCallAlert(payload: RingingPayload): Promise<void> {
  // Already answered, declined or over here: a push that arrived late (FCM
  // can lag the socket by seconds) used to ring again in the middle of the
  // call it announced.
  if (wasCallHandled(payload.channelName)) return;
  const token = ++alertToken;
  const ringtoneId = normalizeRingtoneId(payload.ringtoneId || (await getStoredRingtoneId()));
  const next = { ...payload, ringtoneId };
  const inForeground = AppState.currentState === 'active';
  if (token !== alertToken) return;

  if (sameCall(ringingPayload, next)) {
    if (!isIncomingRingtonePlaying() && (inForeground || Platform.OS === 'ios')) {
      playInAppRingtone(next);
    }
    return;
  }

  ringingPayload = next;
  ensureAppStateWatch();
  setLockScreenCallRinging(true);

  if (Platform.OS === 'ios') {
    await playIncomingRingtone(ringtoneId);
    if (token !== alertToken || !ringingPayload || !sameCall(ringingPayload, next)) return;
    if (!inForeground) {
      await presentIncomingCallNotification(next);
    }
    return;
  }

  if (token !== alertToken || !ringingPayload || !sameCall(ringingPayload, next)) return;

  if (inForeground) {
    playInAppRingtone(next);
    return;
  }

  // A Notifee foreground service cannot start from the background (Android
  // 12+) without a push in flight, so a call that reached JS over the socket
  // while the app was backgrounded or the screen locked never rang.
  if (await showNativeIncomingCall(next, true)) return;
  if (token !== alertToken || !ringingPayload || !sameCall(ringingPayload, next)) return;
  const usedAndroidForeground = await displayAndroidCallForegroundNotification(next);
  if (!usedAndroidForeground) {
    await presentIncomingCallNotification(next);
  }
}

export async function stopIncomingCallAlert(channelName?: string): Promise<void> {
  alertToken += 1;
  ringingPayload = null;
  setLockScreenCallRinging(false);
  if (appStateTimer) {
    clearTimeout(appStateTimer);
    appStateTimer = null;
  }
  await stopIncomingRingtone();
  await stopNativeIncomingCallRing();
  await cancelAndroidCallForegroundNotification();
  await cancelIncomingCallNotifications(channelName);
}

/**
 * A push or notification for a call that was already handled here started a
 * ring (natively, or its notification is up): stop it, without silencing a
 * different call that is ringing right now.
 */
export async function stopRingingForHandledCall(channelName?: string): Promise<void> {
  if (ringingPayload && channelName && ringingPayload.channelName !== channelName) {
    await Notifications.dismissNotificationAsync(callNotificationId(channelName)).catch(() => {});
    return;
  }
  await stopIncomingCallAlert(channelName);
}

export function parseIncomingCallNotificationData(data: any) {
  if (!data) return null;
  const type = data.type || data.event;
  if (type && type !== 'incoming_call') return null;
  const from = String(data.callerId || data.from || '');
  const channelName = String(data.channelName || '');
  if (!from && !channelName) return null;
  return {
    from,
    channelName,
    callerName: data.callerName || 'Someone',
    callerProfilePic: data.callerProfilePic || '',
    isAudio: data.isAudio === true || data.isAudio === 'true',
    autoAccept: Boolean(data.autoAccept),
    ringtoneId: normalizeRingtoneId(data.ringtoneId),
  };
}

export { allCallChannelIds };
