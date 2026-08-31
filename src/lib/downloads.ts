import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';

export const GALLERY_ALBUM_NAME = 'Connect';

// Use document directory for downloads on all platforms
export const DOWNLOADS_DIR = `${(FileSystem as any).documentDirectory || ''}downloads/`;

export type DownloadKind = 'video' | 'audio';

export type DownloadItem = {
  name: string;
  path: string;
  uri: string;
  size: number;
  mtime?: Date;
  kind: DownloadKind;
};

export function toFileUri(path: string): string {
  if (!path) return '';
  if (/^(file|content|ph|assets-library|http):/i.test(path)) return path;
  return `file://${path}`;
}

export function mediaKindFromName(name: string): DownloadKind {
  return /\.(mp3|m4a|aac|wav|ogg)$/i.test(name) ? 'audio' : 'video';
}

export async function ensureDownloadsDir(): Promise<string> {
  try {
    const exists = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!exists.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
    }
  } catch (_) {}
  return DOWNLOADS_DIR;
}

export type DownloadSaveOptions = {
  onProgress?: (percent: number, written: number, total: number) => void;
  extension?: 'mp4' | 'mp3' | 'm4a';
  isCancelled?: () => boolean;
  silent?: boolean;
};

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
}

function ensureExtension(name: string, ext: string): string {
  const clean = sanitizeFileName(name) || `file-${Date.now()}`;
  if (new RegExp(`\\.${ext}$`, 'i').test(clean)) return clean;
  const withoutExt = clean.replace(/\.[a-z0-9]+$/i, '');
  return `${withoutExt}.${ext}`;
}

async function uniqueFilePath(dir: string, name: string): Promise<string> {
  let candidate = `${dir}${name}`;
  const info = await FileSystem.getInfoAsync(candidate);
  if (!info.exists) return candidate;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  while (true) {
    const next = `${dir}${stem}-${i}${ext}`;
    const nextInfo = await FileSystem.getInfoAsync(next);
    if (!nextInfo.exists) return next;
    i += 1;
  }
}

export async function downloadVideoAndSave(
  url: string,
  suggestedName?: string,
  options: DownloadSaveOptions = {},
): Promise<string> {
  await ensureDownloadsDir();
  const ext = options.extension || 'mp4';
  const extRe = new RegExp(`\\.(${ext}|mp4|mp3|m4a)(\\b|$)`, 'i');

  const urlObj = new URL(url);
  let path = urlObj.pathname || '';
  if (path.endsWith('/')) path = path.replace(/\/+$/, '');
  let candidate = path.split('/').pop() || '';
  try { candidate = decodeURIComponent(candidate); } catch (_) {}
  if (!extRe.test(candidate)) {
    const match = decodeURIComponent(path).match(new RegExp(`([^\\/]+\\.(${ext}|mp4|mp3|m4a))(?:$|\\/)`, 'i'));
    if (match && match[1]) candidate = match[1];
  }
  if (!candidate) {
    candidate = `${ext === 'mp3' || ext === 'm4a' ? 'audio' : 'video'}-${Date.now()}.${ext}`;
  }

  const baseName = ensureExtension(suggestedName || candidate, ext);
  const toFile = await uniqueFilePath(DOWNLOADS_DIR, baseName);

  if (!options.silent) {
    await Notifications.requestPermissionsAsync();
  }
  if (Platform.OS !== 'web') {
    await requestGalleryPermission();
  }

  const notificationId = `dl-${Date.now()}`;
  if (!options.silent) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Downloading',
          body: `${baseName} — preparing...`,
        },
        trigger: null,
        identifier: notificationId,
      });
    } catch (_) {}
  }

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      toFile,
      {},
      (downloadProgressInfo) => {
        if (options.isCancelled?.()) return;
        const total = downloadProgressInfo.totalBytesExpectedToWrite || 0;
        const written = downloadProgressInfo.totalBytesWritten || 0;
        const pct = total > 0 ? Math.min(99, Math.round((written / total) * 100)) : 0;
        options.onProgress?.(pct, written, total);

        if (!options.silent) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: `Downloading ${pct}%`,
              body: `${baseName} — ${pct}% complete`,
            },
            trigger: null,
            identifier: notificationId,
          }).catch(() => {});
        }
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (options.isCancelled?.()) {
      try { await FileSystem.deleteAsync(toFile, { idempotent: true }); } catch (_) {}
      throw new Error('Download cancelled');
    }

    if (result && result.status === 200) {
      options.onProgress?.(100, 0, 0);
      const savedUri = toFileUri(result.uri);
      if (Platform.OS !== 'web') {
        try {
          await saveToDeviceGallery(savedUri);
        } catch (galleryError) {
          console.warn('Gallery save failed, file remains in Downloads:', galleryError);
        }
      }

      if (!options.silent) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Download complete',
              body: Platform.OS === 'ios'
                ? `${baseName} — saved to Photos`
                : `${baseName} — saved to Gallery`,
            },
            trigger: null,
            identifier: notificationId,
          });
        } catch (_) {}
      }

      return savedUri;
    }

    throw new Error(`Download failed with status ${result?.status}`);
  } catch (error) {
    if (!options.silent) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: options.isCancelled?.() ? 'Download cancelled' : 'Download failed',
            body: baseName,
          },
          trigger: null,
          identifier: notificationId,
        });
      } catch (_) {}
    }
    throw error;
  }
}

