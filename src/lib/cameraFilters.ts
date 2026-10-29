import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageFormat, Skia } from '@shopify/react-native-skia';

/**
 * iPhone-style photo filters (Vivid, Dramatic, Mono, Silvertone, Noir, ...)
 * expressed as 4x5 color matrices (row-major, offsets normalized to 0..1).
 * The same matrices drive the Skia preview of a captured photo and the
 * pixels that end up in the saved file, so what you see is what you get.
 */

export type ColorMatrix = number[];

export type CameraFilterId =
  | 'original'
  | 'vivid'
  | 'vividWarm'
  | 'vividCool'
  | 'dramatic'
  | 'dramaticWarm'
  | 'dramaticCool'
  | 'mono'
  | 'silvertone'
  | 'noir';

/** Approximation of the filter on the live camera preview (a native view Skia can't read). */
export type PreviewLayer = {
  color: string;
  opacity: number;
  blend: 'saturation' | 'color' | 'soft-light' | 'overlay' | 'multiply' | 'screen';
};

export type CameraFilter = {
  id: CameraFilterId;
  label: string;
  matrix: ColorMatrix;
  preview: PreviewLayer[];
};

// Rec. 709 luma weights, same family Core Image uses for its mono filters.
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

export const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Returns a ∘ b (apply b first, then a). */
export const concat = (a: ColorMatrix, b: ColorMatrix): ColorMatrix => {
  const out: number[] = new Array(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      let value = col === 4 ? a[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k += 1) {
        value += a[row * 5 + k] * b[k * 5 + col];
      }
      out[row * 5 + col] = value;
    }
  }
  return out;
};

const chain = (...matrices: ColorMatrix[]): ColorMatrix =>
  matrices.reduce((acc, m) => concat(m, acc), IDENTITY);

