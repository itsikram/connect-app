import api from './api';
import config from './config';

export const QUALITY_OPTIONS = [
  { label: 'Best — up to 4K + HQ audio', value: 2160 },
  { label: '1440p + HQ audio', value: 1440 },
  { label: '1080p Full HD + HQ audio', value: 1080 },
  { label: '720p', value: 720 },
  { label: '480p', value: 480 },
  { label: '360p', value: 360 },
  { label: '240p', value: 240 },
] as const;

export type YtDownloadJobResult = {
  status: string;
  progress_id?: string;
  progress_url?: string;
  file_url?: string;
  title?: string;
  download_title?: string;
  watch_posted?: boolean;
  watch_id?: string;
  error?: string;
  message?: string;
  stage?: string;
  pct?: number;
};

export type YtDownloadProgress = {
  status: string;
  stage: string;
  pct: number;
  file_url?: string;
  title?: string;
  watch_posted?: boolean;
  watch_id?: string;
  progress_id?: string;
  error?: string;
};

const getDownloadApiBase = () => String(config.SOCKET_BASE_URL || '').replace(/\/+$/, '');

export function normalizeYouTubeUrl(url: string): string {
  return String(url || '').replace('m.youtube.com', 'www.youtube.com');
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const normalized = normalizeYouTubeUrl(url);
    const u = new URL(normalized);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0] || null;
    }
    const fromQuery = u.searchParams.get('v');
    if (fromQuery) return fromQuery;
    const pathMatch = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/);
    return pathMatch ? pathMatch[2] : null;
  } catch (_) {
    return null;
  }
}

export function isYouTubeVideoUrl(url: string): boolean {
  return !!extractYouTubeVideoId(url);
}

export function toWatchUrl(urlOrId: string): string | null {
  const id = extractYouTubeVideoId(urlOrId) || (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId) ? urlOrId : null);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getStageLabel(stage?: string): string {
  const labels: Record<string, string> = {
    starting: 'Starting…',
    preparing: 'Preparing on server…',
    downloading: 'Downloading on server…',
    uploading: 'Uploading…',
    uploading_watch: 'Posting to Watch…',
    transcoding: 'Processing…',
    saving: 'Saving to your device…',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[stage || ''] || stage || 'Preparing…';
}

export function buildDownloadRequestUrl({
  url,
  height = 1080,
  postAsWatch = false,
  audioOnly = false,
}: {
  url: string;
  height?: number;
  postAsWatch?: boolean;
  audioOnly?: boolean;
}): string {
  const encoded = encodeURIComponent(normalizeYouTubeUrl(url));
  const heightParam = !audioOnly && height ? `&height=${height}` : '';
  const watchParam = `&post_as_watch=${postAsWatch && !audioOnly ? 'true' : 'false'}`;
  const audioParam = audioOnly ? '&audio_only=true' : '';
  const ext = audioOnly ? 'mp3' : 'mp4';
  const apiUrl = getDownloadApiBase();
  return `${apiUrl}/download?url=${encoded}&ext=${ext}${heightParam}&disposition=inline&link_only=true&async_job=true${watchParam}${audioParam}`;
}

export async function startYoutubeDownloadJob(options: {
  url: string;
  height?: number;
  postAsWatch?: boolean;
  audioOnly?: boolean;
}): Promise<YtDownloadJobResult> {
  const requestUrl = buildDownloadRequestUrl(options);
  const response = await api.get(requestUrl, {
    timeout: 30000,
    headers: { Accept: 'application/json' },
    params: { _ts: Date.now() },
  });
  return response.data as YtDownloadJobResult;
}

export async function fetchYoutubeDownloadProgress(progressId: string): Promise<YtDownloadProgress> {
  const apiUrl = getDownloadApiBase();
  const response = await api.get(`${apiUrl}/progress/${progressId}`, {
    timeout: 15000,
    headers: { Accept: 'application/json' },
    params: { _ts: Date.now() },
  });
  return response.data as YtDownloadProgress;
}

export async function pollYoutubeDownloadProgress({
  progressId,
  onUpdate,
  shouldCancel,
  intervalMs = 1000,
}: {
  progressId: string;
  onUpdate?: (progress: YtDownloadProgress) => void;
  shouldCancel?: () => boolean;
  intervalMs?: number;
}): Promise<YtDownloadProgress> {
  let failures = 0;

  while (true) {
    if (shouldCancel?.()) {
      throw new Error('Download cancelled');
    }

    try {
      const data = await fetchYoutubeDownloadProgress(progressId);
      failures = 0;
      onUpdate?.(data);

      if (data.status === 'completed' && data.file_url) {
        return data;
      }
      if (data.status === 'failed' || data.status === 'error') {
        const raw = data.error || 'Download failed. Please try again.';
        const friendly = /format is not available|no video formats/i.test(raw)
          ? 'Download failed. Please try again in a moment.'
          : raw;
        const jobError = new Error(friendly) as Error & { isJobFailure?: boolean };
        jobError.isJobFailure = true;
        throw jobError;
      }
    } catch (err: any) {
      if (err?.message === 'Download cancelled' || err?.isJobFailure) throw err;
      failures += 1;
      if (failures >= 120) {
        throw new Error(
          'Lost connection to download progress. The video may still finish — try again in a moment.',
        );
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
