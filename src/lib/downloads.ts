import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';

// Use document directory for downloads on all platforms
export const DOWNLOADS_DIR = `${(FileSystem as any).documentDirectory || ''}downloads/`;

export async function ensureDownloadsDir(): Promise<string> {
  try {
    const exists = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!exists.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
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
  const toFile = `${DOWNLOADS_DIR}${baseName}`;
  
  // Request permissions for notifications
  await Notifications.requestPermissionsAsync();
  
  // Create download progress notification
  const notificationId = `dl-${Date.now()}`;
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

  try {
    // Download the file using Expo FileSystem
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      toFile,
      {},
      (downloadProgressInfo) => {
        const progress = downloadProgressInfo.totalBytesWritten / downloadProgressInfo.totalBytesExpectedToWrite;
        const pct = Math.round(progress * 100);
        
        // Update notification with progress
        Notifications.scheduleNotificationAsync({
          content: {
            title: `Downloading ${pct}%`,
            body: `${baseName} — ${pct}% complete`,
          },
          trigger: null,
          identifier: notificationId,
        }).catch(() => {});
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    if (result && result.status === 200) {
      // Save to media library on Android/iOS
      if (Platform.OS !== 'web') {
        try {
          const asset = await MediaLibrary.createAssetAsync(result.uri);
          await MediaLibrary.createAlbumAsync('Downloads', asset, false);
        } catch (_) {
          // If saving to media library fails, file is still saved to app directory
        }
      }
      
      // Show completion notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Download complete',
            body: `${baseName} — saved`,
          },
          trigger: null,
          identifier: notificationId,
        });
      } catch (_) {}
      
      return result.uri;
    }
    
    throw new Error(`Download failed with status ${result?.status}`);
  } catch (error) {
    // Show error notification
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Download failed',
          body: baseName,
        },
        trigger: null,
        identifier: notificationId,
      });
    } catch (_) {}
    throw error;
  }
}

export async function listDownloads(): Promise<Array<{ name: string; path: string; size: number; mtime?: Date }>> {
  await ensureDownloadsDir();
  try {
    const files = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);
    const mp4Files = files.filter(name => /\.mp4$/i.test(name));
    
    const fileInfos = await Promise.all(
      mp4Files.map(async (name) => {
        const path = `${DOWNLOADS_DIR}${name}`;
        const info = await FileSystem.getInfoAsync(path);
        return {
          name,
          path,
          size: (info as any).size || 0,
          mtime: (info as any).modificationTime ? new Date((info as any).modificationTime) : undefined,
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


