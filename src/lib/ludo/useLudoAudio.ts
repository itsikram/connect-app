import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from '../avCompat';

type SoundType =
  | 'diceRoll'
  | 'pieceMove'
  | 'capture'
  | 'win'
  | 'turnChange'
  | 'buttonClick'
  | 'pieceOut';

const SOUND_SOURCES: Record<SoundType, number> = {
  diceRoll: require('../../assets/sounds/ludo/diceRoll.wav'),
  pieceMove: require('../../assets/sounds/ludo/pieceMove.wav'),
  capture: require('../../assets/sounds/ludo/capture.wav'),
  win: require('../../assets/sounds/ludo/win.wav'),
  turnChange: require('../../assets/sounds/ludo/turnChange.wav'),
  buttonClick: require('../../assets/sounds/ludo/buttonClick.wav'),
  pieceOut: require('../../assets/sounds/ludo/pieceOut.wav'),
};

const configurePlayback = async () => {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};

export const useLudoAudio = () => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const poolRef = useRef<Partial<Record<SoundType, Audio.Sound>>>({});
  const modeReadyRef = useRef(false);
  const loadingRef = useRef<Promise<void> | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    enabledRef.current = soundsEnabled;
  }, [soundsEnabled]);

  const unloadAll = useCallback(async () => {
    const loaded = Object.values(poolRef.current);
    poolRef.current = {};
    await Promise.all(
      loaded.map(async (sound) => {
        if (!sound) return;
        try {
          await sound.stopAsync();
        } catch {
          // ignore
        }
        try {
          await sound.unloadAsync();
        } catch {
          // ignore
        }
      }),
    );
  }, []);

  const ensureReady = useCallback(async () => {
    if (loadingRef.current) {
      await loadingRef.current;
      return;
    }
    loadingRef.current = (async () => {
      if (!modeReadyRef.current) {
        await configurePlayback();
        modeReadyRef.current = true;
      }
      const entries = Object.entries(SOUND_SOURCES) as [SoundType, number][];
      await Promise.all(
        entries.map(async ([name, source]) => {
          const existing = poolRef.current[name];
          if (existing) {
            const status = await existing.getStatusAsync();
            if (status.isLoaded) return;
          }
          const { sound } = await Audio.Sound.createAsync(source, {
            shouldPlay: false,
            volume: 1,
            isLooping: false,
          });
          poolRef.current[name] = sound;
        }),
      );
    })().finally(() => {
      loadingRef.current = null;
    });
    await loadingRef.current;
  }, []);

  useEffect(() => {
    ensureReady().catch(() => {});

    const onAppState = (state: AppStateStatus) => {
      if (state !== 'active') return;
      modeReadyRef.current = false;
      configurePlayback()
        .then(() => {
          modeReadyRef.current = true;
        })
        .catch(() => {});
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      sub.remove();
      unloadAll().catch(() => {});
    };
  }, [ensureReady, unloadAll]);

  const playTone = useCallback((soundType: SoundType) => {
    void (async () => {
      try {
        if (!modeReadyRef.current) {
          await configurePlayback();
          modeReadyRef.current = true;
        }
        const existing = poolRef.current[soundType];
        if (existing) {
          const status = await existing.getStatusAsync();
          if (status.isLoaded) {
            await existing.replayAsync();
            return;
          }
        }
        const { sound } = await Audio.Sound.createAsync(SOUND_SOURCES[soundType], {
          shouldPlay: true,
          volume: 1,
          isLooping: false,
        });
        poolRef.current[soundType] = sound;
      } catch {
        try {
          await configurePlayback();
          modeReadyRef.current = true;
          const { sound } = await Audio.Sound.createAsync(SOUND_SOURCES[soundType], {
            shouldPlay: true,
            volume: 1,
            isLooping: false,
          });
          poolRef.current[soundType] = sound;
        } catch {
          // Keep gameplay unblocked if a tone fails.
        }
      }
    })();
  }, []);

  const playSound = useCallback(
    (soundType: string) => {
      if (!enabledRef.current) return;
      const type = (SOUND_SOURCES[soundType as SoundType] ? soundType : 'buttonClick') as SoundType;
      playTone(type);
    },
    [playTone],
  );

  const toggleSounds = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setSoundsEnabled(next);
    if (next) playTone('buttonClick');
  }, [playTone]);

  return { soundsEnabled, setSoundsEnabled, playSound, toggleSounds };
};