async function requestGalleryPermission(): Promise<boolean> {
  try {
    const granular: MediaLibrary.GranularPermission[] = ['video', 'audio', 'photo'];
    let permission = await MediaLibrary.requestPermissionsAsync(false, granular);
    if (permission.status !== 'granted') {
      permission = await MediaLibrary.requestPermissionsAsync(true, granular);
    }
    return permission.status === 'granted' || permission.accessPrivileges === 'limited';
  } catch (error) {
    console.warn('Gallery permission request failed:', error);
    return false;
  }
}

async function addAssetToAlbum(asset: MediaLibrary.Asset): Promise<void> {
  const existing = await MediaLibrary.getAlbumAsync(GALLERY_ALBUM_NAME);
  if (existing) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], existing, false);
    return;
  }
  await MediaLibrary.createAlbumAsync(GALLERY_ALBUM_NAME, asset, true);
}

export async function saveToDeviceGallery(fileUri: string): Promise<boolean> {
  const uri = toFileUri(fileUri);
  const granted = await requestGalleryPermission();
  if (!granted) {
    console.warn('Photos/Gallery permission was not granted');
    return false;
  }

  try {
    const asset = await MediaLibrary.createAssetAsync(uri);
    try {
      await addAssetToAlbum(asset);
    } catch (albumError) {
      console.warn('Created gallery asset but album update failed:', albumError);
    }
    return true;
  } catch (createError) {
    console.warn('createAssetAsync failed, trying saveToLibraryAsync:', createError);
  }

  try {
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (saveError) {
    console.warn('saveToLibraryAsync failed:', saveError);
  }

  try {
    const name = uri.split('/').pop() || `media-${Date.now()}.mp4`;
    const cacheUri = `${(FileSystem as any).cacheDirectory || ''}${name}`;
    await FileSystem.copyAsync({ from: uri, to: cacheUri });
    const copied = await MediaLibrary.createAssetAsync(toFileUri(cacheUri));
    try {
      await addAssetToAlbum(copied);
    } catch (_) {}
    return true;
  } catch (copyError) {
    console.error('Failed to save media to Photos/Gallery:', copyError);
    return false;
  }
}

export async function listDownloads(): Promise<DownloadItem[]> {
  await ensureDownloadsDir();
  try {
    const files = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);
    const mediaFiles = files.filter((name) => /\.(mp4|mp3|m4a|mov|webm)$/i.test(name));

    const fileInfos = await Promise.all(
      mediaFiles.map(async (name) => {
        const path = `${DOWNLOADS_DIR}${name}`;
        const info = await FileSystem.getInfoAsync(path);
        return {
          name,
          path,
          uri: toFileUri(path),
          size: (info as any).size || 0,
          mtime: (info as any).modificationTime ? new Date((info as any).modificationTime) : undefined,
          kind: mediaKindFromName(name),
        };
      })
    );

    return fileInfos;
  } catch (error) {
    console.error('Error listing downloads:', error);
    return [];
  }
}

export async function deleteDownload(path: string): Promise<void> {
  try { 
    await FileSystem.deleteAsync(path);
  } catch (_) {}
}


