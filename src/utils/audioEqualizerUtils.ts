/**
 * Professional audio equalizer utilities for web-based playback.
 * On mobile native platforms, gracefully falls back to volume control.
 */

export interface EqualizerPreset {
  id: string;
  name: string;
  description?: string;
  bands: number[];
}

export interface EqualizerState {
  enabled: boolean;
  preset: string;
  bands: number[];
  gain: number;
}

export const EQUALIZER_BANDS = [
  { id: 'bass', frequency: 60, label: '60 Hz', default: 0 },
  { id: 'lowmid', frequency: 250, label: '250 Hz', default: 0 },
  { id: 'mid', frequency: 1000, label: '1 kHz', default: 0 },
  { id: 'highmid', frequency: 4000, label: '4 kHz', default: 0 },
  { id: 'treble', frequency: 12000, label: '12 kHz', default: 0 },
] as const;

export const BAND_RANGE = { min: -20, max: 20, step: 1 }; // dB range
export const GAIN_RANGE = { min: -10, max: 10, step: 0.1 }; // Master gain dB range

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    description: 'No equalization',
    bands: [0, 0, 0, 0, 0],
  },
  {
    id: 'bass-boost',
    name: 'Bass Boost',
    description: 'Enhanced low frequencies',
    bands: [12, 8, 0, -3, -5],
  },
  {
    id: 'treble-boost',
    name: 'Treble Boost',
    description: 'Enhanced high frequencies',
    bands: [-5, -3, 0, 8, 12],
  },
  {
    id: 'vocal',
    name: 'Vocal',
    description: 'Optimized for speech and vocals',
    bands: [-3, 4, 8, 6, -2],
  },
  {
    id: 'classical',
    name: 'Classical',
    description: 'Smooth, refined sound',
    bands: [3, 2, -1, -1, 2],
  },
  {
    id: 'dance',
    name: 'Dance',
    description: 'Punchy bass and bright highs',
    bands: [10, 6, -2, 5, 8],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    description: 'Warm and smooth',
    bands: [2, 4, 3, 2, -1],
  },
  {
    id: 'rock',
    name: 'Rock',
    description: 'Strong low and high end',
    bands: [8, 4, -3, 4, 10],
  },
  {
    id: 'podcast',
    name: 'Podcast',
    description: 'Clear dialogue focus',
    bands: [-8, 5, 8, 4, -6],
  },
  {
    id: 'noise-reduction',
    name: 'Noise Reduction',
    description: 'Reduces background noise',
    bands: [-5, -2, 2, 3, -4],
  },
];

export interface BiquadFilterParams {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
  gain: number;
}

type BiquadFilterType = 'peaking' | 'lowshelf' | 'highshelf';

/**
 * Create biquad filter parameters for each frequency band.
 * Uses peaking filters for mid-range, shelf filters for extremes.
 */
export function createBiquadParams(bandIndex: number, gainDb: number): BiquadFilterParams {
  const band = EQUALIZER_BANDS[bandIndex];

  if (bandIndex === 0) {
    // Bass: low-shelf filter
    return {
      type: 'lowshelf',
      frequency: band.frequency,
      Q: 0.7,
      gain: gainDb,
    };
  } else if (bandIndex === EQUALIZER_BANDS.length - 1) {
    // Treble: high-shelf filter
    return {
      type: 'highshelf',
      frequency: band.frequency,
      Q: 0.7,
      gain: gainDb,
    };
  } else {
    // Mid-range: peaking filter
    return {
      type: 'peaking',
      frequency: band.frequency,
      Q: 2.0,
      gain: gainDb,
    };
  }
}

/**
 * Check if Web Audio API is available (web/desktop, not mobile native).
 */
export function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const audioContext = window.AudioContext || (window as any).webkitAudioContext;
  return !!audioContext;
}

/**
 * Persist equalizer settings to local storage.
 */
export const EQUALIZER_STORAGE_KEY = '@Connect:equalizer';

export function saveEqualizerSettings(state: EqualizerState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(EQUALIZER_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save equalizer settings:', e);
  }
}

export function loadEqualizerSettings(): EqualizerState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(EQUALIZER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load equalizer settings:', e);
    return null;
  }
}

export function getDefaultEqualizerState(): EqualizerState {
  return {
    enabled: false,
    preset: 'flat',
    bands: EQUALIZER_BANDS.map((b) => b.default),
    gain: 0,
  };
}
