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
  return (
    voices.find(
      voice =>
        String(voice.language || '')
          .toLowerCase()
          .replace('_', '-') === wanted,
    ) ||
    voices.find(voice =>
      String(voice.language || '')
        .toLowerCase()
        .startsWith(prefix),
    )
  );
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
      pitch: 1,
      rate: Platform.OS === 'ios' ? 0.65 : 1.05,
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
        const voices = await Speech.getAvailableVoicesAsync().catch(
          () => [] as Speech.Voice[],
        );
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

  const finish = () => {
    if (!pending) return;
    flushRequested = true;
    void drain(generation);
  };

  return { update, finish, stop };
}
