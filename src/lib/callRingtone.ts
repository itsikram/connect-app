import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Vibration, Platform } from 'react-native';
import {
  RINGTONE_SOURCES,
  getStoredRingtoneId,
  normalizeRingtoneId,
  stopRingtonePreview,
} from './ringtoneAssets';

let ringtoneSound: Audio.Sound | null = null;
let vibrationTimer: ReturnType<typeof setInterval> | null = null;
let playToken = 0;

async function configurePlayback(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.warn('callRingtone: failed to set audio mode', error);
  }
}

export async function configureInCallAudio(speakerOn: boolean): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: !speakerOn,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: !speakerOn,
    });
  } catch (error) {
    console.warn('callRingtone: failed to set in-call audio mode', error);
  }
}

export async function playIncomingRingtone(ringtoneId?: string): Promise<void> {
  const token = ++playToken;
  await stopIncomingRingtone();
  await stopRingtonePreview();
  await configurePlayback();

  const id = ringtoneId ? normalizeRingtoneId(ringtoneId) : await getStoredRingtoneId();
  const source = RINGTONE_SOURCES[id] || RINGTONE_SOURCES['1'];

  try {
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      isLooping: true,
      volume: 1,
    });
    if (token !== playToken) {
      try {
        await sound.stopAsync();
      } catch (_) {}
      try {
        await sound.unloadAsync();
      } catch (_) {}
      return;
    }
    ringtoneSound = sound;
  } catch (error) {
    console.warn('callRingtone: audio playback failed, using vibration', error);
  }

  if (token !== playToken) return;

  if (Platform.OS === 'ios') {
    Vibration.vibrate();
    vibrationTimer = setInterval(() => Vibration.vibrate(), 2000);
  } else {
    Vibration.vibrate([0, 500, 250, 500], true);
  }
}

export async function stopIncomingRingtone(): Promise<void> {
  playToken += 1;
  if (vibrationTimer) {
    clearInterval(vibrationTimer);
    vibrationTimer = null;
  }
  try {
    Vibration.cancel();
  } catch (_) {}

  const sound = ringtoneSound;
  ringtoneSound = null;
  if (!sound) return;

  try {
    await sound.stopAsync();
  } catch (_) {}
  try {
    await sound.unloadAsync();
  } catch (_) {}
}
