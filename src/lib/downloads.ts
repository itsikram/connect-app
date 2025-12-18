import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import notifee, { AndroidImportance } from '@notifee/react-native';

// Use public Downloads folder on Android, app documents on iOS
export const DOWNLOADS_DIR = Platform.OS === 'android' 
  ? RNFS.DownloadDirectoryPath 
  : `${RNFS.DocumentDirectoryPath}/downloads`;

export async function ensureDownloadsDir(): Promise<string> {
  try {
    // On Android, DownloadDirectoryPath already exists, no need to create
    // On iOS, create the downloads subdirectory if it doesn't exist
    if (Platform.OS === 'ios') {
      const exists = await RNFS.exists(DOWNLOADS_DIR);
      if (!exists) {
        await RNFS.mkdir(DOWNLOADS_DIR);
      }
    }
  } catch (_) {}
  return DOWNLOADS_DIR;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export async function downloadVideoAndSave(url: string, suggestedName?: string): Promise<string> {
  await ensureDownloadsDir();
  const urlObj = new URL(url);
  // Extract filename robustly even if URL ends with a trailing slash
  let path = urlObj.pathname || '';
  if (path.endsWith('/')) path = path.replace(/\/+$/, '');
  let candidate = path.split('/').pop() || '';
  try { candidate = decodeURIComponent(candidate); } catch (_) {}
  if (!/\.mp4(\b|$)/i.test(candidate)) {
    // Try to find any .mp4 occurrence within the path
    const match = decodeURIComponent(path).match(/([^\/]+\.mp4)(?:$|\/)/i);
    if (match && match[1]) candidate = match[1];
  }
  if (!candidate || !/\.mp4(\b|$)/i.test(candidate)) {
    candidate = `video-${Date.now()}.mp4`;
  }
  const baseName = sanitizeFileName(suggestedName || candidate);
  const toFile = `${DOWNLOADS_DIR}/${baseName}`;
  // Prepare notifications (Android/iOS 13+ may require permissions)
  try { await notifee.requestPermission(); } catch (_) {}
  let channelId = 'downloads';
  try {
    channelId = await notifee.createChannel({ id: 'downloads', name: 'Downloads', importance: AndroidImportance.LOW });
  } catch (_) {}

  const notificationId = `dl-${Date.now()}`;
  try {
    await notifee.displayNotification({
      id: notificationId,
      title: 'Downloading',
      body: `${baseName} — preparing...`,
      android: { channelId, onlyAlertOnce: true, ongoing: true, progress: { max: 100, current: 0, indeterminate: true } },
    });
  } catch (_) {}

  let lastPct = 0;
  const toMB = (n: number) => (n / (1024 * 1024));
  const result = await RNFS.downloadFile({
    fromUrl: url,
    toFile,
    discretionary: true,
    background: true,
    progressDivider: 2,
    progress: async (data) => {
      const total = Number(data.contentLength || 0);
      const written = Number(data.bytesWritten || 0);
      const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((written / total) * 100))) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        try {
          const writtenMb = toMB(written).toFixed(1);
          const totalMb = total > 0 ? toMB(total).toFixed(1) : undefined;
          const body = totalMb ? `${baseName} — ${pct}% (${writtenMb} / ${totalMb} MB)` : `${baseName} — ${writtenMb} MB`;
          await notifee.displayNotification({
            id: notificationId,
            title: total > 0 ? `Downloading ${pct}%` : 'Downloading',
            body,
            android: { channelId, onlyAlertOnce: true, ongoing: true, progress: { max: 100, current: pct, indeterminate: total === 0 } },
          });
        } catch (_) {}
      }
    },
  }).promise;
  if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
    try {
      await notifee.displayNotification({
        id: notificationId,
        title: 'Download complete',
        body: `${baseName} — saved`,
        android: { channelId, onlyAlertOnce: true, ongoing: false, progress: { max: 100, current: 100, indeterminate: false } },
      });
    } catch (_) {}
    return toFile;
  }
  try {
    await notifee.displayNotification({
      id: notificationId,
      title: 'Download failed',
      body: baseName,
      android: { channelId, onlyAlertOnce: true, ongoing: false },
    });
  } catch (_) {}
  throw new Error(`Download failed with status ${result.statusCode}`);
}

export async function listDownloads(): Promise<Array<{ name: string; path: string; size: number; mtime?: Date }>> {
  await ensureDownloadsDir();
  const entries = await RNFS.readDir(DOWNLOADS_DIR);
  const files = entries.filter(e => e.isFile() && /\.mp4$/i.test(e.name));
  return files.map(f => ({ name: f.name, path: f.path, size: f.size as any, mtime: f.mtime as any }));
}

export async function deleteDownload(path: string): Promise<void> {
  try { await RNFS.unlink(path); } catch (_) {}
}


