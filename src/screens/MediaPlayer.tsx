import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardSafeView from '../components/KeyboardSafeView';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Audio, Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from '../lib/avCompat';
import * as ImagePicker from 'expo-image-picker';
import { RootState } from '../store';
import { useWatchPipOptional } from '../contexts/WatchPipContext';
import { buildLibraryPipPayloadFromVideo } from '../utils/watchPipHelpers';
import { useWatchTokens } from '../theme/watchTokens';
import VoiceTextInput from '../components/VoiceTextInput';
import { subscribeWatchDownloads } from '../utils/watchDownloadProgress';
import {
  configurePipAudioMode,
  createPipBackgroundSound,
  unloadPipBackgroundSound,
  isAppBackgrounded,
} from '../lib/pipBackgroundPlayback';
import api from '../lib/api';
import {
  pollYoutubeDownloadProgress,
  startYoutubeDownloadJob,
} from '../lib/ytDownload';
import {
  loadCustomPlaylist,
  saveCustomPlaylist,
  loadWatchPlaylistItems,
  loadSavedPlaylistItems,
  mergePlaylist,
  filterPlaylist,
  sortPlaylist,
  loadPlaylistOrder,
  savePlaylistOrder,
  reorderPlaylistIds,
  syncPlaylistOrder,
  getTypeLabel,
  getSourceLabel,
  normalizePlaylistItem,
  loadPlayQueue,
  savePlayQueue,
  videoToQueueItem,
  clampPlayCount,
  MIN_PLAY_COUNT,
  MAX_PLAY_COUNT,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  getCachedSavedPlaylist,
  getCachedWatchPlaylist,
  PlaylistItem,
  QueueItem,
  FilterId,
  SortId,
} from '../utils/videoPlayerLibrary';

type MediaSource = {
  type?: 'video' | 'audio';
  uri: string;
  title?: string;
  poster?: string;
};

const ToolBtn = ({
  icon,
  onPress,
  disabled,
  primary,
  active,
  spinning,
  color,
  primaryColor,
  primaryText,
  btnBg,
  btnBorder,
  activeBg,
}: {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
  spinning?: boolean;
  color: string;
  primaryColor: string;
  primaryText: string;
  btnBg: string;
  btnBorder: string;
  activeBg: string;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.toolBtn,
      { backgroundColor: btnBg, borderColor: btnBorder },
      primary && { backgroundColor: primaryColor, borderColor: primaryColor, width: 52, height: 52, borderRadius: 26 },
      active && { backgroundColor: activeBg, borderColor: activeBg },
      disabled && styles.toolBtnDisabled,
    ]}
  >
    {spinning ? (
      <ActivityIndicator size="small" color={primary ? primaryText : color} />
    ) : (
      <Icon name={icon as any} size={primary ? 22 : 18} color={primary ? primaryText : color} />
    )}
  </Pressable>
);

