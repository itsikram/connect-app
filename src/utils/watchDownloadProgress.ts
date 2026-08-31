export type WatchDownloadStatus = 'downloading' | 'completed' | 'failed';

export type WatchDownloadJob = {
  id: string;
  title: string;
  thumbnail?: string;
  status: WatchDownloadStatus;
  percent: number;
  error?: string;
  startedAt: number;
};

type Listener = (list: WatchDownloadJob[]) => void;

const listeners = new Set<Listener>();
const downloadsById: Record<string, WatchDownloadJob> = {};

const snapshot = () =>
  Object.values(downloadsById).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

const notify = () => {
  const list = snapshot();
  listeners.forEach((fn) => {
    try {
      fn(list);
    } catch (err) {
      console.warn('watchDownloadProgress listener error:', err);
    }
  });
};

export const getWatchDownloads = () => snapshot();

export const getWatchDownload = (id: string) => downloadsById[String(id)] || null;

export const subscribeWatchDownloads = (listener: Listener) => {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
};

export const startWatchDownload = (id: string, title = 'Watch video', thumbnail = '') => {
  const key = String(id);
  downloadsById[key] = {
    id: key,
    title,
    thumbnail,
    status: 'downloading',
    percent: 0,
    error: '',
    startedAt: Date.now(),
  };
  notify();
  return downloadsById[key];
};

export const updateWatchDownload = (id: string, patch: Partial<WatchDownloadJob>) => {
  const key = String(id);
  const prev = downloadsById[key];
  if (!prev) return null;
  downloadsById[key] = { ...prev, ...patch };
  notify();
  return downloadsById[key];
};

export const completeWatchDownload = (id: string) => {
  const key = String(id);
  if (!downloadsById[key]) return;
  downloadsById[key] = { ...downloadsById[key], status: 'completed', percent: 100 };
  notify();
  setTimeout(() => removeWatchDownload(key), 2500);
};

export const failWatchDownload = (id: string, error = 'Download failed') => {
  const key = String(id);
  if (!downloadsById[key]) return;
  downloadsById[key] = {
    ...downloadsById[key],
    status: 'failed',
    error: String(error || 'Download failed'),
  };
  notify();
};

export const removeWatchDownload = (id: string) => {
  const key = String(id);
  if (!downloadsById[key]) return;
  delete downloadsById[key];
  notify();
};
