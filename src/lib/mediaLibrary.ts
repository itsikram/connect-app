import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export type MediaItem = {
  path: string;
  name: string;
  type: 'image' | 'video';
  mtime: number;
};

const MEDIA_DIR = `${FileSystem.documentDirectory}ConnectMedia`;

function normalizeUri(value: string): string {
  if (!value) return value;
  return value.startsWith('file://') ? value : `file://${value}`;
}

export async function ensureMediaDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('ensureMediaDir error', e);
  }
}

function timestampString(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export async function savePhotoToMedia(tempPath: string): Promise<string> {
  await ensureMediaDir();
  const filename = `IMG_${timestampString()}.jpg`;
  const dest = `${MEDIA_DIR}/${filename}`;
  await FileSystem.copyAsync({
    from: normalizeUri(tempPath),
    to: normalizeUri(dest),
  });
  return dest;
}

export async function saveVideoToMedia(tempPath: string): Promise<string> {
  await ensureMediaDir();
  const ext = Platform.OS === 'ios' ? 'mov' : 'mp4';
  const filename = `VID_${timestampString()}.${ext}`;
  const dest = `${MEDIA_DIR}/${filename}`;
  await FileSystem.copyAsync({
    from: normalizeUri(tempPath),
    to: normalizeUri(dest),
  });
  return dest;
}

export async function listMedia(): Promise<MediaItem[]> {
  await ensureMediaDir();
  const entries = await FileSystem.readDirectoryAsync(MEDIA_DIR);
  const items: MediaItem[] = [];

  for (const entry of entries) {
    const fullPath = `${MEDIA_DIR}/${entry}`;
    const info = await FileSystem.getInfoAsync(fullPath);

    if (info.exists && info.isDirectory === false) {
      const lower = entry.toLowerCase();
      const type: 'image' | 'video' = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ? 'image' : 'video';
      items.push({
        path: fullPath,
        name: entry,
        type,
        mtime: info.modificationTime ? new Date(info.modificationTime).getTime() : 0,
      });
    }
  }

  return items.sort((a, b) => b.mtime - a.mtime);
}

export async function deleteMedia(path: string): Promise<void> {
  try {
    const target = path.startsWith('file://') ? path : normalizeUri(path);
    const exists = await FileSystem.getInfoAsync(target);
    if (exists.exists) await FileSystem.deleteAsync(target);
  } catch (e: any) {
    console.warn('deleteMedia error', e);
  }
}
