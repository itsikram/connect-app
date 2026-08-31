import { PipPlaylistItem, PipStartData, PipState } from '../contexts/WatchPipContext';

export const buildPipPayloadFromVideo = (
  currentTime: number,
  playing: boolean,
  meta: PipStartData,
): PipStartData | null => {
  if (!meta.videoUrl) return null;
  const watchId = meta.watchId || null;
  const libraryVideoId = meta.libraryVideoId || meta.pipId || null;
  if (!watchId && !libraryVideoId) return null;

  const hasProgress = (currentTime || 0) > 0.2;
  if (!playing && !hasProgress) return null;

  return {
    watchId,
    libraryVideoId,
    source: meta.source || (watchId ? 'watch' : 'library'),
    videoUrl: meta.videoUrl,
    currentTime: currentTime || 0,
    playing,
    muted: !!meta.muted,
    title: meta.title || (watchId ? 'Watch' : 'Video'),
    thumbnail: meta.thumbnail || '',
    looping: !!meta.looping,
    playlist: Array.isArray(meta.playlist) ? meta.playlist : [],
    expandPath: meta.expandPath || '',
  };
};

export const buildLibraryPipPayloadFromVideo = (
  currentTime: number,
  playing: boolean,
  meta: PipStartData,
) =>
  buildPipPayloadFromVideo(currentTime, playing, {
    ...meta,
    source: 'library',
    libraryVideoId: meta.libraryVideoId || meta.pipId,
  });

export const getPipPlaylistIndex = (
  playlist: PipPlaylistItem[],
  pipState: PipState | null,
) => {
  if (!Array.isArray(playlist) || !pipState) return -1;
  const ids = [pipState.libraryVideoId, pipState.watchId, pipState.videoId]
    .filter(Boolean)
    .map(String);

  return playlist.findIndex((item) => {
    const itemIds = [item.id, item.watchId, item.videoId].filter(Boolean).map(String);
    return itemIds.some((id) => ids.includes(id));
  });
};
