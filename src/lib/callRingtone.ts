import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from './avCompat';
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
let playingRingtoneId: string | null = null;

async function unloadCurrentSound(): Promise<void> {
  if (vibrationTimer) {
    clearInterval(vibrationTimer);
    vibrationTimer = null;
  }
  try {
    Vibration.cancel();
  } catch (_) {}

  const sound = ringtoneSound;
  ringtoneSound = null;
  playingRingtoneId = null;
  if (!sound) return;

  try {
    await sound.stopAsync();
  } catch (_) {}
  try {
    await sound.unloadAsync();
  } catch (_) {}
}

async function configurePlayback(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
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

/** Two-way live voice needs mic capture and loudspeaker playback at the same time. */
export async function configureLiveVoiceAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.warn('callRingtone: failed to set live voice audio mode', error);
  }
}

export function isIncomingRingtonePlaying(): boolean {
  return ringtoneSound != null;
}

export async function playIncomingRingtone(ringtoneId?: string): Promise<void> {
  const id = ringtoneId ? normalizeRingtoneId(ringtoneId) : await getStoredRingtoneId();
  if (ringtoneSound && playingRingtoneId === id) {
    try {
      const status = await ringtoneSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        return;
      }
    } catch (_) {}
  }

  const token = ++playToken;
  await unloadCurrentSound();
  await stopRingtonePreview();
  await configurePlayback();

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
    playingRingtoneId = id;
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
  await unloadCurrentSound();
}
