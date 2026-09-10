/**
 * React hook for managing audio equalizer state and Web Audio API integration.
 * Gracefully handles environments where Web Audio is not available.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EqualizerState,
  EqualizerPreset,
  EQUALIZER_PRESETS,
  EQUALIZER_BANDS,
  BAND_RANGE,
  GAIN_RANGE,
  isWebAudioSupported,
  saveEqualizerSettings,
  loadEqualizerSettings,
  getDefaultEqualizerState,
  createBiquadParams,
} from '../utils/audioEqualizerUtils';

interface AudioNodeRefs {
  audioContext: AudioContext | null;
  mediaSource: MediaElementAudioSourceNode | null;
  analyser: AnalyserNode | null;
  biquadFilters: BiquadFilterNode[];
  gainNode: GainNode | null;
  destination: AudioNode | null;
}

/**
 * Hook for managing equalizer state and Web Audio API effects.
 * On mobile native platforms or when Web Audio is unavailable, gracefully falls back.
 */
export function useAudioEqualizer(videoElement: HTMLMediaElement | null) {
  const [eqState, setEqState] = useState<EqualizerState>(getDefaultEqualizerState);
  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const audioNodesRef = useRef<AudioNodeRefs>({
    audioContext: null,
    mediaSource: null,
    analyser: null,
    biquadFilters: [],
    gainNode: null,
    destination: null,
  });

  // Initialize Web Audio API on first render
  useEffect(() => {
    const supported = isWebAudioSupported();
    setIsSupported(supported);
    if (supported) {
      const saved = loadEqualizerSettings();
      if (saved) {
        setEqState(saved);
      }
    }
  }, []);

  // Connect video element to Web Audio API
  const connectAudioGraph = useCallback(async () => {
    if (!videoElement || !isSupported || isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();

      // Resume context if suspended (required on some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create audio nodes
      const mediaSource = audioContext.createMediaElementAudioSource(videoElement);
      const gainNode = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      // Create biquad filters for each frequency band
      const filters = EQUALIZER_BANDS.map(() => audioContext.createBiquadFilter());

      // Connect: mediaSource -> filters -> gainNode -> analyser -> destination
      mediaSource.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);

      audioNodesRef.current = {
        audioContext,
        mediaSource,
        analyser,
        biquadFilters: filters,
        gainNode,
        destination: audioContext.destination,
      };

      setIsInitialized(true);
    } catch (error) {
      console.warn('Failed to initialize audio equalizer:', error);
      setIsSupported(false);
    }
  }, [videoElement, isSupported, isInitialized]);

  // Apply band gain to biquad filter
  const applyBandGain = useCallback((bandIndex: number, gainDb: number) => {
    const filter = audioNodesRef.current.biquadFilters[bandIndex];
    if (!filter) return;

    const params = createBiquadParams(bandIndex, gainDb);
    filter.type = params.type as any;
    filter.frequency.value = params.frequency;
    filter.Q.value = params.Q;
    filter.gain.value = params.gain;
  }, []);

  // Apply master gain
  const applyMasterGain = useCallback((gainDb: number) => {
    if (audioNodesRef.current.gainNode) {
      audioNodesRef.current.gainNode.gain.value = Math.pow(10, gainDb / 20);
    }
  }, []);

  // Update equalizer state and apply to audio graph
  const updateEqualizerState = useCallback(
    (updates: Partial<EqualizerState>) => {
      setEqState((prev) => {
        const next = { ...prev, ...updates };

        // Apply changes to audio graph
        if (audioNodesRef.current.biquadFilters.length > 0) {
          if (updates.bands) {
            updates.bands.forEach((gainDb, idx) => applyBandGain(idx, gainDb));
          }
          if (typeof updates.gain === 'number') {
            applyMasterGain(updates.gain);
          }
          if (typeof updates.enabled === 'boolean') {
            // Disconnect/reconnect audio graph based on enabled state
            if (!updates.enabled && audioNodesRef.current.mediaSource) {
              audioNodesRef.current.mediaSource.disconnect();
              audioNodesRef.current.mediaSource.connect(audioNodesRef.current.destination);
            } else if (updates.enabled && audioNodesRef.current.biquadFilters.length > 0) {
              audioNodesRef.current.mediaSource?.disconnect();
              audioNodesRef.current.mediaSource?.connect(audioNodesRef.current.biquadFilters[0]);
            }
          }
        }

        saveEqualizerSettings(next);
        return next;
      });
    },
    [applyBandGain, applyMasterGain],
  );

  // Load preset
  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = EQUALIZER_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        updateEqualizerState({
          preset: presetId,
          bands: preset.bands,
        });
      }
    },
    [updateEqualizerState],
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    updateEqualizerState(getDefaultEqualizerState());
  }, [updateEqualizerState]);

  // Synchronize audio graph on initial connection
  useEffect(() => {
    connectAudioGraph();
  }, [connectAudioGraph]);

  // Apply initial state to audio graph after initialization
  useEffect(() => {
    if (!isInitialized) return;

    eqState.bands.forEach((gainDb, idx) => applyBandGain(idx, gainDb));
    applyMasterGain(eqState.gain);

    if (eqState.enabled && audioNodesRef.current.mediaSource) {
      audioNodesRef.current.mediaSource.disconnect();
      if (audioNodesRef.current.biquadFilters.length > 0) {
        audioNodesRef.current.mediaSource.connect(audioNodesRef.current.biquadFilters[0]);
      }
    }
  }, [isInitialized, eqState.enabled, applyBandGain, applyMasterGain]);

  return {
    isSupported,
    isInitialized,
    state: eqState,
    presets: EQUALIZER_PRESETS,
    updateState: updateEqualizerState,
    loadPreset,
    resetToDefaults,
    getAnalyserData: () =>
      audioNodesRef.current.analyser ? new Uint8Array(audioNodesRef.current.analyser.frequencyBinCount) : null,
  };
}
