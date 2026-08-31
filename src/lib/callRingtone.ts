import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let ringtoneSound: Audio.Sound | null = null;
let vibrationTimer: ReturnType<typeof setInterval> | null = null;

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
      // iOS routes to earpiece while recording is allowed; speaker when it is not
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

export async function playIncomingRingtone(): Promise<void> {
  await stopIncomingRingtone();
  await configurePlayback();

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg' },
      { shouldPlay: true, isLooping: true, volume: 1 },
    );
    ringtoneSound = sound;
  } catch (error) {
    console.warn('callRingtone: audio playback failed, using vibration', error);
  }

  if (Platform.OS === 'ios') {
    Vibration.vibrate();
    vibrationTimer = setInterval(() => Vibration.vibrate(), 2000);
  } else {
    Vibration.vibrate([0, 500, 250, 500], true);
  }
}

export async function stopIncomingRingtone(): Promise<void> {
  if (vibrationTimer) {
    clearInterval(vibrationTimer);
    vibrationTimer = null;
  }
  try {
    Vibration.cancel();
  } catch (_) {}

  if (ringtoneSound) {
    try {
      await ringtoneSound.stopAsync();
    } catch (_) {}
    try {
      await ringtoneSound.unloadAsync();
    } catch (_) {}
    ringtoneSound = null;
  }
}
