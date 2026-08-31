import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export const RINGTONE_STORAGE_KEY = '@incoming_call_ringtone_id';
export const MAX_RINGTONE_ID = 5;

export const RINGTONE_OPTIONS = [
  { label: 'Default Ringtone', value: '1' },
  { label: 'Phone ringtone bells', value: '2' },
  { label: 'Telephone Ringtone', value: '3' },
  { label: 'Telephone Ringtone 2', value: '4' },
  { label: 'Phone ringtone office', value: '5' },
];

export const RINGTONE_SOURCES: Record<string, number> = {
  '1': require('../assets/audio/default-ringtone.mp3'),
  '2': require('../assets/audio/phone-ringtone-bells.mp3'),
  '3': require('../assets/audio/old-telephone.mp3'),
  '4': require('../assets/audio/phone-ringtone-telephone.mp3'),
  '5': require('../assets/audio/phone-ringtone-office.mp3'),
};

export function normalizeRingtoneId(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_RINGTONE_ID) return '1';
  return String(parsed);
}

export function getRingtoneSoundName(ringtoneId?: unknown): string {
  return `ringtone_${normalizeRingtoneId(ringtoneId)}`;
}

export function getIncomingCallChannelId(ringtoneId?: unknown): string {
  return `incoming_calls_r${normalizeRingtoneId(ringtoneId)}`;
}

export async function persistRingtonePreference(ringtoneId: unknown): Promise<string> {
  const id = normalizeRingtoneId(ringtoneId);
  try {
    await AsyncStorage.setItem(RINGTONE_STORAGE_KEY, id);
  } catch (_) {}
  return id;
}

export async function getStoredRingtoneId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(RINGTONE_STORAGE_KEY);
    if (stored) return normalizeRingtoneId(stored);

    const settingsRaw = await AsyncStorage.getItem('@app_settings');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      return normalizeRingtoneId(parsed?.ringtone);
    }
  } catch (_) {}
  return '1';
}

const PREVIEW_MS = 4000;

let previewSound: Audio.Sound | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewToken = 0;

async function configurePreviewPlayback() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

export async function stopRingtonePreview() {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }

  const sound = previewSound;
  previewSound = null;
  if (!sound) return;

  try {
    await sound.stopAsync();
  } catch (_) {}
  try {
    await sound.unloadAsync();
  } catch (_) {}
}

export async function playRingtonePreview(ringtoneId: string) {
  const token = ++previewToken;
  await stopRingtonePreview();

  const source = RINGTONE_SOURCES[normalizeRingtoneId(ringtoneId)] || RINGTONE_SOURCES['1'];
  try {
    await configurePreviewPlayback();
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      isLooping: false,
      volume: 1,
    });

    if (token !== previewToken) {
      try {
        await sound.stopAsync();
      } catch (_) {}
      try {
        await sound.unloadAsync();
      } catch (_) {}
      return;
    }

    previewSound = sound;
    previewTimer = setTimeout(() => {
      stopRingtonePreview().catch(() => {});
    }, PREVIEW_MS);
  } catch (error) {
    console.warn('Ringtone preview failed:', error);
  }
}
