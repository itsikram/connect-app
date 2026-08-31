import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

export type PipPlaylistItem = {
  id: string;
  videoId?: string;
  watchId?: string;
  url: string;
  title: string;
  thumbnail?: string;
  playCount?: number;
};

export type PipState = {
  watchId: string | null;
  libraryVideoId: string | null;
  source: 'library' | 'watch';
  videoUrl: string;
  currentTime: number;
  playing: boolean;
  title: string;
  thumbnail: string;
  muted: boolean;
  looping: boolean;
  playlist: PipPlaylistItem[];
  playPass: number;
  videoId?: string;
  expandPath?: string;
};

export type PipStartData = Partial<PipState> & {
  videoUrl: string;
  pipId?: string;
};

type WatchPipContextValue = {
  pip: PipState | null;
  isPipActive: boolean;
  startPip: (data: PipStartData) => void;
  updatePip: (updates: Partial<PipState>) => void;
  closePip: () => void;
};

const WatchPipContext = createContext<WatchPipContextValue | null>(null);

export const useWatchPip = () => {
  const ctx = useContext(WatchPipContext);
  if (!ctx) {
    throw new Error('useWatchPip must be used within WatchPipProvider');
  }
  return ctx;
};

export const useWatchPipOptional = () => useContext(WatchPipContext);

export const WatchPipProvider = ({ children }: { children: ReactNode }) => {
  const [pip, setPip] = useState<PipState | null>(null);

  const startPip = useCallback((data: PipStartData) => {
    if (!data?.videoUrl) return;
    const watchId = data.watchId || null;
    const libraryVideoId = data.libraryVideoId || data.pipId || null;
    if (!watchId && !libraryVideoId) return;

    const source = data.source || (watchId ? 'watch' : 'library');

    setPip({
      watchId,
      libraryVideoId,
      source,
      videoUrl: data.videoUrl,
      currentTime: Number(data.currentTime) || 0,
      playing: data.playing !== false,
      title: data.title || (source === 'library' ? 'Video' : 'Watch'),
      thumbnail: data.thumbnail || '',
      muted: !!data.muted,
      looping: !!data.looping,
      playlist: Array.isArray(data.playlist) ? data.playlist : [],
      playPass: Math.max(1, Number(data.playPass) || 1),
      videoId: data.videoId || libraryVideoId || undefined,
      expandPath: data.expandPath || '',
    });
  }, []);

  const updatePip = useCallback((updates: Partial<PipState>) => {
    setPip((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const closePip = useCallback(() => setPip(null), []);

  const value = useMemo(
    () => ({
      pip,
      isPipActive: !!pip,
      startPip,
      updatePip,
      closePip,
    }),
    [pip, startPip, updatePip, closePip],
  );

  return <WatchPipContext.Provider value={value}>{children}</WatchPipContext.Provider>;
};

export default WatchPipContext;
