import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { downloadVideoAndSave } from './downloads';
import {
  extractYouTubeVideoId,
  getStageLabel,
  pollYoutubeDownloadProgress,
  startYoutubeDownloadJob,
} from './ytDownload';

export type BackgroundDownloadStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type BackgroundDownloadJob = {
  id: string;
  videoId: string;
  url: string;
  title: string;
  audioOnly: boolean;
  quality: number;
  postAsWatch: boolean;
  stage: string;
  progress: number;
  status: BackgroundDownloadStatus;
  error?: string;
  watchPosted?: boolean;
};

export type StartBackgroundDownloadOptions = {
  url: string;
  title?: string;
  quality?: number;
  audioOnly?: boolean;
  postAsWatch?: boolean;
};

type Listener = (jobs: BackgroundDownloadJob[]) => void;

const jobs = new Map<string, BackgroundDownloadJob>();
const cancelledIds = new Set<string>();
const listeners = new Set<Listener>();
const lastNotifyAt = new Map<string, number>();

const DOWNLOADS_CHANNEL = 'downloads';
let channelReady = false;

function snapshot(): BackgroundDownloadJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.id.localeCompare(a.id));
}

function emit() {
  const list = snapshot();
  listeners.forEach((listener) => {
    try {
      listener(list);
    } catch (error) {
      console.warn('Download job listener error:', error);
    }
  });
}

function patchJob(id: string, patch: Partial<BackgroundDownloadJob>) {
  const current = jobs.get(id);
  if (!current) return;
  jobs.set(id, { ...current, ...patch });
  emit();
}

async function ensureDownloadChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(DOWNLOADS_CHANNEL, {
      name: 'Downloads',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      sound: undefined,
    });
    channelReady = true;
  } catch (_) {}
}

async function updateJobNotification(job: BackgroundDownloadJob, force = false) {
  const now = Date.now();
  const last = lastNotifyAt.get(job.id) || 0;
  if (!force && now - last < 1500) return;
  lastNotifyAt.set(job.id, now);

  try {
    await ensureDownloadChannel();
    const content: Notifications.NotificationContentInput = {
      title:
        job.status === 'completed'
          ? 'Download complete'
          : job.status === 'failed'
            ? 'Download failed'
            : job.status === 'cancelled'
              ? 'Download cancelled'
              : `Downloading ${Math.round(job.progress)}%`,
      body:
        job.status === 'failed'
          ? job.error || job.title
          : `${job.title} — ${getStageLabel(job.stage)}`,
      sound: job.status === 'completed' || job.status === 'failed',
    };
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
      identifier: job.id,
    });
  } catch (_) {}
}

