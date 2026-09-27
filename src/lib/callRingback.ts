import { Audio } from './avCompat';

// The "ringing" tone the caller hears while the other phone rings, like
// WhatsApp. It never changes the audio mode: the call's microphone session is
// already set up and must stay recording-capable (see configureInCallAudio).

let ringback: Audio.Sound | null = null;
let token = 0;

export async function startRingback(): Promise<void> {
  const mine = ++token;
  if (ringback) return;
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/audio/calling-beep.mp3'),
      { shouldPlay: true, isLooping: true, volume: 0.6 },
    );
    if (mine !== token) {
      try { await sound.stopAsync(); } catch (_) {}
      try { await sound.unloadAsync(); } catch (_) {}
      return;
    }
    ringback = sound;
  } catch (error) {
    console.warn('callRingback: failed to play', error);
  }
}

export async function stopRingback(): Promise<void> {
  token += 1;
  const sound = ringback;
  ringback = null;
  if (!sound) return;
  try { await sound.stopAsync(); } catch (_) {}
  try { await sound.unloadAsync(); } catch (_) {}
}
