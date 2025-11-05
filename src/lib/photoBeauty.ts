import RNFS from 'react-native-fs';
import { Skia, TileMode } from '@shopify/react-native-skia';
import FaceDetection from '@react-native-ml-kit/face-detection';

type FaceBounds = { x: number; y: number; width: number; height: number } | null;

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  let i = 0;
  for (; i < bytes.length - 2; i += 3) {
    const triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += alphabet[(triplet >> 18) & 0x3f] +
      alphabet[(triplet >> 12) & 0x3f] +
      alphabet[(triplet >> 6) & 0x3f] +
      alphabet[triplet & 0x3f];
  }
  if (i < bytes.length) {
    const remaining = bytes.length - i;
    let triplet = bytes[i] << 16;
    if (remaining === 2) triplet |= bytes[i + 1] << 8;
    out += alphabet[(triplet >> 18) & 0x3f] + alphabet[(triplet >> 12) & 0x3f];
    if (remaining === 2) {
      out += alphabet[(triplet >> 6) & 0x3f] + '=';
    } else {
      out += '==';
    }
  }
  return out;
}

async function detectFaceBounds(photoPath: string): Promise<FaceBounds> {
  try {
    const faces = await FaceDetection.detect(`file://${photoPath}`, {
      performanceMode: 'fast',
      landmarkMode: 'none',
      contourMode: 'none',
    });
    if (!faces || faces.length === 0) return null;
    // pick the largest face
    const largest = faces.reduce((acc: any, f: any) => {
      const b: any = (f as any).bounds || (f as any).frame;
      const w = (b?.width != null ? b.width : (b?.right ?? 0) - (b?.left ?? 0)) || 0;
      const h = (b?.height != null ? b.height : (b?.bottom ?? 0) - (b?.top ?? 0)) || 0;
      const area = Math.max(1, w) * Math.max(1, h);
      if (!acc || area > acc.area) return { face: f, area };
      return acc;
    }, null as any);

    const bounds: any = (largest.face as any).bounds || (largest.face as any).frame;
    const bx = bounds?.x ?? bounds?.left ?? 0;
    const by = bounds?.y ?? bounds?.top ?? 0;
    const bw = bounds?.width ?? (bounds?.right != null && bounds?.left != null ? bounds.right - bounds.left : 0);
    const bh = bounds?.height ?? (bounds?.bottom != null && bounds?.top != null ? bounds.bottom - bounds.top : 0);
    return { x: bx, y: by, width: bw, height: bh };
  } catch {
    return null;
  }
}

export async function beautifyPhoto(inputPath: string): Promise<string> {
  // Read source image
  const base64 = await RNFS.readFile(inputPath, 'base64');
  const data = Skia.Data.fromBase64(base64);
  const src = Skia.Image.MakeImageFromEncoded(data);
  if (!src) return inputPath;

  const width = src.width();
  const height = src.height();

  const surface = Skia.Surface.MakeRasterN32Premul(width, height);
  if (!surface) return inputPath;
  const canvas = surface.getCanvas();

  // Draw original
  canvas.drawImage(src, 0, 0);

  // Face-aware softening
  const face = await detectFaceBounds(inputPath);
  const centerX = face ? face.x + face.width * 0.5 : width * 0.5;
  const centerY = face ? face.y + face.height * 0.45 : height * 0.42;
  const radiusX = face ? face.width * 0.9 : width * 0.38;
  const radiusY = face ? face.height * 1.1 : height * 0.32;

  // Build an oval mask path
  const mask = Skia.Path.Make();
  mask.addOval(Skia.XYWHRect(centerX - radiusX / 2, centerY - radiusY / 2, radiusX, radiusY));

  // Create a slightly blurred copy drawn only inside the oval mask
  const blurFilter = Skia.ImageFilter.MakeBlur(3, 3, TileMode.Decal, null);
  const blurPaint = Skia.Paint();
  blurPaint.setImageFilter(blurFilter);
  blurPaint.setAlphaf(0.6);
  canvas.save();
  canvas.clipPath(mask, true);
  canvas.drawImage(src, 0, 0, blurPaint);
  canvas.restore();

  // Gentle midtone lift using soft white overlay in center
  const liftPaint = Skia.Paint();
  liftPaint.setBlendMode(Skia.BlendMode.SoftLight);
  liftPaint.setColor(Skia.Color('rgba(255,255,255,0.12)'));
  canvas.save();
  canvas.clipPath(mask, true);
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), liftPaint);
  canvas.restore();

  // Mild vignette at edges for contrast
  const vignettePaint = Skia.Paint();
  vignettePaint.setBlendMode(Skia.BlendMode.Multiply);
  vignettePaint.setColor(Skia.Color('rgba(0,0,0,0.14)'));
  const vignettePath = Skia.Path.Make();
  vignettePath.addRect(Skia.XYWHRect(0, 0, width, height));
  const inner = Skia.Path.Make();
  inner.addOval(Skia.XYWHRect(width * 0.05, height * 0.05, width * 0.90, height * 0.90));
  vignettePath.op(inner, Skia.PathOp.Difference);
  canvas.drawPath(vignettePath, vignettePaint);

  // Export JPEG
  const resultImage = surface.makeImageSnapshot();
  const jpegBytes = resultImage.encodeToBytes(Skia.EncodedImageFormat.JPEG, 92);
  const jpegBase64 = encodeBase64(jpegBytes);
  const outPath = `${RNFS.CachesDirectoryPath}/beauty_${Date.now()}.jpg`;
  await RNFS.writeFile(outPath, jpegBase64, 'base64');
  return outPath;
}