const saturation = (s: number): ColorMatrix => {
  const r = (1 - s) * LR;
  const g = (1 - s) * LG;
  const b = (1 - s) * LB;
  return [
    r + s, g, b, 0, 0,
    r, g + s, b, 0, 0,
    r, g, b + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

/** Contrast around mid grey. */
const contrast = (c: number): ColorMatrix => {
  const t = (1 - c) / 2;
  return [
    c, 0, 0, 0, t,
    0, c, 0, 0, t,
    0, 0, c, 0, t,
    0, 0, 0, 1, 0,
  ];
};

const exposure = (offset: number, gain = 1): ColorMatrix => [
  gain, 0, 0, 0, offset,
  0, gain, 0, 0, offset,
  0, 0, gain, 0, offset,
  0, 0, 0, 1, 0,
];

/** Per-channel gains + offsets: positive `warmth` pushes toward amber, negative toward blue. */
const temperature = (warmth: number, tint = 0): ColorMatrix => [
  1 + warmth, 0, 0, 0, warmth * 0.04,
  0, 1 + tint, 0, 0, tint * 0.02,
  0, 0, 1 - warmth, 0, -warmth * 0.04,
  0, 0, 0, 1, 0,
];

const grayscale = (r = LR, g = LG, b = LB): ColorMatrix => [
  r, g, b, 0, 0,
  r, g, b, 0, 0,
  r, g, b, 0, 0,
  0, 0, 0, 1, 0,
];

export const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: 'original',
    label: 'Original',
    matrix: IDENTITY,
    preview: [],
  },
  {
    id: 'vivid',
    label: 'Vivid',
    matrix: chain(saturation(1.3), contrast(1.08), exposure(0.01)),
    preview: [
      { color: '#808080', opacity: 0.22, blend: 'overlay' },
      { color: '#ff3b6b', opacity: 0.06, blend: 'soft-light' },
    ],
  },
  {
    id: 'vividWarm',
    label: 'Vivid Warm',
    matrix: chain(saturation(1.25), contrast(1.06), temperature(0.05, 0.01), exposure(0.005)),
    preview: [
      { color: '#808080', opacity: 0.2, blend: 'overlay' },
      { color: '#ffa640', opacity: 0.22, blend: 'soft-light' },
    ],
  },
  {
    id: 'vividCool',
    label: 'Vivid Cool',
    matrix: chain(saturation(1.25), contrast(1.06), temperature(-0.06, 0.005), exposure(0.008)),
    preview: [
      { color: '#808080', opacity: 0.2, blend: 'overlay' },
      { color: '#4aa8ff', opacity: 0.22, blend: 'soft-light' },
    ],
  },
  {
    id: 'dramatic',
    label: 'Dramatic',
    matrix: chain(saturation(0.9), contrast(1.32), exposure(-0.045)),
    preview: [
      { color: '#808080', opacity: 0.1, blend: 'saturation' },
      { color: '#3a3a3a', opacity: 0.35, blend: 'overlay' },
      { color: '#000000', opacity: 0.08, blend: 'multiply' },
    ],
  },
  {
    id: 'dramaticWarm',
    label: 'Dramatic Warm',
    matrix: chain(saturation(0.82), contrast(1.3), temperature(0.12, 0.015), exposure(-0.04)),
    preview: [
      { color: '#808080', opacity: 0.18, blend: 'saturation' },
      { color: '#3a3a3a', opacity: 0.3, blend: 'overlay' },
      { color: '#d9822b', opacity: 0.28, blend: 'soft-light' },
    ],
  },
  {
    id: 'dramaticCool',
    label: 'Dramatic Cool',
    matrix: chain(saturation(0.8), contrast(1.3), temperature(-0.12, 0.02), exposure(-0.04)),
    preview: [
      { color: '#808080', opacity: 0.2, blend: 'saturation' },
      { color: '#3a3a3a', opacity: 0.3, blend: 'overlay' },
      { color: '#2f7fa8', opacity: 0.3, blend: 'soft-light' },
    ],
  },
  {
    id: 'mono',
    label: 'Mono',
    matrix: chain(grayscale(), contrast(1.04)),
    preview: [{ color: '#808080', opacity: 1, blend: 'saturation' }],
  },
  {
    id: 'silvertone',
    label: 'Silvertone',
    // Lifted, soft, slightly cool silver black & white.
    matrix: chain(grayscale(0.25, 0.68, 0.07), contrast(1.12), exposure(0.03), temperature(-0.02)),
    preview: [
      { color: '#808080', opacity: 1, blend: 'saturation' },
      { color: '#ffffff', opacity: 0.1, blend: 'screen' },
      { color: '#b8c4d6', opacity: 0.12, blend: 'soft-light' },
    ],
  },
  {
    id: 'noir',
    label: 'Noir',
    // Deep blacks, hard contrast, reds rendered a bit brighter like film.
    matrix: chain(grayscale(0.3, 0.62, 0.08), contrast(1.55), exposure(-0.05)),
    preview: [
      { color: '#808080', opacity: 1, blend: 'saturation' },
      { color: '#2a2a2a', opacity: 0.55, blend: 'overlay' },
      { color: '#000000', opacity: 0.12, blend: 'multiply' },
    ],
  },
];

export const getCameraFilter = (id: string): CameraFilter =>
  CAMERA_FILTERS.find((f) => f.id === id) ?? CAMERA_FILTERS[0];

/** Blend a filter matrix with identity; intensity is 0..100. */
export const matrixForIntensity = (matrix: ColorMatrix, intensity: number): ColorMatrix => {
  const t = Math.max(0, Math.min(1, intensity / 100));
  return matrix.map((value, i) => IDENTITY[i] + (value - IDENTITY[i]) * t);
};

export const isIdentity = (matrix: ColorMatrix) =>
  matrix.every((value, i) => Math.abs(value - IDENTITY[i]) < 1e-4);

/**
 * Bake the filter into a JPEG. Returns the new file URI, or the original URI when
 * there is nothing to apply (Original filter, 0 intensity) or Skia isn't available (web).
 */
export async function applyFilterToPhoto(uri: string, filterId: string, intensity: number): Promise<string> {
  const matrix = matrixForIntensity(getCameraFilter(filterId).matrix, intensity);
  if (Platform.OS === 'web' || isIdentity(matrix)) {
    return uri;
  }

  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('Could not decode photo');
  }

  const width = image.width();
  const height = image.height();
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) {
    throw new Error('Could not create drawing surface');
  }

  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
  surface.getCanvas().drawImage(image, 0, 0, paint);
  surface.flush();

  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 94);
  const dest = `${FileSystem.cacheDirectory}filtered_${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}
