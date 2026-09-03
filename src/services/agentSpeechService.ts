import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export type AgentSpeechLanguage = 'auto' | 'bn-BD' | 'en-US';

const BENGALI_CHAR = /[\u0980-\u09FF]/;

export const detectAgentSpeechLanguage = (
  text: string,
): Exclude<AgentSpeechLanguage, 'auto'> =>
  BENGALI_CHAR.test(text) ? 'bn-BD' : 'en-US';

const normalize = (text: string) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

const chooseVoice = (voices: Speech.Voice[], language: string) => {
  const wanted = language.toLowerCase().replace('_', '-');
  const prefix = wanted.split('-')[0];
  const candidates = voices.filter(voice => {
    const voiceLanguage = String(voice.language || '').toLowerCase().replace('_', '-');
    return voiceLanguage === wanted || voiceLanguage.startsWith(prefix);
  });
  return candidates.sort((left, right) => {
    const score = (voice: Speech.Voice) => {
      const details = voice as Speech.Voice & { quality?: string };
      const voiceLanguage = String(voice.language || '').toLowerCase().replace('_', '-');
      const name = `${voice.name || ''} ${voice.identifier || ''}`.toLowerCase();
      return (
        (voiceLanguage === wanted ? 100 : 0) +
        (details.quality?.toLowerCase() === 'enhanced' ? 30 : 0) +
        (name.includes('neural') || name.includes('natural') || name.includes('premium') ? 20 : 0)
      );
    };
    return score(right) - score(left);
  })[0];
};

const speak = (
  text: string,
  language: Exclude<AgentSpeechLanguage, 'auto'>,
  generation: number,
  current: () => number,
  voice?: string,
) =>
  new Promise<void>(resolve => {
    if (generation !== current()) return resolve();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    Speech.speak(text, {
      language,
      voice,
      pitch: 0.96,
      rate: Platform.OS === 'ios' ? 0.58 : 0.9,
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });

/**
 * Expo Speech does not expose a PCM stream, but it safely queues sentence-sized
 * chunks. This gives the agent low-latency playback while allowing cancellation.
 */
export function createAgentSpeechController(
  initialLanguage: AgentSpeechLanguage = 'auto',
) {
  let generation = 0;
  let lastText = '';
  let pending = '';
  let language = initialLanguage;
  let draining = false;
  let flushRequested = false;
  let availableVoices: Speech.Voice[] | null = null;

  const currentGeneration = () => generation;

  const stop = async () => {
    generation += 1;
    pending = '';
    lastText = '';
    flushRequested = false;
    try {
      await Speech.stop();
    } catch {
      // Speech may not be initialized in Expo web/test environments.
    }
  };

  const drain = async (drainGeneration: number) => {
    if (draining) return;
    draining = true;
    try {
      while (pending && drainGeneration === generation) {
        const match = flushRequested
          ? [pending]
          : pending.match(/^(.+?[.!?।॥]+(?:\s|$)|.{1,180}(?:\s|$))/u);
        if (!match) break;
        const rawChunk = match[0];
        const chunk = normalize(rawChunk);
        pending = pending.slice(rawChunk.length).trimStart();
        if (!chunk) continue;
        const resolvedLanguage =
          language === 'auto' ? detectAgentSpeechLanguage(chunk) : language;
        if (!availableVoices) {
          availableVoices = await Speech.getAvailableVoicesAsync().catch(
            () => [] as Speech.Voice[],
          );
        }
        const voices = availableVoices;
        const voice = chooseVoice(voices, resolvedLanguage);
        await speak(
          chunk,
          resolvedLanguage,
          drainGeneration,
          currentGeneration,
          voice?.identifier,
        );
      }
    } finally {
      draining = false;
    }
  };

  const update = (fullText: string, nextLanguage?: AgentSpeechLanguage) => {
    const text = normalize(fullText);
    if (nextLanguage) language = nextLanguage;
    if (!text || text === lastText) return;
    flushRequested = false;
    const suffix = text.startsWith(lastText)
      ? text.slice(lastText.length)
      : text;
    lastText = text;
    pending += suffix;
    void drain(generation);
  };

  const waitForIdle = () =>
    new Promise<void>(resolve => {
      const check = () => {
        if (!draining && !pending) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });

  const finish = () => {
    if (pending) {
      flushRequested = true;
      void drain(generation);
    }
    return waitForIdle();
  };

  return { update, finish, stop };
}
