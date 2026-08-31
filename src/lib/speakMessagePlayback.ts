import { Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Speech from 'expo-speech';
import socketService from '../services/socketService';
import {
  createPlayableVoiceSound,
  isAudioAttachmentUrl,
} from './voiceMessageAudio';

export type SpeakPayload = {
  type?: string;
  message?: string;
  text?: string;
  body?: string;
  attachment?: string;
  messageType?: string;
  interrupt?: boolean | string;
};

const BENGALI_CHAR = /[\u0980-\u09FF]/;

let speakSound: Audio.Sound | null = null;
let lastSpeakKey = '';
let lastSpeakAt = 0;
let speakGeneration = 0;
let socketBound = false;

export { isAudioAttachmentUrl };

const resolveText = (payload: SpeakPayload | string) => {
  if (typeof payload === 'string') return payload.trim();
  return String(payload?.message || payload?.text || payload?.body || '').trim();
};

const detectSpeechLanguage = (text: string) =>
  BENGALI_CHAR.test(text) ? 'bn-IN' : 'en-US';

const configurePlayback = async () => {
  try {
    await Audio.setIsEnabledAsync(true);
  } catch {
    /* ignore */
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};

const unloadSpeakSound = async () => {
  const current = speakSound;
  speakSound = null;
  if (!current) return;
  try {
    await current.stopAsync();
  } catch {
    /* ignore */
  }
  try {
    await current.unloadAsync();
  } catch {
    /* ignore */
  }
};

export const stopSpokenPlayback = async () => {
  speakGeneration += 1;
  try {
    await Speech.stop();
  } catch {
    /* ignore */
  }
  await unloadSpeakSound();
};

const playSpokenVoiceMessage = async (audioUrl: string) => {
  const generation = ++speakGeneration;
  try {
    await Speech.stop();
  } catch {
    /* ignore */
  }
  await unloadSpeakSound();
  try {
    await configurePlayback();
  } catch {
    /* still try to play */
  }
  if (generation !== speakGeneration) return;

  const sound = await createPlayableVoiceSound(audioUrl, {
    shouldPlay: true,
    volume: 1,
    isLooping: false,
  });
  if (generation !== speakGeneration) {
    try {
      await sound.unloadAsync();
    } catch {
      /* ignore */
    }
    return;
  }

  speakSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      unloadSpeakSound();
    }
  });
};

const pickVoice = (
  voices: Speech.Voice[] | undefined,
  preferred: string,
) => {
  if (!Array.isArray(voices) || voices.length === 0) return undefined;
  const wanted = preferred.toLowerCase().replace('_', '-');
  const prefix = wanted.split('-')[0];
  return (
    voices.find((voice) => String(voice.language || '').toLowerCase().replace('_', '-') === wanted) ||
    voices.find((voice) => String(voice.language || '').toLowerCase().startsWith(prefix)) ||
    voices.find((voice) => String(voice.language || '').toLowerCase().startsWith('en'))
  );
};

const speakOnce = (
  text: string,
  options: Speech.SpeechOptions,
) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      Speech.speak(text, {
        ...options,
        onStart: finish,
        onDone: finish,
        onStopped: finish,
        onError: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    } catch (error) {
      settled = true;
      reject(error);
      return;
    }
    setTimeout(finish, 1200);
  });

const speakText = async (text: string, interrupt = true) => {
  if (!text) return;
  if (interrupt) {
    try {
      await Speech.stop();
    } catch {
      /* ignore */
    }
    await unloadSpeakSound();
  }

  try {
    await configurePlayback();
  } catch {
    /* TTS can still work without this */
  }

  const preferred = detectSpeechLanguage(text);
  const voices = await Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]);
  const voice = pickVoice(voices, preferred);
  const languages = Array.from(
    new Set(
      [
        voice?.language,
        preferred,
        preferred.replace('-', '_'),
        BENGALI_CHAR.test(text) ? 'bn-BD' : 'en-US',
        'en-US',
        'en',
      ].filter(Boolean) as string[],
    ),
  );

  let lastError: unknown = null;
  for (const language of languages) {
    try {
      await speakOnce(text, {
        language,
        voice: voice?.identifier,
        pitch: 1,
        rate: Platform.OS === 'ios' ? 0.5 : 1,
        volume: 1,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
};

export const playSpeakPayload = async (payload: SpeakPayload | string = {}) => {
  const data: SpeakPayload =
    typeof payload === 'string'
      ? { message: payload }
      : payload && typeof payload === 'object'
        ? payload
        : {};
  const attachment = typeof data.attachment === 'string' ? data.attachment : '';
  const isAudioSpeakRequest =
    data.messageType === 'audio' || isAudioAttachmentUrl(attachment);
  const text = resolveText(data);
  const key = isAudioSpeakRequest ? `audio:${attachment}` : `text:${text}`;
  const now = Date.now();
  if (key && lastSpeakKey === key && now - lastSpeakAt < 800) return;

  if (isAudioSpeakRequest) {
    if (!attachment) return;
    lastSpeakKey = key;
    lastSpeakAt = now;
    try {
      await playSpokenVoiceMessage(attachment);
    } catch (error) {
      if (lastSpeakKey === key) {
        lastSpeakKey = '';
        lastSpeakAt = 0;
      }
      throw error;
    }
    return;
  }

  if (!text) return;
  lastSpeakKey = key;
  lastSpeakAt = now;
  const interrupt = String(data.interrupt ?? true) !== 'false';
  await speakText(text, interrupt);
};

const onSpeakMessage = (payload: any) => {
  playSpeakPayload(payload).catch((error) => {
    console.error('speak_message playback failed:', error);
  });
};

export const ensureSpeakMessageListener = () => {
  if (socketBound) return;
  socketBound = true;
  socketService.on('speak_message', onSpeakMessage);
  socketService.on('speak-message', onSpeakMessage);
};

export default playSpeakPayload;
