import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { listDownloads } from '../lib/downloads';
import { getWatchSavedMetaMap, parseWatchIdFromFileName } from '../lib/saveWatchVideo';

const PLAYLIST_STORAGE_KEY = 'videoPlayerCustomPlaylist';
const PLAYLIST_ORDER_KEY = 'videoPlayerPlaylistOrder';
const PLAY_QUEUE_KEY = 'videoPlayerPlayQueue';
const SAVED_PLAYLIST_CACHE_KEY = 'cached_video_player_saved';
const WATCH_PLAYLIST_CACHE_KEY = 'cached_video_player_watches';

export const MIN_PLAY_COUNT = 1;
export const MAX_PLAY_COUNT = 99;

export const SORT_OPTIONS = [
  { id: 'custom', label: 'Custom order' },
  { id: 'title-asc', label: 'Title A–Z' },
  { id: 'title-desc', label: 'Title Z–A' },
  { id: 'type', label: 'By source' },
] as const;

export const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'server', label: 'Server' },
  { id: 'local', label: 'Local' },
  { id: 'watch', label: 'Watches' },
  { id: 'saved', label: 'Saved' },
  { id: 'url', label: 'Custom' },
] as const;

export type PlaylistType = 'watch' | 'saved' | 'url' | 'file';
export type FilterId = (typeof FILTER_OPTIONS)[number]['id'];
export type SortId = (typeof SORT_OPTIONS)[number]['id'];

export type PlaylistItem = {
  id: string;
  url: string;
  title: string;
  type: PlaylistType;
  thumbnail: string;
  sourceId: string;
  online: boolean;
};

export type QueueItem = {
  queueId: string;
  videoId: string;
  url: string;
  title: string;
  thumbnail: string;
  type: PlaylistType;
  playCount: number;
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
};

export const normalizePlaylistItem = (item: any): PlaylistItem | null => {
  if (!item?.url) return null;
  return {
    id: String(item.id),
    url: item.url,
    title: item.title || 'Untitled video',
    type: item.type || 'url',
    thumbnail: item.thumbnail || '',
    sourceId: item.sourceId || item.savedVideoId || item.watchId || '',
    online: item.online !== false,
  };
};

export const loadCustomPlaylist = async (): Promise<PlaylistItem[]> => {
  const parsed = await readJson<any[]>(PLAYLIST_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizePlaylistItem).filter(Boolean) as PlaylistItem[];
};

export const saveCustomPlaylist = async (items: PlaylistItem[]) => {
  const customOnly = (items || []).filter((v) => v.type === 'url' || v.type === 'file');
  if (customOnly.length === 0) {
    await AsyncStorage.removeItem(PLAYLIST_STORAGE_KEY);
    return;
  }
  await writeJson(
    PLAYLIST_STORAGE_KEY,
    customOnly.map(({ id, url, title, type, sourceId, thumbnail, online }) => ({
      id,
      url,
      title,
      type,
      sourceId,
      thumbnail,
      online,
    })),
  );
};

export const loadPlaylistOrder = async (): Promise<string[]> => {
  const parsed = await readJson<any[]>(PLAYLIST_ORDER_KEY, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
};

export const savePlaylistOrder = async (orderIds: string[]) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    await AsyncStorage.removeItem(PLAYLIST_ORDER_KEY);
    return;
  }
  await writeJson(PLAYLIST_ORDER_KEY, orderIds);
};

export const sortPlaylist = (
  items: PlaylistItem[],
  sortMode: string,
  customOrder: string[] = [],
): PlaylistItem[] => {
  if (!items?.length) return [];

  if (sortMode === 'title-asc') {
    return [...items].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortMode === 'title-desc') {
    return [...items].sort((a, b) => b.title.localeCompare(a.title));
  }
  if (sortMode === 'type') {
    const typeOrder: Record<string, number> = { watch: 0, saved: 1, url: 2, file: 3 };
    return [...items].sort(
      (a, b) =>
        (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9) || a.title.localeCompare(b.title),
    );
  }

  if (sortMode === 'custom' && customOrder.length > 0) {
    const orderMap = new Map(customOrder.map((id, index) => [id, index]));
    return [...items].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.title.localeCompare(b.title);
    });
  }

  return items;
};

