import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

export type MediaItem = {
  path: string;
  name: string;
  type: 'image' | 'video';
  mtime: number;
};

// Use app-local documents dir so no external storage permissions are required
export const MEDIA_DIR = `${RNFS.DocumentDirectoryPath}/ConnectMedia`;

export async function ensureMediaDir(): Promise<void> {
  try {
    const exists = await RNFS.exists(MEDIA_DIR);
    if (!exists) {
      await RNFS.mkdir(MEDIA_DIR);
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
  await RNFS.copyFile(tempPath.startsWith('file://') ? tempPath.replace('file://', '') : tempPath, dest);
  return dest;
}

export async function saveVideoToMedia(tempPath: string): Promise<string> {
  await ensureMediaDir();
  const ext = Platform.OS === 'ios' ? 'mov' : 'mp4';
  const filename = `VID_${timestampString()}.${ext}`;
  const dest = `${MEDIA_DIR}/${filename}`;
  await RNFS.copyFile(tempPath.startsWith('file://') ? tempPath.replace('file://', '') : tempPath, dest);
  return dest;
}

export async function listMedia(): Promise<MediaItem[]> {
  await ensureMediaDir();
  const entries = await RNFS.readDir(MEDIA_DIR);
  const items: MediaItem[] = entries
    .filter((e) => e.isFile())
    .map((e) => {
      const lower = e.name.toLowerCase();
      const type: 'image' | 'video' = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ? 'image' : 'video';
      return { path: e.path, name: e.name, type, mtime: e.mtime ? new Date(e.mtime).getTime() : 0 };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return items;
}

export async function deleteMedia(path: string): Promise<void> {
  try {
    const exists = await RNFS.exists(path);
    if (exists) await RNFS.unlink(path);
  } catch (e) {
    console.warn('deleteMedia error', e);
  }
}
