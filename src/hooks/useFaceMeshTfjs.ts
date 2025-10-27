import { useCallback, useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import RNFS from 'react-native-fs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - types may be missing until deps are installed
import * as facemesh from '@tensorflow-models/facemesh';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - jpeg-js is a pure JS dependency we install for image decoding
import * as jpeg from 'jpeg-js';

export type FaceMeshPoint = [number, number, number?];

export interface FaceMeshPrediction {
  // 468 landmark points in image coordinates (px)
  points: FaceMeshPoint[];
  // Bounding box if available
  box?: { topLeft: [number, number]; bottomRight: [number, number] };
}

interface UseFaceMeshTfjsOptions {
  backend?: 'cpu';
  maxFaces?: number;
  refineLandmarks?: boolean;
  // Maximum side length that the input image will be downscaled to before inference.
  // Lower values improve speed at the cost of some landmark precision.
  targetMaxSide?: number;
}

export const useFaceMeshTfjs = (options?: UseFaceMeshTfjsOptions) => {
  const { backend = 'cpu', maxFaces = 1, refineLandmarks = true, targetMaxSide = 224 } = options || {};

  const [isReady, setIsReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const modelRef = useRef<any | null>(null);

  // Initialize TFJS and model once
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLastError(null);
        // Minimal RN platform setup (no Expo): polyfill Buffer and set platform so tf.util calls work
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          (globalThis as any).Buffer = (require('buffer') as any).Buffer;
          const platform: any = {
            fetch: (path: any, init?: any) => (globalThis as any).fetch ? (globalThis as any).fetch(path, init) : Promise.reject(new Error('fetch not available')),
            encode: (text: string, encoding: string) => {
              if (encoding === 'utf-16') encoding = 'utf16le' as any;
              return new Uint8Array((globalThis as any).Buffer.from(text, encoding));
            },
            decode: (bytes: Uint8Array, encoding: string) => {
              if (encoding === 'utf-16') encoding = 'utf16le' as any;
              return (globalThis as any).Buffer.from(bytes).toString(encoding);
            },
            now: () => Date.now(),
            setTimeoutCustom: () => { throw new Error('setTimeoutCustom not supported'); },
            isTypedArray: (a: any) => a instanceof Float32Array || a instanceof Int32Array || a instanceof Uint8Array || a instanceof Uint8ClampedArray,
          };
          // Register a platform to satisfy tf.env().platform calls
          // Name can be arbitrary
          // @ts-ignore
          tf.setPlatform('rn-cpu', platform);
        } catch {}
        await tf.ready();
        // Use CPU backend to avoid expo-gl requirements entirely.
        if (tf.getBackend() !== backend) {
          await tf.setBackend(backend);
        }

        // Warmup small tensor op to ensure backend is ready
        try { tf.tidy(() => tf.zeros([1]).add(1 as any)); } catch {}

        const model = await facemesh.load({ maxFaces, refineLandmarks });
        if (cancelled) return;
        modelRef.current = model;
        setIsReady(true);
      } catch (e: any) {
        console.warn('FaceMesh init error', e);
        if (!cancelled) setLastError(e?.message || String(e));
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [backend, maxFaces, refineLandmarks]);

  const estimateFromImagePath = useCallback(async (
    fileUri: string,
  ): Promise<FaceMeshPrediction[] | null> => {
    if (!modelRef.current) return null;
    try {
      // Normalize Android file paths (remove file://)
      const normalized = fileUri.startsWith('file://') ? fileUri.replace('file://', '') : fileUri;
      const base64 = await RNFS.readFile(normalized, 'base64');
      // Faster than tf.util.encodeString for large payloads on RN
      const imageU8 = (globalThis as any).Buffer
        ? (globalThis as any).Buffer.from(base64, 'base64')
        : (tf.util.encodeString(base64, 'base64') as unknown as Uint8Array);

      // Decode JPEG into tensor [H,W,3] using jpeg-js
      const decoded = jpeg.decode(imageU8, { useTArray: true });
      const width = decoded.width;
      const height = decoded.height;
      const rgba = decoded.data as Uint8Array; // RGBA
      const rgb = new Uint8Array(width * height * 3);
      let o = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        rgb[o++] = rgba[i];
        rgb[o++] = rgba[i + 1];
        rgb[o++] = rgba[i + 2];
      }
      let imageTensor = tf.tensor3d(rgb, [height, width, 3], 'int32');

      // Downscale for performance on RN CPU backend
      const scale = Math.min(1, targetMaxSide / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));
      const resized = scale < 1
        ? tf.image.resizeBilinear(imageTensor.toFloat(), [targetH, targetW])
        : imageTensor.toFloat();

      // facemesh.estimateFaces accepts a Tensor3D directly; avoid fromPixels path
      const predictions = await modelRef.current.estimateFaces(resized);

      // Dispose tensors
      imageTensor.dispose();
      resized.dispose();
      const preds = predictions as Array<any>;

      if (!preds || preds.length === 0) return [];

      // Convert normalized coordinates to pixel coordinates if required
      // facemesh returns `scaledMesh` already in image coordinates for tensor input
      const mapped: FaceMeshPrediction[] = preds.map((p: any) => {
        const points: FaceMeshPoint[] = (p.scaledMesh || p.mesh || []).map((pt: number[]) => [
          // Map back to original image coordinates if resized
          scale < 1 ? pt[0] * (width / targetW) : pt[0],
          scale < 1 ? pt[1] * (height / targetH) : pt[1],
          pt[2],
        ]);
        let box;
        if (p.boundingBox && p.boundingBox.topLeft && p.boundingBox.bottomRight) {
          // topLeft/bottomRight may be arrays or tensors; coerce to numbers
          const tl = Array.isArray(p.boundingBox.topLeft)
            ? p.boundingBox.topLeft
            : p.boundingBox.topLeft.arraySync();
          const br = Array.isArray(p.boundingBox.bottomRight)
            ? p.boundingBox.bottomRight
            : p.boundingBox.bottomRight.arraySync();
          const tlMapped: [number, number] = [
            scale < 1 ? tl[0] * (width / targetW) : tl[0],
            scale < 1 ? tl[1] * (height / targetH) : tl[1],
          ];
          const brMapped: [number, number] = [
            scale < 1 ? br[0] * (width / targetW) : br[0],
            scale < 1 ? br[1] * (height / targetH) : br[1],
          ];
          box = { topLeft: tlMapped, bottomRight: brMapped } as any;
        }
        return { points, box };
      });

      return mapped;
    } catch (e) {
      console.warn('FaceMesh estimate error', e);
      return null;
    }
  }, []);

  return {
    isReady,
    lastError,
    estimateFromImagePath,
  };
};

export default useFaceMeshTfjs;