export const reorderPlaylistIds = (orderIds: string[], fromIndex: number, toIndex: number) => {
  const next = [...orderIds];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const syncPlaylistOrder = (orderIds: string[], items: PlaylistItem[]) => {
  const itemIds = items.map((item) => item.id);
  const kept = orderIds.filter((id) => itemIds.includes(id));
  const missing = itemIds.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
};

export const watchesToPlaylistItems = (watches: any[]): PlaylistItem[] => {
  if (!Array.isArray(watches)) return [];
  return watches
    .filter((w) => w?.videoUrl)
    .map((w) =>
      normalizePlaylistItem({
        id: `watch-${w._id}`,
        url: w.videoUrl,
        title: w.caption || `${w.author?.user?.firstName || w.author?.fullName || 'Watch'} video`,
        type: 'watch',
        thumbnail: w.thumbnail || w.photos || '',
        sourceId: w._id,
        online: true,
      }),
    )
    .filter(Boolean) as PlaylistItem[];
};

export const getCachedSavedPlaylist = async (): Promise<PlaylistItem[] | null> => {
  const parsed = await readJson<any[] | null>(SAVED_PLAYLIST_CACHE_KEY, null);
  if (!Array.isArray(parsed)) return null;
  return parsed.map(normalizePlaylistItem).filter(Boolean) as PlaylistItem[];
};

export const setCachedSavedPlaylist = async (items: PlaylistItem[]) => {
  if (!Array.isArray(items)) return;
  await writeJson(
    SAVED_PLAYLIST_CACHE_KEY,
    items.map(normalizePlaylistItem).filter(Boolean),
  );
};

export const getCachedWatchPlaylist = async (): Promise<PlaylistItem[] | null> => {
  const parsed = await readJson<any[] | null>(WATCH_PLAYLIST_CACHE_KEY, null);
  if (!Array.isArray(parsed)) return null;
  return parsed.map(normalizePlaylistItem).filter(Boolean) as PlaylistItem[];
};

export const setCachedWatchPlaylist = async (items: PlaylistItem[]) => {
  if (!Array.isArray(items)) return;
  await writeJson(
    WATCH_PLAYLIST_CACHE_KEY,
    items.map(normalizePlaylistItem).filter(Boolean),
  );
};

export const loadWatchPlaylistItems = async (profileId?: string): Promise<PlaylistItem[]> => {
  try {
    const response = await api.get('watch/related', {
      params: profileId ? { profile_id: profileId } : undefined,
    });
    const list = Array.isArray(response.data) ? response.data : [];
    const items = watchesToPlaylistItems(list);
    await setCachedWatchPlaylist(items);
    return items;
  } catch (err) {
    console.error('Failed to load watches for video player:', err);
    return (await getCachedWatchPlaylist()) || [];
  }
};

export const loadSavedPlaylistItems = async (): Promise<PlaylistItem[]> => {
  try {
    const [files, metaMap] = await Promise.all([listDownloads(), getWatchSavedMetaMap()]);
    const items = files
      .filter((f) => f.kind === 'video' || /\.(mp4|mov|webm|m4v)$/i.test(f.name))
      .map((f) => {
        const watchId = parseWatchIdFromFileName(f.name);
        const saved = watchId ? metaMap[watchId] : undefined;
        return normalizePlaylistItem({
          id: watchId ? `saved-${watchId}` : `saved-${f.path}`,
          url: f.uri,
          title: saved?.title || f.name.replace(/\.[^.]+$/, '') || f.name,
          type: 'saved',
          thumbnail: saved?.thumbnail || '',
          sourceId: watchId || f.path,
          online: false,
        });
      })
      .filter(Boolean) as PlaylistItem[];
    await setCachedSavedPlaylist(items);
    return items;
  } catch (err) {
    console.error('Failed to load saved videos for video player:', err);
    return (await getCachedSavedPlaylist()) || [];
  }
};

export const mergePlaylist = (...groups: PlaylistItem[][]): PlaylistItem[] => {
  const seen = new Set<string>();
  const merged: PlaylistItem[] = [];

  groups.flat().forEach((item) => {
    if (!item?.url) return;
    const key = `${item.type}:${item.sourceId || item.id}:${item.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
};

export const filterPlaylist = (items: PlaylistItem[], filter: string) => {
  if (!filter || filter === 'all') return items;
  if (filter === 'server') {
    return items.filter((v) => v.type === 'watch' || (v.type === 'url' && v.online !== false));
  }
  if (filter === 'local') {
    return items.filter((v) => v.type === 'saved' || v.type === 'file' || v.online === false);
  }
  if (filter === 'online') return items.filter((v) => v.type === 'watch' || v.type === 'url');
  if (filter === 'offline') return items.filter((v) => v.type === 'saved' || v.type === 'file');
  return items.filter((v) => v.type === filter);
};

export const getSourceLabel = (video?: PlaylistItem | QueueItem | null) => {
  if (!video) return '';
  if (video.type === 'watch') return 'Server · Watch';
  if (video.type === 'saved') return 'Local · Saved';
  if (video.type === 'file') return 'Local · File';
  return (video as PlaylistItem).online === false ? 'Local · URL' : 'Server · URL';
};

export const clampPlayCount = (value: unknown) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return MIN_PLAY_COUNT;
  return Math.min(MAX_PLAY_COUNT, Math.max(MIN_PLAY_COUNT, parsed));
};

export const normalizeQueueItem = (item: any): QueueItem | null => {
  if (!item?.url) return null;
  const videoId = String(item.videoId || item.id || '');
  if (!videoId) return null;
  return {
    queueId: String(
      item.queueId || `${videoId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ),
    videoId,
    url: item.url,
    title: item.title || 'Untitled video',
    thumbnail: item.thumbnail || '',
    type: item.type || 'url',
    playCount: clampPlayCount(item.playCount),
  };
};

export const loadPlayQueue = async (): Promise<QueueItem[]> => {
  const parsed = await readJson<any[]>(PLAY_QUEUE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeQueueItem).filter(Boolean) as QueueItem[];
};

export const savePlayQueue = async (items: QueueItem[]) => {
  if (!Array.isArray(items) || items.length === 0) {
    await AsyncStorage.removeItem(PLAY_QUEUE_KEY);
    return;
  }
  await writeJson(
    PLAY_QUEUE_KEY,
    items.map(({ queueId, videoId, url, title, thumbnail, type, playCount }) => ({
      queueId,
      videoId,
      url,
      title,
      thumbnail,
      type,
      playCount: clampPlayCount(playCount),
    })),
  );
};

export const videoToQueueItem = (video: PlaylistItem, playCount = MIN_PLAY_COUNT) =>
  normalizeQueueItem({
    videoId: video?.id,
    url: video?.url,
    title: video?.title,
    thumbnail: video?.thumbnail,
    type: video?.type,
    playCount,
  });

export const getTypeLabel = (type?: string) => {
  switch (type) {
    case 'watch':
      return 'Watch';
    case 'saved':
      return 'Saved';
    case 'file':
      return 'File';
    default:
      return 'URL';
  }
};