const MediaPlayer = ({ route, navigation }: any) => {
  const t = useWatchTokens();
  const myProfileId = useSelector((state: RootState) => (state.profile as any)?._id);
  const watchPip = useWatchPipOptional();
  const params = route?.params || {};
  const paramsSource: MediaSource | undefined = params.source;

  const [customVideos, setCustomVideos] = useState<PlaylistItem[]>([]);
  const [watchVideos, setWatchVideos] = useState<PlaylistItem[]>([]);
  const [savedVideos, setSavedVideos] = useState<PlaylistItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');
  const [sortMode, setSortMode] = useState<SortId>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [youtubeSearching, setYoutubeSearching] = useState(false);
  const [youtubeSearchError, setYoutubeSearchError] = useState('');
  const [youtubeDownload, setYoutubeDownload] = useState<{
    queueId: string;
    title: string;
    percent: number;
    stage: string;
    error?: string;
  } | null>(null);
  const [playlistOrder, setPlaylistOrder] = useState<string[]>([]);
  const [playQueue, setPlayQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playPass, setPlayPass] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const [videoPosition, setVideoPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [scrubWidth, setScrubWidth] = useState(0);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setYoutubeResults([]);
      setYoutubeSearchError('');
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setYoutubeSearching(true);
      setYoutubeSearchError('');
      try {
        const response = await api.get('/yt-download/youtube/search', {
          params: { q: query, maxResults: 8, _ts: Date.now() },
        });
        if (!cancelled) setYoutubeResults(response.data?.items || []);
      } catch (_) {
        if (!cancelled) {
          setYoutubeResults([]);
          setYoutubeSearchError('YouTube search failed. Check your connection or API configuration.');
        }
      } finally {
        if (!cancelled) setYoutubeSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const videoRef = useRef<any | null>(null);
  const playUrlHandledRef = useRef('');
  const skipPipOnUnmount = useRef(false);
  const currentVideoRef = useRef<PlaylistItem | null>(null);
  const playlistPipRef = useRef<any[]>([]);
  const loopingRef = useRef(false);
  const pipReturnRef = useRef<{ resumeAt: number; autoplay: boolean } | null>(null);
  const currentPlaybackRef = useRef<QueueItem | null>(null);
  const resumeHandledRef = useRef(false);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const endedKeyRef = useRef('');
  const handleVideoEndRef = useRef<() => void>(() => {});
  const bgSoundRef = useRef<Audio.Sound | null>(null);
  const bgActiveRef = useRef(false);
  const handingOffRef = useRef(false);
  const wantPlayingRef = useRef(false);
  const libraryRefreshRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    configurePipAudioMode().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [custom, order, queue, cachedWatch, cachedSaved] = await Promise.all([
        loadCustomPlaylist(),
        loadPlaylistOrder(),
        loadPlayQueue(),
        getCachedWatchPlaylist(),
        getCachedSavedPlaylist(),
      ]);
      if (cancelled) return;
      setCustomVideos(custom);
      setPlaylistOrder(order);
      setPlayQueue(queue);
      if (cachedWatch?.length) setWatchVideos(cachedWatch);
      if (cachedSaved?.length) setSavedVideos(cachedSaved);
      setHydrated(true);
      setLibraryLoading(!(cachedWatch?.length || cachedSaved?.length || custom.length));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allVideos = useMemo(
    () => mergePlaylist(watchVideos, savedVideos, customVideos),
    [watchVideos, savedVideos, customVideos],
  );

  const filteredVideos = useMemo(() => {
    let list = filterPlaylist(allVideos, filter);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((v) => v.title.toLowerCase().includes(q));
    return sortPlaylist(list, sortMode, playlistOrder);
  }, [allVideos, filter, searchQuery, sortMode, playlistOrder]);

  const usingQueue = playQueue.length > 0;
  const playbackList = useMemo(() => {
    if (playQueue.length > 0) return playQueue;
    return filteredVideos.map((video) => ({
      queueId: video.id,
      videoId: video.id,
      url: video.url,
      title: video.title,
      thumbnail: video.thumbnail || '',
      type: video.type,
      playCount: MIN_PLAY_COUNT,
    }));
  }, [playQueue, filteredVideos]);

  const playbackIndex = usingQueue ? queueIndex : currentVideoIndex;
  const currentPlayback = playbackList[playbackIndex] || null;

  const currentVideo = useMemo(() => {
    if (!currentPlayback) return null;
    const fromLibrary = allVideos.find((video) => video.id === currentPlayback.videoId);
    if (fromLibrary) return { ...fromLibrary, title: currentPlayback.title };
    return {
      id: currentPlayback.videoId,
      url: currentPlayback.url,
      title: currentPlayback.title,
      thumbnail: currentPlayback.thumbnail,
      type: currentPlayback.type,
      sourceId: '',
      online: currentPlayback.type === 'watch' || currentPlayback.type === 'url',
    } as PlaylistItem;
  }, [currentPlayback, allVideos]);

  const currentTrackKey = currentPlayback
    ? `${currentPlayback.queueId}:${currentPlayback.url}`
    : '';
  currentVideoRef.current = currentVideo;
  loopingRef.current = isLooping;
  currentPlaybackRef.current = currentPlayback;
  isPlayingRef.current = isPlaying;

  const libraryPipPlaylist = useMemo(
    () =>
      playbackList.map((item) => ({
        id: item.queueId,
        videoId: item.videoId,
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail || '',
        playCount: clampPlayCount(item.playCount),
      })),
    [playbackList],
  );
  playlistPipRef.current = libraryPipPlaylist;

  const isThisPip =
    watchPip?.pip?.source === 'library' && !!watchPip.pip.videoUrl;

  useEffect(() => {
    setPlaylistOrder((prev) => {
      const synced = syncPlaylistOrder(prev, allVideos);
      if (synced.join('|') !== prev.join('|')) {
        savePlaylistOrder(synced);
        return synced;
      }
      return prev;
    });
  }, [allVideos]);

  const refreshLibrary = useCallback(
    async ({ showSpinner = false } = {}) => {
      if (libraryRefreshRef.current) {
        return libraryRefreshRef.current;
      }
      if (showSpinner) setLibraryLoading(true);
      setLibraryError('');
      const refreshPromise = (async () => {
        try {
          const [watches, saved] = await Promise.all([
            loadWatchPlaylistItems(myProfileId),
            loadSavedPlaylistItems(),
          ]);
          setWatchVideos(watches);
          setSavedVideos(saved);
        } catch (err) {
          console.error(err);
          setLibraryError('Could not refresh some video sources.');
        } finally {
          setLibraryLoading(false);
          libraryRefreshRef.current = null;
        }
      })();
      libraryRefreshRef.current = refreshPromise;
      return refreshPromise;
    },
    [myProfileId],
  );

  useEffect(() => {
    if (!hydrated) return;
    refreshLibrary();
  }, [hydrated, refreshLibrary]);

  useEffect(() => {
    return subscribeWatchDownloads((list) => {
      if (list.some((job) => job.status === 'completed')) {
        refreshLibrary();
      }
    });
  }, [refreshLibrary]);

  useEffect(() => {
    if (hydrated) saveCustomPlaylist(customVideos);
  }, [customVideos, hydrated]);

  useEffect(() => {
    if (hydrated) savePlayQueue(playQueue);
  }, [playQueue, hydrated]);

  useEffect(() => {
    if (currentVideoIndex >= filteredVideos.length) {
      setCurrentVideoIndex(filteredVideos.length > 0 ? filteredVideos.length - 1 : 0);
    }
  }, [filteredVideos.length, currentVideoIndex]);

  useEffect(() => {
    if (queueIndex >= playQueue.length) {
      setQueueIndex(playQueue.length > 0 ? playQueue.length - 1 : 0);
    }
  }, [playQueue.length, queueIndex]);

  useEffect(() => {
    setMediaReady(false);
    setVideoPosition(0);
    setVideoDuration(0);
    setIsPlaying(!isThisPip);
    endedKeyRef.current = '';
  }, [currentTrackKey, isThisPip]);

  const ingestPlayable = useCallback(
    (url: string, title?: string, thumbnail?: string) => {
      if (!url) return;
      const existing = allVideos.find((v) => v.url === url);
      if (existing) {
        const idx = filteredVideos.findIndex((v) => v.id === existing.id || v.url === url);
        if (idx >= 0) setCurrentVideoIndex(idx);
        return;
      }
      const newVideo = normalizePlaylistItem({
        id: `agent-${Date.now()}`,
        url,
        title: title || 'Video',
        type: 'url',
        thumbnail: thumbnail || '',
        online: /^https?:/i.test(url),
      });
      if (!newVideo) return;
      setCustomVideos((prev) => {
        if (prev.some((video) => video.url === url || video.id === newVideo.id)) return prev;
        return [...prev, newVideo];
      });
    },
    [allVideos, filteredVideos],
  );

  useEffect(() => {
    const playUrl = String(params.playUrl || paramsSource?.uri || '').trim();
    if (!playUrl || !hydrated) return;
    const existing = allVideos.find((v) => v.url === playUrl);
    if (existing) {
      playUrlHandledRef.current = playUrl;
      const idx = filteredVideos.findIndex((v) => v.id === existing.id || v.url === playUrl);
      if (idx >= 0) setCurrentVideoIndex(idx);
      return;
    }
    if (libraryLoading) return;
    if (playUrlHandledRef.current === playUrl) return;
    playUrlHandledRef.current = playUrl;
    ingestPlayable(playUrl, params.playTitle || paramsSource?.title, paramsSource?.poster);
  }, [
    params.playUrl,
    params.playTitle,
    paramsSource,
    ingestPlayable,
    hydrated,
    libraryLoading,
    allVideos,
    filteredVideos,
  ]);

  useEffect(() => {
    if (resumeHandledRef.current || filteredVideos.length === 0) return;
    if (params.videoId) {
      const idx = filteredVideos.findIndex((v) => v.id === params.videoId);
      if (idx >= 0) setCurrentVideoIndex(idx);
    }
    if (typeof params.resumeAt === 'number' && videoRef.current) {
      videoRef.current.setPositionAsync(params.resumeAt * 1000).catch(() => {});
      if (params.autoplay !== false) setIsPlaying(true);
    }
    if (params.videoId || typeof params.resumeAt === 'number') {
      resumeHandledRef.current = true;
      watchPip?.closePip?.();
    }
  }, [params.videoId, params.resumeAt, params.autoplay, filteredVideos, watchPip]);

  useEffect(() => {
    if (!isThisPip || !watchPip?.pip?.libraryVideoId) return;
    if (usingQueue) {
      const qIdx = playQueue.findIndex(
        (item) => item.queueId === watchPip.pip?.libraryVideoId,
      );
      if (qIdx >= 0 && qIdx !== queueIndex) setQueueIndex(qIdx);
    } else {
      const idx = filteredVideos.findIndex(
        (video) =>
          video.id === watchPip.pip?.libraryVideoId || video.id === watchPip.pip?.videoId,
      );
      if (idx >= 0 && idx !== currentVideoIndex) setCurrentVideoIndex(idx);
    }
    if (
      typeof watchPip.pip.playPass === 'number' &&
      watchPip.pip.playPass !== playPass
    ) {
      setPlayPass(clampPlayCount(watchPip.pip.playPass));
    }
  }, [
    isThisPip,
    watchPip?.pip?.libraryVideoId,
    watchPip?.pip?.videoId,
    watchPip?.pip?.playPass,
    usingQueue,
    playQueue,
    queueIndex,
    filteredVideos,
    currentVideoIndex,
    playPass,
  ]);

  useEffect(() => {
    if (!isThisPip) return;
    watchPip?.updatePip?.({ playlist: libraryPipPlaylist, playPass });
  }, [isThisPip, libraryPipPlaylist, playPass, watchPip]);

  useEffect(() => {
    if (!isThisPip || typeof watchPip?.pip?.looping !== 'boolean') return;
    if (watchPip.pip.looping !== isLooping) setIsLooping(watchPip.pip.looping);
  }, [isThisPip, watchPip?.pip?.looping, isLooping]);

  const restoreFromPip = useCallback(() => {
    const pipData = watchPip?.pip;
    if (!pipData) return;
    const qIdx = playQueue.findIndex(
      (item) =>
        item.queueId === pipData.libraryVideoId || item.videoId === pipData.videoId,
    );
    if (qIdx >= 0) setQueueIndex(qIdx);
    const idx = filteredVideos.findIndex(
      (video) => video.id === pipData.videoId || video.id === pipData.libraryVideoId,
    );
    if (idx >= 0) setCurrentVideoIndex(idx);
    if (typeof pipData.looping === 'boolean') setIsLooping(pipData.looping);
    if (typeof pipData.playPass === 'number') setPlayPass(clampPlayCount(pipData.playPass));
    pipReturnRef.current = {
      resumeAt: Number(pipData.currentTime) || 0,
      autoplay: pipData.playing !== false,
    };
    watchPip.closePip();
  }, [watchPip, filteredVideos, playQueue]);

  useEffect(() => {
    const resume = pipReturnRef.current;
    if (!resume || isThisPip) return;
    pipReturnRef.current = null;
    const apply = async () => {
      try {
        if (resume.resumeAt > 0) {
          await videoRef.current?.setPositionAsync(resume.resumeAt * 1000);
        }
        setIsPlaying(!!resume.autoplay);
      } catch (_) {}
    };
    apply();
  }, [isThisPip, currentTrackKey]);

  const pipExtras = useCallback(
    () => ({
      looping: loopingRef.current,
      playlist: playlistPipRef.current,
      playPass,
      videoId: currentPlaybackRef.current?.videoId,
    }),
    [playPass],
  );

  const startLibraryPip = useCallback(
    (forcePlay = false) => {
      if (!watchPip?.startPip || !currentVideoRef.current) return false;
      const playback = currentPlaybackRef.current;
      const playing = forcePlay || isPlayingRef.current;
      const payload = buildLibraryPipPayloadFromVideo(
        currentTimeRef.current,
        playing,
        {
          libraryVideoId: playback?.queueId || currentVideoRef.current.id,
          videoUrl: currentVideoRef.current.url,
          title: currentVideoRef.current.title,
          thumbnail: currentVideoRef.current.thumbnail,
        },
      );
      if (!payload) return false;
      skipPipOnUnmount.current = true;
      setIsPlaying(false);
      watchPip.startPip({
        ...payload,
        playing: forcePlay ? true : payload.playing !== false,
        ...pipExtras(),
      });
      return true;
    },
    [watchPip, pipExtras],
  );

  const minimizeToPip = useCallback(() => {
    startLibraryPip(true);
  }, [startLibraryPip]);

  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
      return () => {
        if (skipPipOnUnmount.current || isThisPip) return;
        startLibraryPip();
      };
    }, [refreshLibrary, startLibraryPip, isThisPip]),
  );

  const setPlaybackIndex = useCallback(
    (index: number, resetPass = true) => {
      if (resetPass) setPlayPass(1);
      if (playQueue.length > 0) setQueueIndex(index);
      else setCurrentVideoIndex(index);
    },
    [playQueue.length],
  );

  const replayCurrent = useCallback(async () => {
    wantPlayingRef.current = true;
    try {
      if (bgActiveRef.current && bgSoundRef.current) {
        currentTimeRef.current = 0;
        await bgSoundRef.current.setPositionAsync(0);
        await bgSoundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }
      await videoRef.current?.setPositionAsync(0);
      setIsPlaying(true);
    } catch (_) {}
  }, []);

  const stopPlayback = useCallback(() => {
    wantPlayingRef.current = false;
    videoRef.current?.pauseAsync().catch(() => {});
    bgSoundRef.current?.pauseAsync().catch(() => {});
    setIsPlaying(false);
  }, []);

  const handleVideoEnd = useCallback(() => {
    const item = currentPlaybackRef.current;
    const times = clampPlayCount(item?.playCount);
    if (playPass < times) {
      setPlayPass((prev) => prev + 1);
      replayCurrent();
      return;
    }
    if (playbackList.length <= 1) {
      if (isLooping) {
        setPlayPass(1);
        replayCurrent();
      } else {
        stopPlayback();
      }
      return;
    }
    const nextIndex = playbackIndex + 1;
    if (nextIndex >= playbackList.length) {
      if (isLooping) {
        setPlayPass(1);
        setPlaybackIndex(0);
        return;
      }
      stopPlayback();
      return;
    }
    setPlaybackIndex(nextIndex);
  }, [
    playPass,
    playbackList.length,
    playbackIndex,
    isLooping,
    replayCurrent,
    stopPlayback,
    setPlaybackIndex,
  ]);

  handleVideoEndRef.current = handleVideoEnd;

  const stopBackgroundSound = useCallback(async () => {
    const sound = bgSoundRef.current;
    bgSoundRef.current = null;
    bgActiveRef.current = false;
    return unloadPipBackgroundSound(sound);
  }, []);

  const startBackgroundSound = useCallback(async () => {
    const video = currentVideoRef.current;
    if (!video?.url || handingOffRef.current || !wantPlayingRef.current) return;
    handingOffRef.current = true;
    try {
      let positionMillis = Math.max(0, currentTimeRef.current * 1000);
      if (videoRef.current) {
        const status = await videoRef.current.getStatusAsync();
        if (status.isLoaded) {
          positionMillis = status.positionMillis || positionMillis;
          currentTimeRef.current = positionMillis / 1000;
        }
        await videoRef.current.pauseAsync();
        await videoRef.current.setIsMutedAsync(true);
      }
      if (bgSoundRef.current) {
        await unloadPipBackgroundSound(bgSoundRef.current);
        bgSoundRef.current = null;
      }
      const sound = await createPipBackgroundSound({
        uri: video.url,
        positionMillis,
        title: video.title,
        onEnded: () => handleVideoEndRef.current(),
      });
      bgSoundRef.current = sound;
      bgActiveRef.current = true;
    } catch (err) {
      console.warn('Media player background handoff failed', err);
      bgActiveRef.current = false;
      try {
        await videoRef.current?.setIsMutedAsync(false);
        if (wantPlayingRef.current) await videoRef.current?.playAsync();
      } catch (_) {}
    } finally {
      handingOffRef.current = false;
    }
  }, []);

  useEffect(() => {
    wantPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (isAppBackgrounded(next) && wantPlayingRef.current) {
        await startBackgroundSound();
        return;
      }
      if (next === 'active' && bgActiveRef.current) {
        const positionMillis = await stopBackgroundSound();
        currentTimeRef.current = positionMillis / 1000;
        try {
          if (positionMillis > 0) await videoRef.current?.setPositionAsync(positionMillis);
          await videoRef.current?.setIsMutedAsync(false);
          if (wantPlayingRef.current) await videoRef.current?.playAsync();
        } catch (_) {}
      }
    });
    return () => {
      subscription.remove();
      stopBackgroundSound();
    };
  }, [startBackgroundSound, stopBackgroundSound]);

  useEffect(() => {
    if (!bgActiveRef.current || !wantPlayingRef.current) return;
    const restartForTrack = async () => {
      await stopBackgroundSound();
      await startBackgroundSound();
    };
    restartForTrack();
  }, [currentTrackKey, startBackgroundSound, stopBackgroundSound]);

  const switchLibraryPipByOffset = useCallback(
    (offset: number) => {
      const list = watchPip?.pip?.playlist;
      if (!watchPip?.updatePip || !Array.isArray(list) || list.length === 0) return;
      const currentId = watchPip.pip.libraryVideoId;
      const idx = Math.max(0, list.findIndex((item) => item.id === currentId));
      const next = list[(idx + offset + list.length) % list.length];
      if (!next) return;
      watchPip.updatePip({
        libraryVideoId: next.id,
        videoId: next.videoId,
        videoUrl: next.url,
        title: next.title,
        thumbnail: next.thumbnail || '',
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    },
    [watchPip],
  );

  const handlePrev = useCallback(() => {
    if (currentTimeRef.current > 3) {
      replayCurrent();
      return;
    }
    if (playbackList.length <= 1) {
      replayCurrent();
      return;
    }
    if (isThisPip) {
      switchLibraryPipByOffset(-1);
      return;
    }
    setPlaybackIndex((playbackIndex - 1 + playbackList.length) % playbackList.length);
  }, [
    playbackList.length,
    playbackIndex,
    isThisPip,
    switchLibraryPipByOffset,
    setPlaybackIndex,
    replayCurrent,
  ]);

  const handleNext = useCallback(() => {
    if (playbackList.length <= 1) {
      replayCurrent();
      return;
    }
    if (isThisPip) {
      switchLibraryPipByOffset(1);
      return;
    }
    setPlaybackIndex((playbackIndex + 1) % playbackList.length);
  }, [playbackList.length, playbackIndex, isThisPip, switchLibraryPipByOffset, setPlaybackIndex, replayCurrent]);

  const addToPlayQueue = useCallback((video: PlaylistItem, playCount = MIN_PLAY_COUNT) => {
    const item = videoToQueueItem(video, playCount);
    if (!item) return null;
    setPlayQueue((prev) => {
      if (prev.length === 0) {
        setQueueIndex(0);
        setPlayPass(1);
      }
      return [...prev, item];
    });
    return item.queueId;
  }, []);

  const handleSelectYoutubeResult = useCallback(async (result: any) => {
    if (!result?.url) return;
    const youtubeId = result.videoId;
    const existingWatch = watchVideos.find((video) => video.youtubeId === youtubeId);
    if (existingWatch) {
      addToPlayQueue(existingWatch);
      setSearchQuery('');
      return;
    }
    const existing = allVideos.find((video) => video.url === result.url);
    const newVideo = normalizePlaylistItem({
      id: `youtube-${result.videoId || Date.now()}`,
      url: result.url,
      title: result.title || 'YouTube video',
      thumbnail: result.thumbnail || '',
      type: 'url',
      online: true,
    });
    if (!newVideo) return;
    const selectedVideo = existing || newVideo;
    if (!existing) {
      setCustomVideos((prev) => [...prev, newVideo]);
    }
    const downloadQueueId = addToPlayQueue(selectedVideo);
    setSearchQuery('');
    try {
      if (!downloadQueueId) {
        throw new Error('Could not add the video to the playlist.');
      }
      setYoutubeDownload({
        queueId: downloadQueueId,
        title: result.title || 'YouTube video',
        percent: 2,
        stage: 'Starting download…',
      });
      const started = await startYoutubeDownloadJob({
        url: result.url,
        height: 1080,
        postAsWatch: true,
      });
      const replaceWithWatch = (completed: any) => {
        if (!completed?.file_url) return;
        const watchItem = normalizePlaylistItem({
          id: completed.watch_id ? `watch-${completed.watch_id}` : selectedVideo.id,
          sourceId: completed.watch_id || selectedVideo.sourceId,
          url: completed.file_url,
          title: completed.title || result.title || 'YouTube video',
          thumbnail: result.thumbnail || '',
          type: completed.watch_id ? 'watch' : selectedVideo.type,
          online: true,
          youtubeId,
        });
        if (!watchItem) return;
        setCustomVideos((prev) => prev.filter((video) => video.id !== newVideo.id));
        setPlayQueue((prev) => prev.map((item) => item.videoId === selectedVideo.id
          ? { ...item, videoId: watchItem.id, url: watchItem.url, title: watchItem.title, thumbnail: watchItem.thumbnail, type: watchItem.type }
          : item));
      };
      if (started.status === 'completed') {
        replaceWithWatch(started);
        setYoutubeDownload((prev) => ({
          ...(prev || { queueId: downloadQueueId, title: result.title || 'YouTube video' }),
          percent: 100,
          stage: 'Complete',
        }));
        await refreshLibrary({ showSpinner: false });
        setTimeout(() => setYoutubeDownload(null), 2500);
        return;
      }
      if (started.status === 'accepted' && started.progress_id) {
        pollYoutubeDownloadProgress({
          progressId: started.progress_id,
          onUpdate: (data) => setYoutubeDownload((prev) => ({
            ...(prev || {
              queueId: downloadQueueId,
              title: result.title || 'YouTube video',
            }),
            percent: Math.max(prev?.percent || 0, Math.round(Number(data.pct) || 0)),
            stage: data.stage || 'Downloading…',
          })),
        }).then(async (completed) => {
          replaceWithWatch(completed);
          setYoutubeDownload((prev) => ({
            ...(prev || { queueId: downloadQueueId, title: result.title || 'YouTube video' }),
            percent: 100,
            stage: 'Complete',
          }));
          await refreshLibrary({ showSpinner: false });
          setTimeout(() => setYoutubeDownload(null), 2500);
        }).catch((error) => {
          setYoutubeDownload((prev) => ({
            ...(prev || {
              queueId: downloadQueueId,
              title: result.title || 'YouTube video',
              percent: 0,
              stage: 'Downloading…',
            }),
            stage: 'Failed',
            error: error?.message,
          }));
          Alert.alert('Download failed', error?.message || 'YouTube download failed.');
        });
      } else if (started.status !== 'completed') {
        throw new Error(started.error || started.message || 'Could not start YouTube download.');
      }
      Alert.alert('Download started', 'Added to your playlist and posting to Watch in the background.');
    } catch (error: any) {
      setYoutubeDownload({
        queueId: downloadQueueId || '',
        title: result.title || 'YouTube video',
        percent: 0,
        stage: 'Failed',
        error: error?.message,
      });
      Alert.alert('Download failed', error?.message || 'Could not start YouTube download.');
    }
  }, [addToPlayQueue, allVideos, refreshLibrary, watchVideos]);

  const updateQueuePlayCount = useCallback((queueId: string, nextCount: number) => {
    setPlayQueue((prev) =>
      prev.map((item) =>
        item.queueId === queueId ? { ...item, playCount: clampPlayCount(nextCount) } : item,
      ),
    );
  }, []);

  const removeFromPlayQueue = useCallback((queueId: string) => {
    setPlayQueue((prev) => prev.filter((item) => item.queueId !== queueId));
  }, []);

  const clearPlayQueue = useCallback(() => {
    setPlayQueue([]);
    setQueueIndex(0);
    setPlayPass(1);
  }, []);

  const applyQueueReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPlayQueue((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setQueueIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < prev && toIndex >= prev) return prev - 1;
      if (fromIndex > prev && toIndex <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const handleAddVideo = () => {
    const url = videoUrl.trim();
    if (!url) return;
    const newVideo = normalizePlaylistItem({
      id: `custom-${Date.now()}`,
      url,
      title: videoTitle.trim() || `Video ${customVideos.length + 1}`,
      type: 'url',
      online: true,
    });
    if (!newVideo) return;
    setCustomVideos((prev) => [...prev, newVideo]);
    addToPlayQueue(newVideo);
    setFilter('all');
    setVideoUrl('');
    setVideoTitle('');
  };

  const handleFileUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const newVideo = normalizePlaylistItem({
        id: `file-${Date.now()}`,
        url: asset.uri,
        title: videoTitle.trim() || asset.fileName || 'Uploaded video',
        type: 'file',
        thumbnail: asset.uri,
        online: false,
      });
      if (!newVideo) return;
      setCustomVideos((prev) => [...prev, newVideo]);
      addToPlayQueue(newVideo);
      setFilter('all');
      setVideoTitle('');
    } catch (err) {
      console.warn('Video pick failed', err);
    }
  };

  const handleRemoveVideo = (video: PlaylistItem) => {
    if (video.type === 'url' || video.type === 'file') {
      setCustomVideos((prev) => prev.filter((v) => v.id !== video.id));
    }
    setPlaylistOrder((prev) => {
      const next = prev.filter((id) => id !== video.id);
      savePlaylistOrder(next);
      return next;
    });
    setPlayQueue((prev) => prev.filter((item) => item.videoId !== video.id));
    setCurrentVideoIndex((prev) => Math.max(0, prev - 1));
  };

  const handlePlayVideo = (index: number) => {
    const video = filteredVideos[index];
    if (usingQueue && video) {
      addToPlayQueue(video);
      return;
    }
    if (isThisPip && video && watchPip?.updatePip) {
      watchPip.updatePip({
        libraryVideoId: video.id,
        videoId: video.id,
        videoUrl: video.url,
        title: video.title,
        thumbnail: video.thumbnail || '',
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    }
    setPlayPass(1);
    setCurrentVideoIndex(index);
  };

  const handlePlayQueueItem = (index: number) => {
    const item = playQueue[index];
    if (!item) return;
    setQueueIndex(index);
    setPlayPass(1);
    if (isThisPip && watchPip?.updatePip) {
      watchPip.updatePip({
        libraryVideoId: item.queueId,
        videoId: item.videoId,
        videoUrl: item.url,
        title: item.title,
        thumbnail: item.thumbnail || '',
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    }
  };

  const togglePlayPause = () => {
    if (isThisPip) {
      watchPip?.updatePip?.({ playing: watchPip.pip?.playing === false });
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const applyPlaylistReorder = (fromIndex: number, toIndex: number) => {
    if (sortMode !== 'custom' || fromIndex === toIndex) return;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= filteredVideos.length ||
      toIndex >= filteredVideos.length
    ) {
      return;
    }
    const visibleIds = filteredVideos.map((v) => v.id);
    const reorderedVisible = reorderPlaylistIds(visibleIds, fromIndex, toIndex);
    setPlaylistOrder((prev) => {
      const base = prev.length ? [...prev] : allVideos.map((v) => v.id);
      const visibleSet = new Set(visibleIds);
      const withoutVisible = base.filter((id) => !visibleSet.has(id));
      const firstVisibleIdx = base.findIndex((id) => visibleSet.has(id));
      const insertAt = firstVisibleIdx >= 0 ? firstVisibleIdx : withoutVisible.length;
      const next = [
        ...withoutVisible.slice(0, insertAt),
        ...reorderedVisible,
        ...withoutVisible.slice(insertAt),
      ];
      savePlaylistOrder(next);
      return next;
    });
    if (currentVideoIndex === fromIndex) setCurrentVideoIndex(toIndex);
    else if (fromIndex < currentVideoIndex && toIndex >= currentVideoIndex) {
      setCurrentVideoIndex((prev) => prev - 1);
    } else if (fromIndex > currentVideoIndex && toIndex <= currentVideoIndex) {
      setCurrentVideoIndex((prev) => prev + 1);
    }
  };

  const playerIsPlaying = isThisPip ? watchPip?.pip?.playing !== false : isPlaying;

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleSeekTo = useCallback(async (value: number) => {
    if (!videoRef.current || !Number.isFinite(value)) return;
    const safeValue = Math.max(0, Math.min(value, videoDuration || value));
    await videoRef.current.setPositionAsync(Math.max(0, safeValue * 1000));
    setVideoPosition(safeValue);
  }, [videoDuration]);

  const videoProgressPercent = videoDuration > 0 ? Math.min(100, (videoPosition / videoDuration) * 100) : 0;

  const stats = useMemo(
    () => ({
      watches: watchVideos.length,
      saved: savedVideos.length,
      custom: customVideos.length,
      total: allVideos.length,
    }),
    [watchVideos.length, savedVideos.length, customVideos.length, allVideos.length],
  );

  const videoSource = useMemo(
    () => (currentVideo?.url ? { uri: currentVideo.url } : undefined),
    [currentVideo?.url],
  );

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setMediaReady(true);
    const nextPos = (status.positionMillis || 0) / 1000;
    const nextDuration = (status.durationMillis || 0) / 1000;
    currentTimeRef.current = nextPos;
    setVideoPosition(nextPos);
    if (nextDuration > 0) setVideoDuration(nextDuration);
    if (status.didJustFinish && endedKeyRef.current !== currentTrackKey) {
      endedKeyRef.current = currentTrackKey;
      handleVideoEndRef.current();
    }
  }, [currentTrackKey]);

  const toolBtnTheme = {
    color: t.text,
    primaryColor: t.primary,
    primaryText: t.ctaText,
    btnBg: t.btnBg,
    btnBorder: t.chipBorder,
    activeBg: t.success + '38',
  };

  const renderReorder = (
    index: number,
    length: number,
    onMove: (from: number, to: number) => void,
  ) => (
    <View style={styles.reorderCol}>
      <Pressable
        style={styles.reorderBtn}
        disabled={index === 0}
        onPress={() => onMove(index, index - 1)}
      >
        <Icon name="expand-less" size={16} color={index === 0 ? t.disabled : t.text} />
      </Pressable>
      <Pressable
        style={styles.reorderBtn}
        disabled={index === length - 1}
        onPress={() => onMove(index, index + 1)}
      >
        <Icon name="expand-more" size={16} color={index === length - 1 ? t.disabled : t.text} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: t.pageBg }]} edges={['left', 'right' ]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.pageBg} />
      <KeyboardSafeView nested>
        <View style={styles.header}>
          <Pressable style={[styles.headerBtn, { backgroundColor: t.btnBg }]} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={20} color={t.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.text }]}>Video Player</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.stats}>
            <Text style={[styles.statPill, { color: t.muted, backgroundColor: t.chipBg, borderColor: t.chipBorder }]}>{stats.total} total</Text>
            <Text style={[styles.statPill, { color: t.muted, backgroundColor: t.chipBg, borderColor: t.chipBorder }]}>{stats.watches} watches</Text>
            <Text style={[styles.statPill, { color: t.muted, backgroundColor: t.chipBg, borderColor: t.chipBorder }]}>{stats.saved} saved</Text>
            <Text style={[styles.statPill, { color: t.muted, backgroundColor: t.chipBg, borderColor: t.chipBorder }]}>{stats.custom} custom</Text>
          </View>

          {libraryError ? <Text style={[styles.error, { color: t.error }]}>{libraryError}</Text> : null}
          {currentVideo ? (
            <View style={[styles.stage, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.stageHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stageTitle, { color: t.text }]} numberOfLines={2}>
                    {currentVideo.title}
                  </Text>
                  <Text style={[styles.stageMeta, { color: t.muted }]}>
                    {getSourceLabel(currentVideo)}
                    {' · '}
                    {usingQueue ? 'Playlist' : 'Library'} {playbackIndex + 1} of {playbackList.length}
                    {currentPlayback?.playCount > 1
                      ? ` · Repeat ${playPass}/${clampPlayCount(currentPlayback.playCount)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.stageActions}>
                  <Text style={[styles.badge, { color: t.ctaText, backgroundColor: t.primarySoft }]}>{getTypeLabel(currentVideo.type)}</Text>
                  {watchPip && !isThisPip ? (
                    <Pressable style={[styles.popupBadge, { backgroundColor: t.primarySoft }]} onPress={minimizeToPip}>
                      <Icon name="picture-in-picture-alt" size={13} color={t.primary} />
                      <Text style={[styles.popupBadgeText, { color: t.primary }]}>Popup</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.stageFrame}>
                {isThisPip ? (
                  <View style={[styles.pipPlaceholder, { backgroundColor: t.pageBgAlt }]}>
                    <Text style={[styles.pipPlaceholderText, { color: t.text }]}>Playing in pop-out mode</Text>
                    <Pressable style={[styles.secondaryBtn, { backgroundColor: t.btnBg }]} onPress={restoreFromPip}>
                      <Text style={[styles.secondaryBtnText, { color: t.text }]}>Return here</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <ExpoVideo
                      ref={(node) => {
                        videoRef.current = node;
                      }}
                      source={videoSource}
                      style={styles.video}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={isPlaying && !bgActiveRef.current}
                      isLooping={false}
                      useNativeControls={false}
                      progressUpdateIntervalMillis={500}
                      posterSource={
                        currentVideo.thumbnail ? { uri: currentVideo.thumbnail } : undefined
                      }
                      onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                    />
                    {!mediaReady ? (
                      <View style={styles.cover} pointerEvents="none">
                        {currentVideo.thumbnail ? (
                          <Image source={{ uri: currentVideo.thumbnail }} style={styles.coverImg} />
                        ) : (
                          <ActivityIndicator color={t.mediaIcon} />
                        )}
                      </View>
                    ) : null}

                    <View style={[styles.videoController, { backgroundColor: 'rgba(0,0,0,0.38)' }]}>
                      <View style={styles.timeRow}>
                        <Text style={[styles.timeText, { color: '#fff' }]}>{formatTime(videoPosition)}</Text>
                        <Text style={[styles.timeText, { color: '#fff' }]}>{formatTime(videoDuration)}</Text>
                      </View>
                      <Pressable
                        style={styles.scrubBar}
                        onLayout={(event) => setScrubWidth(event.nativeEvent.layout.width)}
                        onPress={({ nativeEvent }) => {
                          const width = scrubWidth || 300;
                          const percent = Math.max(0, Math.min(1, (nativeEvent.locationX || 0) / Math.max(width, 1)));
                          handleSeekTo(videoDuration * percent);
                        }}
                      >
                        <View style={[styles.scrubTrack, { backgroundColor: 'rgba(255,255,255,0.28)' }]}>
                          <View style={[styles.scrubFill, { width: `${videoProgressPercent}%`, backgroundColor: t.primary }]} />
                        </View>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>

              <View style={[styles.toolbar, { backgroundColor: t.overlay }]}>
                <ToolBtn
                  icon="refresh"
                  onPress={() => refreshLibrary({ showSpinner: true })}
                  disabled={libraryLoading}
                  spinning={libraryLoading}
                  {...toolBtnTheme}
                />
                <ToolBtn
                  icon="skip-previous"
                  onPress={handlePrev}
                  disabled={playbackList.length <= 1}
                  {...toolBtnTheme}
                />
                <ToolBtn
                  icon={playerIsPlaying ? 'pause' : 'play-arrow'}
                  onPress={togglePlayPause}
                  primary
                  {...toolBtnTheme}
                />
                <ToolBtn
                  icon="skip-next"
                  onPress={handleNext}
                  disabled={playbackList.length <= 1}
                  {...toolBtnTheme}
                />
                <ToolBtn
                  icon="repeat"
                  onPress={() => {
                    setIsLooping((prev) => {
                      const next = !prev;
                      if (isThisPip) watchPip?.updatePip?.({ looping: next });
                      return next;
                    });
                  }}
                  active={isLooping}
                  {...toolBtnTheme}
                />
                {watchPip && !isThisPip ? (
                  <ToolBtn icon="picture-in-picture-alt" onPress={minimizeToPip} {...toolBtnTheme} />
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.emptyStage, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={[styles.emptyTitle, { color: t.text }]}>No videos in library</Text>
              <Text style={[styles.emptyHint, { color: t.muted }]}>
                Add a URL, upload a file, or save/download videos to populate your playlist
              </Text>
              <Pressable
                style={[styles.secondaryBtn, { backgroundColor: t.btnBg }]}
                onPress={() => refreshLibrary({ showSpinner: true })}
                disabled={libraryLoading}
              >
                <Text style={[styles.secondaryBtnText, { color: t.text }]}>
                  {libraryLoading ? 'Refreshing…' : 'Refresh library'}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Playlist</Text>
              <Text style={[styles.count, { color: t.muted }]}>{playQueue.length} videos</Text>
            </View>
            <Text style={[styles.hint, { color: t.tertiary }]}>
              Add clips, then set how many times each one plays before the next video starts.
            </Text>
            {playQueue.length > 0 ? (
              <Pressable style={[styles.smallBtn, { backgroundColor: t.btnBg }]} onPress={clearPlayQueue}>
                <Text style={[styles.smallBtnText, { color: t.text }]}>Clear playlist</Text>
              </Pressable>
            ) : null}
            {playQueue.length > 1 ? (
              <Text style={[styles.hint, { color: t.tertiary }]}>Use the arrow buttons to reorder the playlist</Text>
            ) : null}
            {playQueue.length > 0 ? (
              playQueue.map((item, index) => (
                <Pressable
                  key={item.queueId}
                  style={[
                    styles.listItem,
                    { backgroundColor: t.listBg },
                    usingQueue && index === queueIndex && { backgroundColor: t.primarySoft },
                  ]}
                  onPress={() => handlePlayQueueItem(index)}
                >
                  {playQueue.length > 1
                    ? renderReorder(index, playQueue.length, applyQueueReorder)
                    : null}
                  <View style={[styles.thumb, { backgroundColor: t.btnBg }]}>
                    {item.thumbnail ? (
                      <Image source={{ uri: item.thumbnail }} style={styles.coverImg} />
                    ) : usingQueue && index === queueIndex && playerIsPlaying ? (
                      <Text style={[styles.playingMark, { color: t.success }]}>▶</Text>
                    ) : (
                      <Text style={[styles.playNumber, { color: t.muted }]}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: t.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: t.muted }]}>
                      {usingQueue && index === queueIndex
                        ? `Playing ${playPass} of ${clampPlayCount(item.playCount)}`
                        : `Play ${clampPlayCount(item.playCount)} time${clampPlayCount(item.playCount) === 1 ? '' : 's'}`}
                    </Text>
                    {youtubeDownload?.queueId === item.queueId ? (
                      <View style={[styles.downloadProgress, { backgroundColor: t.surface, borderColor: t.border }]}>
                        <View style={styles.downloadProgressHeader}>
                          <Text style={[styles.itemMeta, { color: t.primary }]}>
                            {youtubeDownload.percent}%
                          </Text>
                          <Text
                            style={[styles.itemMeta, { color: youtubeDownload.error ? t.error : t.muted }]}
                            numberOfLines={1}
                          >
                            {youtubeDownload.error || youtubeDownload.stage}
                          </Text>
                        </View>
                        <View style={styles.downloadTrack}>
                          <View
                            style={[
                              styles.downloadFill,
                              {
                                width: `${Math.min(100, Math.max(0, youtubeDownload.percent))}%`,
                                backgroundColor: t.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.repeatControl}>
                    <Pressable
                      style={[styles.repeatBtn, { backgroundColor: t.btnBg }]}
                      disabled={item.playCount <= MIN_PLAY_COUNT}
                      onPress={() => updateQueuePlayCount(item.queueId, item.playCount - 1)}
                    >
                      <Text style={[styles.repeatBtnText, { color: t.text }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.repeatValue, { color: t.text }]}>{item.playCount}</Text>
                    <Pressable
                      style={[styles.repeatBtn, { backgroundColor: t.btnBg }]}
                      disabled={item.playCount >= MAX_PLAY_COUNT}
                      onPress={() => updateQueuePlayCount(item.queueId, item.playCount + 1)}
                    >
                      <Text style={[styles.repeatBtnText, { color: t.text }]}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeFromPlayQueue(item.queueId)}
                  >
                    <Text style={[styles.removeBtnText, { color: t.error }]}>×</Text>
                  </Pressable>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyList}>
                <Text style={[styles.emptyListTitle, { color: t.text }]}>Playlist is empty</Text>
                <Text style={[styles.hint, { color: t.tertiary }]}>Add videos from the library below, or paste a URL</Text>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Library</Text>
              <View style={styles.headerActions}>
                <Text style={[styles.count, { color: t.muted }]}>{filteredVideos.length} videos</Text>
                {filteredVideos.length > 0 ? (
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: t.btnBg }]}
                    onPress={() => filteredVideos.forEach((video) => addToPlayQueue(video))}
                  >
                    <Text style={[styles.smallBtnText, { color: t.text }]}>Add all</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
              {FILTER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.filterBtn,
                    { backgroundColor: t.chipBg },
                    filter === opt.id && { backgroundColor: t.primaryMid },
                  ]}
                  onPress={() => {
                    setFilter(opt.id);
                    setCurrentVideoIndex(0);
                  }}
                >
                  <Text style={[styles.filterText, { color: t.muted }, filter === opt.id && { color: t.ctaText, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <VoiceTextInput
              style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              placeholder="Search library…"
              placeholderTextColor={t.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.trim() ? (
              <View style={[styles.youtubeResults, { borderColor: t.border, backgroundColor: t.inputBg }]}>
                <Text style={[styles.youtubeHeading, { color: t.muted }]}>
                  YouTube {youtubeSearching ? 'searching…' : ''}
                </Text>
                {youtubeSearchError ? (
                  <Text style={[styles.hint, { color: t.error }]}>{youtubeSearchError}</Text>
                ) : null}
                {youtubeResults.map((result) => (
                  <Pressable
                    key={result.videoId}
                    style={[styles.youtubeResult, { borderTopColor: t.border }]}
                    onPress={() => handleSelectYoutubeResult(result)}
                  >
                    <Image source={{ uri: result.thumbnail }} style={styles.youtubeThumb} />
                    <View style={styles.youtubeResultInfo}>
                      <Text style={[styles.itemTitle, { color: t.text }]} numberOfLines={2}>{result.title}</Text>
                      <Text style={[styles.itemMeta, { color: t.muted }]} numberOfLines={1}>{result.channelTitle}</Text>
                    </View>
                    <Icon name="add" size={20} color={t.primary} />
                  </Pressable>
                ))}
                {!youtubeSearching && youtubeResults.length === 0 ? (
                  <Text style={[styles.hint, { color: t.tertiary }]}>No YouTube results</Text>
                ) : null}
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
              {SORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.filterBtn,
                    { backgroundColor: t.chipBg },
                    sortMode === opt.id && { backgroundColor: t.primaryMid },
                  ]}
                  onPress={() => {
                    setSortMode(opt.id);
                    setCurrentVideoIndex(0);
                  }}
                >
                  <Text style={[styles.filterText, { color: t.muted }, sortMode === opt.id && { color: t.ctaText, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {sortMode === 'custom' && filteredVideos.length > 1 ? (
              <Text style={[styles.hint, { color: t.tertiary }]}>Use the arrow buttons to reorder videos</Text>
            ) : null}

            {libraryLoading && filteredVideos.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={[styles.emptyListTitle, { color: t.text }]}>Loading your videos…</Text>
              </View>
            ) : filteredVideos.length > 0 ? (
              filteredVideos.map((video, index) => (
                <Pressable
                  key={video.id}
                  style={[
                    styles.listItem,
                    { backgroundColor: t.listBg },
                    ((!usingQueue && index === currentVideoIndex) ||
                      (usingQueue && currentPlayback?.videoId === video.id)) &&
                      { backgroundColor: t.primarySoft },
                  ]}
                  onPress={() => handlePlayVideo(index)}
                >
                  {sortMode === 'custom'
                    ? renderReorder(index, filteredVideos.length, applyPlaylistReorder)
                    : null}
                  <View style={[styles.thumb, { backgroundColor: t.btnBg }]}>
                    {video.thumbnail ? (
                      <Image source={{ uri: video.thumbnail }} style={styles.coverImg} />
                    ) : !usingQueue && index === currentVideoIndex && playerIsPlaying ? (
                      <Text style={[styles.playingMark, { color: t.success }]}>▶</Text>
                    ) : (
                      <Text style={[styles.playNumber, { color: t.muted }]}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: t.text }]} numberOfLines={2}>
                      {video.title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: t.muted }]}>{getSourceLabel(video)}</Text>
                  </View>
                  <Pressable style={[styles.addBtn, { backgroundColor: t.primarySoft }]} onPress={() => addToPlayQueue(video)}>
                    <Text style={[styles.addBtnText, { color: t.primary }]}>Add</Text>
                  </Pressable>
                  {(video.type === 'url' || video.type === 'file') && (
                    <Pressable style={styles.removeBtn} onPress={() => handleRemoveVideo(video)}>
                      <Text style={[styles.removeBtnText, { color: t.error }]}>×</Text>
                    </Pressable>
                  )}
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyList}>
                <Text style={[styles.emptyListTitle, { color: t.text }]}>No videos match this filter</Text>
                <Text style={[styles.hint, { color: t.tertiary }]}>Try All or Server, or refresh the library</Text>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Add custom video</Text>
            <Text style={[styles.inputLabel, { color: t.muted }]}>Video title (optional)</Text>
            <VoiceTextInput
              style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              placeholder="Enter video title"
              placeholderTextColor={t.placeholder}
              value={videoTitle}
              onChangeText={setVideoTitle}
            />
            <Text style={[styles.inputLabel, { color: t.muted }]}>Video URL</Text>
            <VoiceTextInput
              style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              placeholder="https://example.com/video.mp4"
              placeholderTextColor={t.placeholder}
              value={videoUrl}
              onChangeText={setVideoUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: t.primary }, !videoUrl.trim() && styles.toolBtnDisabled]}
              disabled={!videoUrl.trim()}
              onPress={handleAddVideo}
            >
              <Text style={[styles.primaryBtnText, { color: t.ctaText }]}>Add from URL</Text>
            </Pressable>
            <Pressable style={[styles.secondaryBtn, { backgroundColor: t.btnBg }]} onPress={handleFileUpload}>
              <Text style={[styles.secondaryBtnText, { color: t.text }]}>Upload file</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'blue' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  statPill: {
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  error: { textAlign: 'center' },
  downloadProgress: { borderWidth: 1, borderRadius: 8, padding: 6, gap: 4, marginTop: 4 },
  downloadProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadTrack: { height: 6, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(148,163,184,0.25)' },
  downloadFill: { height: '100%', borderRadius: 99 },
  stage: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  stageTitle: { fontSize: 16, fontWeight: '700' },
  stageMeta: { fontSize: 12, marginTop: 4 },
  stageActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  popupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  popupBadgeText: { fontSize: 11, fontWeight: '700' },
  stageFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoController: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timeText: { fontSize: 11, fontWeight: '600' },
  scrubBar: { width: '100%' },
  scrubTrack: { width: '100%', height: 8, borderRadius: 999, overflow: 'hidden' },
  scrubFill: { height: '100%', borderRadius: 999 },
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  coverImg: { width: '100%', height: '100%' },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pipPlaceholderText: { fontSize: 14 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 12,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnDisabled: { opacity: 0.35 },
  emptyStage: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { textAlign: 'center', marginTop: 8, marginBottom: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: 12 },
  hint: { fontSize: 12 },
  smallBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: { fontSize: 12, fontWeight: '600' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: '600' },
  itemMeta: { fontSize: 11, marginTop: 2 },
  playingMark: { fontSize: 14 },
  playNumber: { fontSize: 13, fontWeight: '700' },
  reorderCol: { gap: 2 },
  reorderBtn: {
    width: 22,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatControl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repeatBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBtnText: { fontSize: 14, fontWeight: '700' },
  repeatValue: { minWidth: 16, textAlign: 'center', fontSize: 12 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 22, lineHeight: 24 },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { fontSize: 12, fontWeight: '700' },
  emptyList: { paddingVertical: 16, alignItems: 'center' },
  emptyListTitle: { fontSize: 14, marginBottom: 4 },
  filters: { flexGrow: 0 },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
  },
  filterText: { fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  youtubeResults: { borderWidth: 1, borderRadius: 10, padding: 8, gap: 4 },
  youtubeHeading: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  youtubeResult: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingVertical: 6 },
  youtubeThumb: { width: 72, height: 42, borderRadius: 5 },
  youtubeResultInfo: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: 12 },
  primaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '600' },
});

export default MediaPlayer;
