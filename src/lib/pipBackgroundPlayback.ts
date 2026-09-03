import { AppState, AppStateStatus, Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, AVPlaybackStatus } from './avCompat';

const PLAYBACK_CHANNEL = 'pip-playback';
const PLAYBACK_NOTIFICATION_ID = 'pip-playback';

let notifee: any = null;
let AndroidImportance: any = null;
let AndroidCategory: any = null;
let AndroidForegroundServiceType: any = null;

try {
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default;
  AndroidImportance = notifeeModule.AndroidImportance;
  AndroidCategory = notifeeModule.AndroidCategory;
  AndroidForegroundServiceType = notifeeModule.AndroidForegroundServiceType;
} catch (_) {}

export const configurePipAudioMode = async () => {
  try {
    await Audio.setIsEnabledAsync(true);
  } catch (_) {}
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};

const showPlaybackNotification = async (title?: string) => {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.requestPermission();
    await notifee.createChannel({
      id: PLAYBACK_CHANNEL,
      name: 'Now playing',
      importance: AndroidImportance?.LOW ?? 2,
      vibration: false,
      sound: undefined,
    });
    const fgType =
      AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
    await notifee.displayNotification({
      id: PLAYBACK_NOTIFICATION_ID,
      title: title || 'Connect Watch',
      body: 'Playing in the background',
      android: {
        channelId: PLAYBACK_CHANNEL,
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        pressAction: { id: 'default' },
        category: AndroidCategory?.TRANSPORT,
        ...(fgType != null ? { foregroundServiceTypes: [fgType] } : {}),
      },
    });
  } catch (err) {
    console.warn('PiP background notification failed', err);
  }
};

const hidePlaybackNotification = async () => {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.stopForegroundService();
  } catch (_) {}
  try {
    await notifee.cancelNotification(PLAYBACK_NOTIFICATION_ID);
  } catch (_) {}
};

export const createPipBackgroundSound = async (opts: {
  uri: string;
  positionMillis: number;
  title?: string;
  onEnded?: () => void;
}) => {
  await configurePipAudioMode();
  const sound = new Audio.Sound();
  const onStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      opts.onEnded?.();
    }
  };
  sound.setOnPlaybackStatusUpdate(onStatus);
  await sound.loadAsync(
    { uri: opts.uri },
    {
      shouldPlay: true,
      positionMillis: Math.max(0, opts.positionMillis || 0),
      isLooping: false,
      progressUpdateIntervalMillis: 500,
    },
  );
  await showPlaybackNotification(opts.title);
  return sound;
};

export const unloadPipBackgroundSound = async (sound: Audio.Sound | null) => {
  let positionMillis = 0;
  if (sound) {
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        positionMillis = status.positionMillis || 0;
      }
    } catch (_) {}
    try {
      sound.setOnPlaybackStatusUpdate(null);
    } catch (_) {}
    try {
      await sound.stopAsync();
    } catch (_) {}
    try {
      await sound.unloadAsync();
    } catch (_) {}
  }
  await hidePlaybackNotification();
  return positionMillis;
};

export const isAppBackgrounded = (state: AppStateStatus) =>
  state === 'background' || (Platform.OS === 'android' && state === 'inactive');

export { AppState };