async function runJob(job: BackgroundDownloadJob) {
  const isCancelled = () => cancelledIds.has(job.id);

  try {
    await Notifications.requestPermissionsAsync();
    await updateJobNotification(job, true);

    const json = await startYoutubeDownloadJob({
      url: job.url,
      height: job.quality,
      postAsWatch: job.audioOnly ? false : job.postAsWatch,
      audioOnly: job.audioOnly,
    });

    if (isCancelled()) throw new Error('Download cancelled');

    const startedTitle = json?.title || json?.download_title || job.title;
    patchJob(job.id, {
      title: startedTitle,
      progress: Math.max(job.progress, json?.progress_id ? 5 : job.progress),
      stage: json?.progress_id ? 'preparing' : job.stage,
    });

    let fileUrl = json?.file_url;
    let finalTitle = startedTitle;
    let watchPosted = json?.watch_posted;

    if (json?.status === 'accepted' && json.progress_id) {
      const completed = await pollYoutubeDownloadProgress({
        progressId: json.progress_id,
        shouldCancel: isCancelled,
        onUpdate: (data) => {
          const next: Partial<BackgroundDownloadJob> = {
            progress: Math.max(jobs.get(job.id)?.progress || 0, Math.round(Number(data.pct) || 0)),
            stage: data.stage || 'downloading',
            title: data.title || jobs.get(job.id)?.title || job.title,
          };
          patchJob(job.id, next);
          const latest = jobs.get(job.id);
          if (latest) updateJobNotification(latest);
        },
      });
      fileUrl = completed.file_url;
      finalTitle = completed.title || finalTitle;
      watchPosted = completed.watch_posted;
    } else if (!(json?.status === 'completed' && json.file_url)) {
      throw new Error(json?.error || json?.message || 'Unexpected response from download server');
    }

    if (isCancelled()) throw new Error('Download cancelled');
    if (!fileUrl) throw new Error('Download finished but no file URL was returned');

    patchJob(job.id, {
      title: finalTitle,
      stage: 'saving',
      progress: Math.max(jobs.get(job.id)?.progress || 0, 5),
    });
    const saving = jobs.get(job.id);
    if (saving) await updateJobNotification(saving, true);

    await downloadVideoAndSave(fileUrl, finalTitle, {
      extension: job.audioOnly ? 'mp3' : 'mp4',
      silent: true,
      isCancelled,
      onProgress: (pct) => {
        patchJob(job.id, { stage: 'saving', progress: pct });
        const latest = jobs.get(job.id);
        if (latest) updateJobNotification(latest);
      },
    });

    patchJob(job.id, {
      status: 'completed',
      stage: 'completed',
      progress: 100,
      title: finalTitle,
      watchPosted: !!watchPosted,
    });
    const done = jobs.get(job.id);
    if (done) await updateJobNotification(done, true);

    setTimeout(() => {
      jobs.delete(job.id);
      lastNotifyAt.delete(job.id);
      cancelledIds.delete(job.id);
      emit();
    }, 8000);
  } catch (error: any) {
    if (isCancelled() || error?.message === 'Download cancelled') {
      patchJob(job.id, { status: 'cancelled', stage: 'failed', error: 'Download cancelled' });
      const cancelled = jobs.get(job.id);
      if (cancelled) await updateJobNotification(cancelled, true);
      jobs.delete(job.id);
      cancelledIds.delete(job.id);
      emit();
      return;
    }

    const status = error?.response?.status;
    const errMsg =
      status === 401
        ? 'Please log in to download videos'
        : error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to download video';
    console.error('Background YouTube download error:', error);
    patchJob(job.id, { status: 'failed', stage: 'failed', error: errMsg });
    const failed = jobs.get(job.id);
    if (failed) await updateJobNotification(failed, true);
  }
}

export function getBackgroundDownloadJobs(): BackgroundDownloadJob[] {
  return snapshot();
}

export function getActiveBackgroundDownloads(): BackgroundDownloadJob[] {
  return snapshot().filter((job) => job.status === 'running');
}

export function subscribeBackgroundDownloads(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function cancelBackgroundDownload(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== 'running') return;
  cancelledIds.add(id);
  patchJob(id, { stage: 'failed' });
}

export function dismissBackgroundDownload(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  if (job.status === 'running') {
    cancelBackgroundDownload(id);
    return;
  }
  jobs.delete(id);
  lastNotifyAt.delete(id);
  emit();
}

export function startBackgroundYoutubeDownload(options: StartBackgroundDownloadOptions): BackgroundDownloadJob {
  const videoId = extractYouTubeVideoId(options.url);
  if (!videoId) {
    throw new Error('Open a YouTube video first');
  }

  const alreadyRunning = snapshot().find(
    (job) => job.videoId === videoId && job.status === 'running' && job.audioOnly === !!options.audioOnly,
  );
  if (alreadyRunning) {
    throw new Error('This video is already downloading');
  }

  const job: BackgroundDownloadJob = {
    id: `yt-${videoId}-${Date.now()}`,
    videoId,
    url: options.url,
    title: options.title || `YouTube ${videoId}`,
    audioOnly: !!options.audioOnly,
    quality: options.quality || 1080,
    postAsWatch: options.audioOnly ? false : !!options.postAsWatch,
    stage: 'starting',
    progress: 2,
    status: 'running',
  };

  jobs.set(job.id, job);
  emit();
  runJob(job);
  return job;
}
