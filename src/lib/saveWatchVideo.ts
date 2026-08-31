import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';
import {
  DOWNLOADS_DIR,
  downloadVideoAndSave,
  ensureDownloadsDir,
  sanitizeFileName,
  toFileUri,
} from './downloads';
import {
  completeWatchDownload,
  failWatchDownload,
  getWatchDownload,
  startWatchDownload,
  updateWatchDownload,
} from '../utils/watchDownloadProgress';

const WATCH_SAVED_META_KEY = '@watch_saved_meta';

export type WatchSavedMeta = {
  title: string;
  thumbnail?: string;
  caption?: string;
  authorName?: string;
  videoUrl?: string;
};

const watchFileName = (watchId: string) => `watch-${sanitizeFileName(String(watchId))}.mp4`;

export const parseWatchIdFromFileName = (name: string) => {
  const match = String(name || '').match(/^watch-(.+)\.mp4$/i);
  return match?.[1] || null;
};

export const getWatchSavedMetaMap = async (): Promise<Record<string, WatchSavedMeta>> => {
  try {
    const raw = await AsyncStorage.getItem(WATCH_SAVED_META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const putWatchSavedMeta = async (watchId: string, meta: WatchSavedMeta) => {
  const next = { ...(await getWatchSavedMetaMap()), [String(watchId)]: meta };
  await AsyncStorage.setItem(WATCH_SAVED_META_KEY, JSON.stringify(next)).catch(() => {});
};

export const removeWatchSavedMeta = async (watchId: string) => {
  const current = await getWatchSavedMetaMap();
  delete current[String(watchId)];
  await AsyncStorage.setItem(WATCH_SAVED_META_KEY, JSON.stringify(current)).catch(() => {});
};

export const getLocalWatchDownloadPath = async (watchId: string) => {
  await ensureDownloadsDir();
  const path = `${DOWNLOADS_DIR}${watchFileName(watchId)}`;
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
};

const watchTitle = (watch: any) =>
  watch?.caption ||
  watch?.title ||
  `${watch?.author?.fullName || watch?.author?.user?.firstName || 'Watch'} video`;

const watchThumbnail = (watch: any) =>
  watch?.thumbnail || watch?.photos || watch?.author?.profilePic || '';

const saveWatchToBackend = async (id: string, watch: any, sourceUrl: string) => {
  try {
    await api.post('saved-videos/save', {
      videoId: String(id),
      sourceUrl,
      metadata: {
        _id: watch?._id || id,
        caption: watchTitle(watch),
        thumbnail: watchThumbnail(watch),
        videoURL: sourceUrl,
        videoUrl: sourceUrl,
        author: {
          name: watch?.author?.fullName || watch?.author?.username || '',
          fullName: watch?.author?.fullName || '',
          profilePic: watch?.author?.profilePic || '',
        },
      },
    });
  } catch (err) {
    console.warn('[saveWatchVideo] backend save failed:', err);
  }
};

export const saveWatchVideoFromUrl = async (watch: {
  _id?: string;
  videoUrl?: string;
  photos?: string;
  caption?: string;
  thumbnail?: string;
  author?: any;
}) => {
  const id = String(watch?._id || '');
  const url = String(watch?.videoUrl || watch?.photos || '');
  if (!id || !url) {
    throw new Error('Missing video URL');
  }

  const existingJob = getWatchDownload(id);
  if (existingJob?.status === 'downloading') {
    return { ok: false, reason: 'in-progress' as const, title: watchTitle(watch) };
  }

  const title = watchTitle(watch);
  const thumbnail = watchThumbnail(watch);
  const meta: WatchSavedMeta = {
    title,
    thumbnail,
    caption: watch?.caption || title,
    authorName: watch?.author?.fullName || watch?.author?.username || '',
    videoUrl: url,
  };

  const localPath = await getLocalWatchDownloadPath(id);
  if (localPath) {
    await putWatchSavedMeta(id, meta);
    await saveWatchToBackend(id, watch, url);
    return { ok: true, reason: 'already-saved' as const, title, uri: toFileUri(localPath) };
  }

  startWatchDownload(id, title, thumbnail);

  try {
    const uri = await downloadVideoAndSave(url, watchFileName(id).replace(/\.mp4$/i, ''), {
      extension: 'mp4',
      exactName: true,
      onProgress: (percent) => {
        updateWatchDownload(id, { percent, status: 'downloading' });
      },
    });
    await putWatchSavedMeta(id, meta);
    await saveWatchToBackend(id, watch, url);
    completeWatchDownload(id);
    return { ok: true, reason: 'downloaded' as const, title, uri };
  } catch (err: any) {
    const message = err?.message || 'Failed to download video';
    failWatchDownload(id, message);
    throw err;
  }
};
