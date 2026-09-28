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
  BackHandler,
} from 'react-native';
import Modal from '../components/SystemBarsModal';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardSafeView from '../components/KeyboardSafeView';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import {
  Audio,
  Video as ExpoVideo,
  ResizeMode,
  AVPlaybackStatus,
  supportsNativeVideoBackgroundPlayback,
} from '../lib/avCompat';
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
import { useAudioEqualizer } from '../hooks/useAudioEqualizer';
import EqualizerModal from '../components/EqualizerModal';
import api from '../lib/api';
import {
  extractYouTubeVideoId,
  isYouTubeVideoUrl,
  pollYoutubeDownloadProgress,
  startYoutubeDownloadJob,
} from '../lib/ytDownload';
import {
  YoutubeDownloadBanner,
  YoutubeDownloadSheet,
  useBackgroundDownloadJobs,
  useBackgroundDownloadToasts,
} from '../components/YoutubeDownloadUI';
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
  watchesToPlaylistItems,
  loadPlayQueue,
  savePlayQueue,
  loadPlaybackState,
  savePlaybackState,
  videoToQueueItem,
  clampPlayCount,
  MIN_PLAY_COUNT,
  MAX_PLAY_COUNT,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  getCachedSavedPlaylist,
  getCachedWatchPlaylist,
  loadSavedPlaylists,
  saveNamedPlaylist,
  deleteNamedPlaylist,
  PlaylistItem,
  QueueItem,
  SavedPlaylist,
  PlaybackState,
  FilterId,
  SortId,
} from '../utils/videoPlayerLibrary';

type MediaSource = {
  type?: 'video' | 'audio';
  uri: string;
  title?: string;
  poster?: string;
};

const TABS = [
  { id: 'queue', label: 'Up next', icon: 'queue-play-next' },
  { id: 'library', label: 'Library', icon: 'video-library' },
  { id: 'saved', label: 'Playlists', icon: 'playlist-play' },
  { id: 'add', label: 'Add', icon: 'add-circle-outline' },
] as const;

const SEARCH_SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'watch', label: 'Watches' },
  { id: 'youtube', label: 'YouTube' },
] as const;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');
  const [sortMode, setSortMode] = useState<SortId>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [youtubeSearching, setYoutubeSearching] = useState(false);
  const [youtubeSearchError, setYoutubeSearchError] = useState('');
  const [serverWatchResults, setServerWatchResults] = useState<PlaylistItem[]>([]);
  const [watchSearching, setWatchSearching] = useState(false);
  const [watchSearchError, setWatchSearchError] = useState('');
  const [watchAuthors, setWatchAuthors] = useState<Record<string, string>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<'all' | 'watch' | 'youtube'>('all');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'library' | 'saved' | 'add'>('queue');
  const [youtubeDownload, setYoutubeDownload] = useState<{
    queueId: string;
    title: string;
    percent: number;
    stage: string;
    error?: string;
  } | null>(null);
  // Video picked for the YouTube download sheet (same flow as the YouTube screen).
  const [downloadTarget, setDownloadTarget] = useState<{
    videoId: string;
    title: string;
    thumbnail?: string;
  } | null>(null);
  const backgroundDownloads = useBackgroundDownloadJobs();
  useBackgroundDownloadToasts(backgroundDownloads);
  const [playlistOrder, setPlaylistOrder] = useState<string[]>([]);
  const [playQueue, setPlayQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playPass, setPlayPass] = useState(1);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [videoPosition, setVideoPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showEqualizerModal, setShowEqualizerModal] = useState(false);

  // Search runs against two sources in parallel: Watches stored on our server
  // (all of them, not just the recent page cached in the library) and YouTube.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setYoutubeResults([]);
      setYoutubeSearchError('');
      setServerWatchResults([]);
      setWatchSearchError('');
      setYoutubeSearching(false);
      setWatchSearching(false);
      return undefined;
    }
    let cancelled = false;
    setYoutubeSearching(true);
    setWatchSearching(true);
    const timer = setTimeout(() => {
      setYoutubeSearchError('');
      setWatchSearchError('');
      api
        .get('watch/search', { params: { q: query, limit: 12 } })
        .then((response) => {
          if (cancelled) return;
          const list = Array.isArray(response.data) ? response.data : [];
          const authors: Record<string, string> = {};
          list.forEach((w: any) => {
            const author = w?.author;
            const name =
              author?.displayName ||
              author?.fullName ||
              [author?.user?.firstName, author?.user?.surname].filter(Boolean).join(' ');
            if (w?._id && name) authors[String(w._id)] = name;
          });
          setWatchAuthors((prev) => ({ ...prev, ...authors }));
          setServerWatchResults(watchesToPlaylistItems(list));
        })
        .catch(() => {
          if (!cancelled) {
            setServerWatchResults([]);
            setWatchSearchError('Could not search Watches on the server.');
          }
        })
        .finally(() => {
          if (!cancelled) setWatchSearching(false);
        });
      api
        .get('/yt-download/youtube/search', {
          params: { q: query, maxResults: 8, _ts: Date.now() },
        })
        .then((response) => {
          if (!cancelled) setYoutubeResults(response.data?.items || []);
        })
        .catch(() => {
          if (!cancelled) {
            setYoutubeResults([]);
            setYoutubeSearchError('YouTube search failed. Check your connection or API configuration.');
          }
        })
        .finally(() => {
          if (!cancelled) setYoutubeSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Apply a search requested via navigation params once per distinct value, so
  // clearing the field afterwards does not bring the old query back.
  useEffect(() => {
    const requestedQuery = String(params.searchQuery || '').trim();
    if (requestedQuery) {
      setSearchQuery(requestedQuery);
      setSearchOpen(true);
    }
  }, [params.searchQuery]);

  const videoRef = useRef<any | null>(null);
  const playUrlHandledRef = useRef('');
  const skipPipOnUnmount = useRef(false);
  const currentVideoRef = useRef<PlaylistItem | null>(null);
  const playlistPipRef = useRef<any[]>([]);
  const loopingRef = useRef(false);
  const pipReturnRef = useRef<{ resumeAt: number; autoplay: boolean } | null>(null);
  const currentPlaybackRef = useRef<QueueItem | null>(null);
  const savedPlaybackRef = useRef<PlaybackState | null>(null);
  const playbackRestoreHandledRef = useRef(false);
  const skipTrackAutoplayRef = useRef(false);
  const pendingResumePositionRef = useRef<number | null>(null);
  const resumeHandledRef = useRef(false);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const currentVideoIndexRef = useRef(0);
  const queueIndexRef = useRef(0);
  const playPassRef = useRef(1);
  const endedKeyRef = useRef('');
  const handleVideoEndRef = useRef<() => void>(() => {});
  const bgSoundRef = useRef<Audio.Sound | null>(null);
  const bgActiveRef = useRef(false);
  const handingOffRef = useRef(false);
  const wantPlayingRef = useRef(false);
  const libraryRefreshRef = useRef<Promise<void> | null>(null);
  const htmlVideoRef = useRef<HTMLMediaElement | null>(null);

  const equalizer = useAudioEqualizer(htmlVideoRef.current);

  useEffect(() => {
    configurePipAudioMode().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [custom, order, queue, cachedWatch, cachedSaved, playbackState, remotePlaylists] = await Promise.all([
        loadCustomPlaylist(),
        loadPlaylistOrder(),
        loadPlayQueue(),
        getCachedWatchPlaylist(),
        getCachedSavedPlaylist(),
        loadPlaybackState(),
        myProfileId
          ? loadSavedPlaylists().catch((error) => {
              console.error('Failed to load saved playlists:', error);
              return [];
            })
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setCustomVideos(custom);
      setPlaylistOrder(order);
      setPlayQueue(queue);
      if (cachedWatch?.length) setWatchVideos(cachedWatch);
      if (cachedSaved?.length) setSavedVideos(cachedSaved);
      savedPlaybackRef.current = playbackState;
      setSavedPlaylists(remotePlaylists);
      setHydrated(true);
      setLibraryLoading(!(cachedWatch?.length || cachedSaved?.length || custom.length));
    })();
    return () => {
      cancelled = true;
    };
  }, [myProfileId]);

  const allVideos = useMemo(
    () => mergePlaylist(watchVideos, savedVideos, customVideos),
    [watchVideos, savedVideos, customVideos],
  );

  const filteredVideos = useMemo(() => {
    let list = filterPlaylist(allVideos, filter);
    const q = libraryQuery.trim().toLowerCase();
    if (q) list = list.filter((v) => v.title.toLowerCase().includes(q));
    return sortPlaylist(list, sortMode, playlistOrder);
  }, [allVideos, filter, libraryQuery, sortMode, playlistOrder]);

  // Watch results = library Watches/saved copies matching the query (instant)
  // followed by server matches, de-duplicated by Watch id.
  const watchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: PlaylistItem[] = [];
    const push = (video: PlaylistItem) => {
      const key = video.sourceId || video.id;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(video);
    };
    allVideos
      .filter((v) => (v.type === 'watch' || v.type === 'saved') && v.title.toLowerCase().includes(q))
      .forEach(push);
    serverWatchResults.forEach(push);
    return out.slice(0, 15);
  }, [searchQuery, allVideos, serverWatchResults]);

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
  // YouTube source of the current video (a Watch saved from YouTube, or a
  // YouTube link), so it can be downloaded like on the YouTube screen.
  const currentYoutubeId =
    currentVideo?.youtubeId || extractYouTubeVideoId(currentVideo?.url || '');

  const currentTrackKey = currentPlayback
    ? `${currentPlayback.queueId}:${currentPlayback.url}`
    : '';
  currentVideoRef.current = currentVideo;
  loopingRef.current = isLooping;
  currentPlaybackRef.current = currentPlayback;
  isPlayingRef.current = isPlaying;
  currentVideoIndexRef.current = currentVideoIndex;
  queueIndexRef.current = queueIndex;
  playPassRef.current = playPass;

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
    if (!hydrated || playbackRestoreHandledRef.current || !playbackList.length) return;
    if (params.videoId || params.playUrl || paramsSource?.uri) {
      playbackRestoreHandledRef.current = true;
      return;
    }
    const saved = savedPlaybackRef.current;
    if (!saved) {
      playbackRestoreHandledRef.current = true;
      return;
    }
    const savedIndex = playbackList.findIndex(
      (item) =>
        (saved.queueId && item.queueId === saved.queueId) ||
        (item.videoId === saved.videoId && item.url === saved.url),
    );
    if (savedIndex < 0) {
      playbackRestoreHandledRef.current = true;
      return;
    }
    if (usingQueue) setQueueIndex(savedIndex);
    else setCurrentVideoIndex(savedIndex);
    setPlayPass(saved.playPass);
    setIsLooping(saved.isLooping);
    skipTrackAutoplayRef.current = true;
    pendingResumePositionRef.current = saved.positionSeconds;
    setIsPlaying(saved.isPlaying);
    playbackRestoreHandledRef.current = true;
  }, [
    hydrated,
    playbackList,
    usingQueue,
    params.videoId,
    params.playUrl,
    paramsSource?.uri,
  ]);

  useEffect(() => {
    setMediaReady(false);
    currentTimeRef.current = 0;
    setVideoPosition(0);
    setVideoDuration(0);
    if (skipTrackAutoplayRef.current) {
      skipTrackAutoplayRef.current = false;
    } else {
      setIsPlaying(!isThisPip);
    }
    endedKeyRef.current = '';
  }, [currentTrackKey, isThisPip]);

  const persistPlaybackState = useCallback(async () => {
    const playback = currentPlaybackRef.current;
    const video = currentVideoRef.current;
    if (!playback || !video) return;
    await savePlaybackState({
      queueId: playback.queueId,
      videoId: playback.videoId,
      url: playback.url,
      queueIndex: queueIndexRef.current,
      currentVideoIndex: currentVideoIndexRef.current,
      playPass: playPassRef.current,
      positionSeconds: currentTimeRef.current,
      isPlaying: isPlayingRef.current,
      isLooping: loopingRef.current,
    });
  }, []);

  useEffect(() => {
    if (!mediaReady || pendingResumePositionRef.current === null) return;
    const position = pendingResumePositionRef.current;
    pendingResumePositionRef.current = null;
    if (position > 0) {
      videoRef.current?.setPositionAsync(position * 1000).catch(() => {});
      currentTimeRef.current = position;
      setVideoPosition(position);
    }
  }, [mediaReady, currentTrackKey]);

  useEffect(() => {
    if (!isFullscreen || !mediaReady) return;
    const position = currentTimeRef.current;
    if (position > 0) {
      videoRef.current?.setPositionAsync(position * 1000).catch(() => {});
    }
  }, [isFullscreen, mediaReady]);

  useEffect(() => {
    if (hydrated && currentPlayback) persistPlaybackState();
  }, [hydrated, currentTrackKey, isPlaying, isLooping, playPass, persistPlaybackState]);

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
    // A YouTube page link is not a playable file; the AI agent already
    // started its background download, whose progress banner shows here.
    if (isYouTubeVideoUrl(playUrl)) return;
    ingestPlayable(
      playUrl,
      params.playTitle || paramsSource?.title,
      params.playPoster || paramsSource?.poster,
    );
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
        persistPlaybackState();
        startLibraryPip();
      };
    }, [refreshLibrary, startLibraryPip, isThisPip, persistPlaybackState]),
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
    endedKeyRef.current = '';
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

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen) {
        await ScreenOrientation.unlockAsync();
        setIsFullscreen(false);
        return;
      }

      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    } catch (error) {
      console.error('Unable to toggle video fullscreen:', error);
      await ScreenOrientation.unlockAsync().catch(() => {});
      setIsFullscreen(false);
      Alert.alert('Fullscreen unavailable', 'This device could not rotate the video to fullscreen.');
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      toggleFullscreen();
      return true;
    });
    return () => subscription.remove();
  }, [isFullscreen, toggleFullscreen]);

  useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
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
        setPlaybackIndex(0, false);
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
      if (supportsNativeVideoBackgroundPlayback) return;
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

  const playVideoNow = useCallback((video: PlaylistItem) => {
    const existingIndex = playQueue.findIndex((item) => item.videoId === video.id);
    let target: QueueItem | null = existingIndex >= 0 ? playQueue[existingIndex] : null;
    if (!target) {
      target = videoToQueueItem(video);
      if (!target) return;
      const appended = target;
      setPlayQueue((prev) => [...prev, appended]);
      setQueueIndex(playQueue.length);
    } else {
      setQueueIndex(existingIndex);
    }
    setPlayPass(1);
    setIsPlaying(true);
    if (isThisPip && watchPip?.updatePip) {
      watchPip.updatePip({
        libraryVideoId: target.queueId,
        videoId: target.videoId,
        videoUrl: target.url,
        title: target.title,
        thumbnail: target.thumbnail || '',
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    }
  }, [playQueue, isThisPip, watchPip]);

  const handlePlayWatchResult = useCallback((video: PlaylistItem) => {
    playVideoNow(video);
    setSearchQuery('');
    setActiveTab('queue');
  }, [playVideoNow]);

  const handleQueueWatchResult = useCallback((video: PlaylistItem) => {
    addToPlayQueue(video);
  }, [addToPlayQueue]);

  const handleSelectYoutubeResult = useCallback(async (result: any) => {
    if (!result?.url) return;
    const youtubeId = result.videoId;
    const existingWatch =
      (result.localWatch?.videoUrl &&
        normalizePlaylistItem({
          id: `watch-${result.localWatch._id}`,
          sourceId: result.localWatch._id,
          url: result.localWatch.videoUrl,
          title: result.localWatch.caption || result.title,
          thumbnail: result.localWatch.thumbnail || result.thumbnail,
          type: 'watch',
          online: true,
          youtubeId: result.localWatch.youtubeId || youtubeId,
        })) ||
      watchVideos.find((video) => video.youtubeId === youtubeId);
    if (existingWatch) {
      playVideoNow(existingWatch);
      setSearchQuery('');
      setActiveTab('queue');
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
    setActiveTab('queue');
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
  }, [addToPlayQueue, playVideoNow, allVideos, refreshLibrary, watchVideos]);

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

  const saveCurrentPlaylist = useCallback(async () => {
    const name = playlistName.trim();
    if (!name || playQueue.length === 0 || savingPlaylist) return;
    setSavingPlaylist(true);
    try {
      const saved = await saveNamedPlaylist(name, playQueue);
      if (saved) {
        setSavedPlaylists((prev) => [saved, ...prev.filter((item) => item._id !== saved._id)]);
        setPlaylistName('');
        Alert.alert('Playlist saved', `"${saved.name}" is available on your other devices.`);
      }
    } catch (error: any) {
      Alert.alert('Could not save playlist', error?.response?.data?.error || 'Please try again.');
    } finally {
      setSavingPlaylist(false);
    }
  }, [playlistName, playQueue, savingPlaylist]);

  const loadNamedPlaylist = useCallback((playlist: SavedPlaylist) => {
    if (!playlist.items?.length) return;
    setPlayQueue(playlist.items);
    setQueueIndex(0);
    setPlayPass(1);
  }, []);

  const removeNamedPlaylist = useCallback((playlist: SavedPlaylist) => {
    Alert.alert('Delete playlist?', `Remove "${playlist.name}" from your saved playlists?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNamedPlaylist(playlist._id);
            setSavedPlaylists((prev) => prev.filter((item) => item._id !== playlist._id));
          } catch (error: any) {
            Alert.alert('Could not delete playlist', error?.response?.data?.error || 'Please try again.');
          }
        },
      },
    ]);
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

  const showSearchPanel = searchOpen && !!searchQuery.trim();

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
    if (pendingResumePositionRef.current === null) persistPlaybackState();
    const reachedEnd =
      status.didJustFinish ||
      (status.isPlaying === false && nextDuration > 0 && nextPos >= nextDuration - 0.25);
    if (reachedEnd && endedKeyRef.current !== currentTrackKey) {
      endedKeyRef.current = currentTrackKey;
      handleVideoEndRef.current();
    }
  }, [currentTrackKey, persistPlaybackState]);

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
          <Pressable
            style={[styles.headerBtn, { backgroundColor: t.overlay }]}
            onPress={() => navigation.goBack()}
            hitSlop={6}
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-back" size={22} color={t.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: t.text }]}>Media</Text>
            <Text style={[styles.headerSubtitle, { color: t.muted }]} numberOfLines={1}>
              {stats.total} in library · {playQueue.length} up next
            </Text>
          </View>
          {currentYoutubeId ? (
            <Pressable
              style={[styles.headerBtn, { backgroundColor: t.overlay }]}
              onPress={() =>
                setDownloadTarget({
                  videoId: currentYoutubeId,
                  title: currentVideo?.title || 'YouTube video',
                  thumbnail: currentVideo?.thumbnail || undefined,
                })
              }
              accessibilityLabel="Download this YouTube video"
            >
              <Icon name="file-download" size={22} color={t.text} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.headerBtn, { backgroundColor: t.overlay }]}
              onPress={() => refreshLibrary({ showSpinner: true })}
              disabled={libraryLoading}
              accessibilityLabel="Refresh library"
            >
              {libraryLoading ? (
                <ActivityIndicator size="small" color={t.primary} />
              ) : (
                <Icon name="refresh" size={22} color={t.text} />
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: t.inputBg,
                borderColor: showSearchPanel ? t.primary : 'transparent',
              },
            ]}
          >
            <Icon name="search" size={20} color={showSearchPanel ? t.primary : t.muted} />
            <VoiceTextInput
              wrapperStyle={styles.searchInputWrap}
              style={[styles.searchInput, { color: t.text }]}
              placeholder="Search Watches & YouTube"
              placeholderTextColor={t.placeholder}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              returnKeyType="search"
              autoCorrect={false}
              rightAccessory={
                searchQuery ? (
                  <Pressable
                    hitSlop={8}
                    style={[styles.searchClear, { backgroundColor: t.chipBg }]}
                    onPress={() => setSearchQuery('')}
                    accessibilityLabel="Clear search"
                  >
                    <Icon name="close" size={14} color={t.muted} />
                  </Pressable>
                ) : undefined
              }
            />
          </View>
        </View>

        <View style={styles.body}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {libraryError ? (
              <View style={[styles.errorBanner, { backgroundColor: t.error + '1A' }]}>
                <Icon name="error-outline" size={16} color={t.error} />
                <Text style={[styles.errorText, { color: t.error }]}>{libraryError}</Text>
              </View>
            ) : null}

            {currentVideo ? (
              <View style={[styles.stage, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.stageFrame, isFullscreen && styles.hiddenStageFrame]}>
                  {isThisPip ? (
                    <View style={[styles.pipPlaceholder, { backgroundColor: t.pageBgAlt }]}>
                      <Icon name="picture-in-picture-alt" size={32} color={t.muted} />
                      <Text style={[styles.pipPlaceholderText, { color: t.text }]}>Playing in pop-out mode</Text>
                      <Pressable style={[styles.pillBtn, { backgroundColor: t.primary }]} onPress={restoreFromPip}>
                        <Text style={[styles.pillBtnText, { color: t.ctaText }]}>Return here</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {!isFullscreen ? <ExpoVideo
                        key={currentTrackKey}
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
                      /> : null}
                      {!isFullscreen && !mediaReady ? (
                        <View style={styles.cover} pointerEvents="none">
                          {currentVideo.thumbnail ? (
                            <Image source={{ uri: currentVideo.thumbnail }} style={styles.coverImg} />
                          ) : null}
                          <View style={styles.coverSpinner}>
                            <ActivityIndicator color="#fff" />
                          </View>
                        </View>
                      ) : null}
                      <View style={styles.stageBadges} pointerEvents="box-none">
                        <View style={styles.stageBadge}>
                          <Text style={styles.stageBadgeText}>{getTypeLabel(currentVideo.type)}</Text>
                        </View>
                        {watchPip && !isThisPip ? (
                          <Pressable style={styles.stageBadge} onPress={minimizeToPip} hitSlop={6}>
                            <Icon name="picture-in-picture-alt" size={13} color="#fff" />
                            <Text style={styles.stageBadgeText}>Pop out</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.stageBody}>
                  <Text style={[styles.stageTitle, { color: t.text }]} numberOfLines={2}>
                    {currentVideo.title}
                  </Text>
                  <Text style={[styles.stageMeta, { color: t.muted }]} numberOfLines={1}>
                    {getSourceLabel(currentVideo)}
                    {' · '}
                    {usingQueue ? 'Up next' : 'Library'} {playbackIndex + 1}/{playbackList.length}
                    {currentPlayback?.playCount > 1
                      ? ` · Repeat ${playPass}/${clampPlayCount(currentPlayback.playCount)}`
                      : ''}
                  </Text>

                  {!isThisPip ? (
                    <View style={styles.progressBlock}>
                      <Slider
                        style={styles.scrubSlider}
                        minimumValue={0}
                        maximumValue={Math.max(videoDuration, 1)}
                        value={Math.min(videoPosition, Math.max(videoDuration, 1))}
                        minimumTrackTintColor={t.primary}
                        maximumTrackTintColor={t.chipBorder}
                        thumbTintColor={t.primary}
                        disabled={videoDuration <= 0}
                        onValueChange={setVideoPosition}
                        onSlidingComplete={handleSeekTo}
                      />
                      <View style={styles.timeRow}>
                        <Text style={[styles.timeText, { color: t.muted }]}>{formatTime(videoPosition)}</Text>
                        <Text style={[styles.timeText, { color: t.muted }]}>{formatTime(videoDuration)}</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.transport}>
                    <Pressable
                      style={styles.transportSide}
                      onPress={() => {
                        setIsLooping((prev) => {
                          const next = !prev;
                          if (isThisPip) watchPip?.updatePip?.({ looping: next });
                          return next;
                        });
                      }}
                      accessibilityLabel="Repeat"
                    >
                      <Icon name="repeat" size={22} color={isLooping ? t.primary : t.muted} />
                      {isLooping ? <View style={[styles.activeDot, { backgroundColor: t.primary }]} /> : null}
                    </Pressable>
                    <Pressable
                      style={[styles.transportBtn, playbackList.length <= 1 && styles.disabled]}
                      onPress={handlePrev}
                      disabled={playbackList.length <= 1}
                      accessibilityLabel="Previous"
                    >
                      <Icon name="skip-previous" size={32} color={t.text} />
                    </Pressable>
                    <Pressable
                      style={[styles.playBtn, { backgroundColor: t.primary }]}
                      onPress={togglePlayPause}
                      accessibilityLabel={playerIsPlaying ? 'Pause' : 'Play'}
                    >
                      <Icon name={playerIsPlaying ? 'pause' : 'play-arrow'} size={34} color={t.ctaText} />
                    </Pressable>
                    <Pressable
                      style={[styles.transportBtn, playbackList.length <= 1 && styles.disabled]}
                      onPress={handleNext}
                      disabled={playbackList.length <= 1}
                      accessibilityLabel="Next"
                    >
                      <Icon name="skip-next" size={32} color={t.text} />
                    </Pressable>
                    <Pressable
                      style={styles.transportSide}
                      onPress={toggleFullscreen}
                      accessibilityLabel="Fullscreen"
                    >
                      <Icon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={24} color={t.muted} />
                    </Pressable>
                  </View>

                  <View style={[styles.actionRow, { borderTopColor: t.border }]}>
                    {watchPip && !isThisPip ? (
                      <Pressable style={styles.actionItem} onPress={minimizeToPip}>
                        <Icon name="picture-in-picture-alt" size={20} color={t.text} />
                        <Text style={[styles.actionLabel, { color: t.muted }]}>Pop out</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.actionItem} onPress={() => setShowEqualizerModal(true)}>
                      <Icon name="equalizer" size={20} color={t.text} />
                      <Text style={[styles.actionLabel, { color: t.muted }]}>Equalizer</Text>
                    </Pressable>
                    {currentYoutubeId ? (
                      <Pressable
                        style={styles.actionItem}
                        onPress={() =>
                          setDownloadTarget({
                            videoId: currentYoutubeId,
                            title: currentVideo?.title || 'YouTube video',
                            thumbnail: currentVideo?.thumbnail || undefined,
                          })
                        }
                      >
                        <Icon name="file-download" size={20} color={t.text} />
                        <Text style={[styles.actionLabel, { color: t.muted }]}>Download</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={styles.actionItem}
                      onPress={() => refreshLibrary({ showSpinner: true })}
                      disabled={libraryLoading}
                    >
                      {libraryLoading ? (
                        <ActivityIndicator size="small" color={t.text} />
                      ) : (
                        <Icon name="refresh" size={20} color={t.text} />
                      )}
                      <Text style={[styles.actionLabel, { color: t.muted }]}>Refresh</Text>
                    </Pressable>
                  </View>
                </View>

                {isFullscreen ? (
                  <Modal
                    visible
                    animationType="fade"
                    supportedOrientations={['landscape']}
                    onRequestClose={toggleFullscreen}
                  >
                  <View style={styles.fullscreenOverlay}>
                    <ExpoVideo
                      key={currentTrackKey}
                      ref={(node) => {
                        videoRef.current = node;
                      }}
                      source={videoSource}
                      style={styles.fullscreenVideo}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={isPlaying && !bgActiveRef.current}
                      isLooping={false}
                      useNativeControls={false}
                      progressUpdateIntervalMillis={500}
                      onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                    />
                    <View style={styles.fullscreenTopBar}>
                      <Pressable style={styles.fullscreenIconBtn} onPress={toggleFullscreen} hitSlop={8}>
                        <Icon name="arrow-back" size={24} color="#fff" />
                      </Pressable>
                      <Text style={styles.fullscreenTitle} numberOfLines={1}>
                        {currentVideo.title}
                      </Text>
                      <Pressable style={styles.fullscreenIconBtn} onPress={toggleFullscreen} hitSlop={8}>
                        <Icon name="fullscreen-exit" size={23} color="#fff" />
                      </Pressable>
                    </View>
                    <View style={styles.fullscreenBottomBar}>
                      <View style={styles.timeRow}>
                        <Text style={styles.fullscreenTimeText}>{formatTime(videoPosition)}</Text>
                        <Text style={styles.fullscreenTimeText}>{formatTime(videoDuration)}</Text>
                      </View>
                      <Slider
                        style={styles.fullscreenScrubSlider}
                        minimumValue={0}
                        maximumValue={Math.max(videoDuration, 1)}
                        value={Math.min(videoPosition, Math.max(videoDuration, 1))}
                        minimumTrackTintColor={t.primary}
                        maximumTrackTintColor="rgba(255,255,255,0.35)"
                        thumbTintColor={t.primary}
                        disabled={videoDuration <= 0}
                        onValueChange={setVideoPosition}
                        onSlidingComplete={handleSeekTo}
                      />
                      <View style={styles.fullscreenActions}>
                        <Pressable style={styles.fullscreenActionBtn} onPress={handlePrev} disabled={playbackList.length <= 1}>
                          <Icon name="skip-previous" size={28} color={playbackList.length <= 1 ? '#777' : '#fff'} />
                        </Pressable>
                        <Pressable style={[styles.fullscreenPlayBtn, { backgroundColor: t.primary }]} onPress={togglePlayPause}>
                          <Icon name={playerIsPlaying ? 'pause' : 'play-arrow'} size={30} color={t.ctaText} />
                        </Pressable>
                        <Pressable style={styles.fullscreenActionBtn} onPress={handleNext} disabled={playbackList.length <= 1}>
                          <Icon name="skip-next" size={28} color={playbackList.length <= 1 ? '#777' : '#fff'} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  </Modal>
                ) : null}
              </View>
            ) : (
              <View style={[styles.emptyStage, { borderColor: t.border, backgroundColor: t.surface }]}>
                <View style={[styles.emptyIconWrap, { backgroundColor: t.primarySoft }]}>
                  <Icon name="video-library" size={30} color={t.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing playing yet</Text>
                <Text style={[styles.emptyHint, { color: t.muted }]}>
                  Search Watches or YouTube above, pick something from your library, or add a video link.
                </Text>
                <View style={styles.emptyActions}>
                  <Pressable
                    style={[styles.pillBtn, { backgroundColor: t.primary }]}
                    onPress={() => setActiveTab('library')}
                  >
                    <Text style={[styles.pillBtnText, { color: t.ctaText }]}>Browse library</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.pillBtn, { backgroundColor: t.chipBg }]}
                    onPress={() => refreshLibrary({ showSpinner: true })}
                    disabled={libraryLoading}
                  >
                    <Text style={[styles.pillBtnText, { color: t.text }]}>
                      {libraryLoading ? 'Refreshing…' : 'Refresh'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={[styles.tabs, { backgroundColor: t.overlay }]}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                const count =
                  tab.id === 'queue'
                    ? playQueue.length
                    : tab.id === 'library'
                      ? stats.total
                      : tab.id === 'saved'
                        ? savedPlaylists.length
                        : null;
                return (
                  <Pressable
                    key={tab.id}
                    style={[styles.tab, active && [styles.tabActive, { backgroundColor: t.surface }, t.chromeElevation]]}
                    onPress={() => setActiveTab(tab.id)}
                  >
                    <Icon name={tab.icon} size={16} color={active ? t.primary : t.muted} />
                    <Text
                      style={[styles.tabText, { color: active ? t.text : t.muted }, active && styles.tabTextActive]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                    {count ? (
                      <Text style={[styles.tabCount, { color: active ? t.primary : t.tertiary }]}>{count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'queue' ? (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: t.text }]}>Up next</Text>
                    <Text style={[styles.cardSubtitle, { color: t.muted }]}>
                      Set how many times each video plays before moving on.
                    </Text>
                  </View>
                  {playQueue.length > 0 ? (
                    <Pressable style={[styles.ghostBtn, { borderColor: t.border }]} onPress={clearPlayQueue}>
                      <Icon name="clear-all" size={16} color={t.muted} />
                      <Text style={[styles.ghostBtnText, { color: t.muted }]}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
                {playQueue.length > 0 ? (
                  playQueue.map((item, index) => {
                    const isCurrent = usingQueue && index === queueIndex;
                    return (
                      <Pressable
                        key={item.queueId}
                        style={[
                          styles.listItem,
                          isCurrent && { backgroundColor: t.primarySoft },
                        ]}
                        onPress={() => handlePlayQueueItem(index)}
                      >
                        {playQueue.length > 1
                          ? renderReorder(index, playQueue.length, applyQueueReorder)
                          : null}
                        <View style={[styles.thumb, { backgroundColor: t.chipBg }]}>
                          {item.thumbnail ? (
                            <Image source={{ uri: item.thumbnail }} style={styles.coverImg} />
                          ) : (
                            <Icon name="movie" size={20} color={t.muted} />
                          )}
                          {isCurrent ? (
                            <View style={styles.thumbOverlay}>
                              <Icon name={playerIsPlaying ? 'graphic-eq' : 'pause'} size={20} color="#fff" />
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.itemInfo}>
                          <Text
                            style={[styles.itemTitle, { color: isCurrent ? t.primary : t.text }]}
                            numberOfLines={2}
                          >
                            {item.title}
                          </Text>
                          <Text style={[styles.itemMeta, { color: t.muted }]}>
                            {isCurrent
                              ? `Now playing · ${playPass} of ${clampPlayCount(item.playCount)}`
                              : `${getTypeLabel(item.type)} · plays ${clampPlayCount(item.playCount)}×`}
                          </Text>
                          {youtubeDownload?.queueId === item.queueId ? (
                            <View style={styles.downloadProgress}>
                              <View style={styles.downloadProgressHeader}>
                                <Text style={[styles.itemMeta, { color: t.primary, fontWeight: '700' }]}>
                                  {youtubeDownload.percent}%
                                </Text>
                                <Text
                                  style={[styles.itemMeta, { flex: 1, color: youtubeDownload.error ? t.error : t.muted }]}
                                  numberOfLines={1}
                                >
                                  {youtubeDownload.error || youtubeDownload.stage}
                                </Text>
                              </View>
                              <View style={[styles.downloadTrack, { backgroundColor: t.chipBg }]}>
                                <View
                                  style={[
                                    styles.downloadFill,
                                    {
                                      width: `${Math.min(100, Math.max(0, youtubeDownload.percent))}%`,
                                      backgroundColor: youtubeDownload.error ? t.error : t.primary,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          ) : null}
                        </View>
                        <View style={[styles.stepper, { borderColor: t.border }]}>
                          <Pressable
                            style={styles.stepperBtn}
                            disabled={item.playCount <= MIN_PLAY_COUNT}
                            onPress={() => updateQueuePlayCount(item.queueId, item.playCount - 1)}
                            hitSlop={4}
                            accessibilityLabel="Play fewer times"
                          >
                            <Icon name="remove" size={14} color={item.playCount <= MIN_PLAY_COUNT ? t.disabled : t.text} />
                          </Pressable>
                          <Text style={[styles.stepperValue, { color: t.text }]}>{item.playCount}×</Text>
                          <Pressable
                            style={styles.stepperBtn}
                            disabled={item.playCount >= MAX_PLAY_COUNT}
                            onPress={() => updateQueuePlayCount(item.queueId, item.playCount + 1)}
                            hitSlop={4}
                            accessibilityLabel="Play more times"
                          >
                            <Icon name="add" size={14} color={item.playCount >= MAX_PLAY_COUNT ? t.disabled : t.text} />
                          </Pressable>
                        </View>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => removeFromPlayQueue(item.queueId)}
                          hitSlop={6}
                          accessibilityLabel="Remove from up next"
                        >
                          <Icon name="close" size={18} color={t.muted} />
                        </Pressable>
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.emptyList}>
                    <Icon name="queue-music" size={32} color={t.tertiary} />
                    <Text style={[styles.emptyListTitle, { color: t.text }]}>Your queue is empty</Text>
                    <Text style={[styles.hint, { color: t.tertiary }]}>
                      Search above or add videos from your library.
                    </Text>
                    <Pressable
                      style={[styles.pillBtn, { backgroundColor: t.primarySoft, marginTop: 10 }]}
                      onPress={() => setActiveTab('library')}
                    >
                      <Text style={[styles.pillBtnText, { color: t.primary }]}>Open library</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}

            {activeTab === 'saved' ? (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: t.text }]}>Saved playlists</Text>
                    <Text style={[styles.cardSubtitle, { color: t.muted }]}>
                      Synced across all your devices.
                    </Text>
                  </View>
                </View>
                {myProfileId ? (
                  <>
                    <View style={styles.playlistSaveForm}>
                      <TextInput
                        style={[styles.playlistNameInput, { color: t.text, backgroundColor: t.inputBg }]}
                        placeholder={playQueue.length ? 'Name this queue…' : 'Add videos to Up next first'}
                        placeholderTextColor={t.placeholder}
                        value={playlistName}
                        maxLength={120}
                        editable={playQueue.length > 0}
                        onChangeText={setPlaylistName}
                        onSubmitEditing={saveCurrentPlaylist}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={[
                          styles.saveBtn,
                          { backgroundColor: t.primary },
                          (!playlistName.trim() || playQueue.length === 0) && styles.disabled,
                        ]}
                        disabled={!playlistName.trim() || playQueue.length === 0 || savingPlaylist}
                        onPress={saveCurrentPlaylist}
                      >
                        {savingPlaylist ? (
                          <ActivityIndicator size="small" color={t.ctaText} />
                        ) : (
                          <Text style={[styles.pillBtnText, { color: t.ctaText }]}>Save</Text>
                        )}
                      </Pressable>
                    </View>
                    {savedPlaylists.length > 0 ? savedPlaylists.map((playlist) => (
                      <Pressable
                        key={playlist._id}
                        style={[styles.savedPlaylistRow, { backgroundColor: t.listBg }]}
                        onPress={() => {
                          loadNamedPlaylist(playlist);
                          setActiveTab('queue');
                        }}
                      >
                        <View style={[styles.playlistIcon, { backgroundColor: t.primarySoft }]}>
                          <Icon name="playlist-play" size={22} color={t.primary} />
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemTitle, { color: t.text }]} numberOfLines={1}>{playlist.name}</Text>
                          <Text style={[styles.itemMeta, { color: t.muted }]}>
                            {playlist.items?.length || 0} videos · tap to load
                          </Text>
                        </View>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => removeNamedPlaylist(playlist)}
                          hitSlop={6}
                          accessibilityLabel={`Delete ${playlist.name}`}
                        >
                          <Icon name="delete-outline" size={20} color={t.muted} />
                        </Pressable>
                      </Pressable>
                    )) : (
                      <View style={styles.emptyList}>
                        <Icon name="library-music" size={32} color={t.tertiary} />
                        <Text style={[styles.hint, { color: t.tertiary }]}>
                          No saved playlists yet. Name your current queue to save it.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={[styles.hint, { color: t.tertiary }]}>Sign in to save playlists across devices.</Text>
                )}
              </View>
            ) : null}

            {activeTab === 'library' ? (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: t.text }]}>Library</Text>
                    <Text style={[styles.cardSubtitle, { color: t.muted }]}>
                      {stats.watches} watches · {stats.saved} saved · {stats.custom} custom
                    </Text>
                  </View>
                  {filteredVideos.length > 0 ? (
                    <Pressable
                      style={[styles.ghostBtn, { borderColor: t.border }]}
                      onPress={() => filteredVideos.forEach((video) => addToPlayQueue(video))}
                    >
                      <Icon name="playlist-add" size={16} color={t.primary} />
                      <Text style={[styles.ghostBtnText, { color: t.primary }]}>Add all</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={[styles.filterInputRow, { backgroundColor: t.inputBg }]}>
                  <Icon name="filter-list" size={18} color={t.muted} />
                  <TextInput
                    style={[styles.filterInput, { color: t.text }]}
                    placeholder="Filter your library"
                    placeholderTextColor={t.placeholder}
                    value={libraryQuery}
                    onChangeText={(text) => {
                      setLibraryQuery(text);
                      setCurrentVideoIndex(0);
                    }}
                    autoCorrect={false}
                  />
                  {libraryQuery ? (
                    <Pressable hitSlop={8} onPress={() => setLibraryQuery('')}>
                      <Icon name="close" size={16} color={t.muted} />
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
                  {FILTER_OPTIONS.map((opt) => {
                    const active = filter === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[
                          styles.chip,
                          { backgroundColor: active ? t.primary : 'transparent', borderColor: active ? t.primary : t.border },
                        ]}
                        onPress={() => {
                          setFilter(opt.id);
                          setCurrentVideoIndex(0);
                        }}
                      >
                        <Text style={[styles.chipText, { color: active ? t.ctaText : t.muted }, active && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.sortRow}>
                  <Text style={[styles.hint, { color: t.tertiary }]}>
                    {filteredVideos.length} video{filteredVideos.length === 1 ? '' : 's'}
                  </Text>
                  <Pressable
                    style={styles.sortBtn}
                    onPress={() => {
                      const idx = SORT_OPTIONS.findIndex((opt) => opt.id === sortMode);
                      setSortMode(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id);
                      setCurrentVideoIndex(0);
                    }}
                    accessibilityLabel="Change sort order"
                  >
                    <Icon name="sort" size={16} color={t.muted} />
                    <Text style={[styles.sortText, { color: t.muted }]}>
                      {SORT_OPTIONS.find((opt) => opt.id === sortMode)?.label}
                    </Text>
                  </Pressable>
                </View>

                {libraryLoading && filteredVideos.length === 0 ? (
                  <View style={styles.emptyList}>
                    <ActivityIndicator color={t.primary} />
                    <Text style={[styles.hint, { color: t.tertiary }]}>Loading your videos…</Text>
                  </View>
                ) : filteredVideos.length > 0 ? (
                  filteredVideos.map((video, index) => {
                    const isCurrent =
                      (!usingQueue && index === currentVideoIndex) ||
                      (usingQueue && currentPlayback?.videoId === video.id);
                    return (
                      <Pressable
                        key={video.id}
                        style={[styles.listItem, isCurrent && { backgroundColor: t.primarySoft }]}
                        onPress={() => handlePlayVideo(index)}
                      >
                        {sortMode === 'custom' && !libraryQuery.trim()
                          ? renderReorder(index, filteredVideos.length, applyPlaylistReorder)
                          : null}
                        <View style={[styles.thumbWide, { backgroundColor: t.chipBg }]}>
                          {video.thumbnail ? (
                            <Image source={{ uri: video.thumbnail }} style={styles.coverImg} />
                          ) : (
                            <Icon name="movie" size={20} color={t.muted} />
                          )}
                          {isCurrent ? (
                            <View style={styles.thumbOverlay}>
                              <Icon name={playerIsPlaying ? 'graphic-eq' : 'pause'} size={20} color="#fff" />
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.itemInfo}>
                          <Text
                            style={[styles.itemTitle, { color: isCurrent ? t.primary : t.text }]}
                            numberOfLines={2}
                          >
                            {video.title}
                          </Text>
                          <View style={styles.metaRow}>
                            <Icon
                              name={video.online ? 'cloud-queue' : 'phone-android'}
                              size={12}
                              color={t.tertiary}
                            />
                            <Text style={[styles.itemMeta, { color: t.muted, marginTop: 0 }]}>
                              {getSourceLabel(video)}
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          style={[styles.roundBtn, { backgroundColor: t.primarySoft }]}
                          onPress={() => addToPlayQueue(video)}
                          hitSlop={4}
                          accessibilityLabel="Add to up next"
                        >
                          <Icon name="playlist-add" size={18} color={t.primary} />
                        </Pressable>
                        {(video.type === 'url' || video.type === 'file') && (
                          <Pressable
                            style={styles.iconBtn}
                            onPress={() => handleRemoveVideo(video)}
                            hitSlop={6}
                            accessibilityLabel="Remove from library"
                          >
                            <Icon name="close" size={18} color={t.muted} />
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.emptyList}>
                    <Icon name="search-off" size={32} color={t.tertiary} />
                    <Text style={[styles.emptyListTitle, { color: t.text }]}>No videos match</Text>
                    <Text style={[styles.hint, { color: t.tertiary }]}>
                      Try another filter, or search Watches & YouTube at the top.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {activeTab === 'add' ? (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: t.text }]}>Add a video</Text>
                    <Text style={[styles.cardSubtitle, { color: t.muted }]}>
                      Paste a direct link or pick a file from this device.
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.uploadTile, { borderColor: t.border, backgroundColor: t.listBg }]}
                  onPress={handleFileUpload}
                >
                  <View style={[styles.emptyIconWrap, { backgroundColor: t.primarySoft, marginBottom: 0 }]}>
                    <Icon name="upload-file" size={24} color={t.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: t.text }]}>Choose from device</Text>
                    <Text style={[styles.itemMeta, { color: t.muted }]}>MP4, MOV, WEBM and more</Text>
                  </View>
                  <Icon name="chevron-right" size={22} color={t.muted} />
                </Pressable>
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
                  <Text style={[styles.hint, { color: t.tertiary }]}>or from a link</Text>
                  <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
                </View>
                <Text style={[styles.inputLabel, { color: t.muted }]}>Video URL</Text>
                <VoiceTextInput
                  style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                  placeholder="https://example.com/video.mp4"
                  placeholderTextColor={t.placeholder}
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={[styles.inputLabel, { color: t.muted }]}>Title (optional)</Text>
                <VoiceTextInput
                  style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                  placeholder="Give it a name"
                  placeholderTextColor={t.placeholder}
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                />
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: t.primary }, !videoUrl.trim() && styles.disabled]}
                  disabled={!videoUrl.trim()}
                  onPress={() => {
                    handleAddVideo();
                    setActiveTab('queue');
                  }}
                >
                  <Icon name="add-link" size={18} color={t.ctaText} />
                  <Text style={[styles.primaryBtnText, { color: t.ctaText }]}>Add to Up next</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          {showSearchPanel ? (
            <>
              <Pressable
                style={[styles.searchBackdrop, { backgroundColor: t.isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)' }]}
                onPress={() => setSearchOpen(false)}
                accessibilityLabel="Close search results"
              />
              <View
                style={[
                  styles.searchPanel,
                  { backgroundColor: t.surface, borderColor: t.border },
                  t.chromeElevation,
                ]}
              >
                <View style={styles.scopeRow}>
                  {SEARCH_SCOPES.map((scope) => {
                    const active = searchScope === scope.id;
                    const count =
                      scope.id === 'watch'
                        ? watchResults.length
                        : scope.id === 'youtube'
                          ? youtubeResults.length
                          : watchResults.length + youtubeResults.length;
                    const loading =
                      scope.id === 'watch'
                        ? watchSearching
                        : scope.id === 'youtube'
                          ? youtubeSearching
                          : watchSearching || youtubeSearching;
                    return (
                      <Pressable
                        key={scope.id}
                        style={[
                          styles.scopeChip,
                          { backgroundColor: active ? t.primary : t.chipBg },
                        ]}
                        onPress={() => setSearchScope(scope.id)}
                      >
                        <Text style={[styles.scopeText, { color: active ? t.ctaText : t.text }]}>
                          {scope.label}
                        </Text>
                        {loading ? (
                          <ActivityIndicator size="small" color={active ? t.ctaText : t.muted} style={styles.scopeSpinner} />
                        ) : (
                          <Text style={[styles.scopeCount, { color: active ? t.ctaText : t.muted }]}>{count}</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <ScrollView
                  style={styles.searchScroll}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {searchScope !== 'youtube' ? (
                    <View style={styles.resultSection}>
                      <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: t.primarySoft }]}>
                          <Icon name="ondemand-video" size={14} color={t.primary} />
                        </View>
                        <Text style={[styles.sectionTitle, { color: t.text }]}>Watches</Text>
                        <Text style={[styles.sectionCaption, { color: t.tertiary }]}>on Connect</Text>
                        {watchSearching ? <ActivityIndicator size="small" color={t.primary} /> : null}
                      </View>
                      {watchSearchError && watchResults.length === 0 ? (
                        <Text style={[styles.resultNote, { color: t.error }]}>{watchSearchError}</Text>
                      ) : null}
                      {watchResults.map((video) => {
                        const author = watchAuthors[video.sourceId];
                        return (
                          <Pressable
                            key={`w-${video.id}`}
                            style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: t.overlay }]}
                            onPress={() => handlePlayWatchResult(video)}
                          >
                            <View style={[styles.resultThumb, { backgroundColor: t.chipBg }]}>
                              {video.thumbnail ? (
                                <Image source={{ uri: video.thumbnail }} style={styles.coverImg} />
                              ) : (
                                <Icon name="movie" size={20} color={t.muted} />
                              )}
                              <View style={styles.resultPlayBadge}>
                                <Icon name="play-arrow" size={14} color="#fff" />
                              </View>
                            </View>
                            <View style={styles.itemInfo}>
                              <Text style={[styles.itemTitle, { color: t.text }]} numberOfLines={2}>
                                {video.title}
                              </Text>
                              <Text style={[styles.itemMeta, { color: t.muted }]} numberOfLines={1}>
                                {video.type === 'saved' ? 'Saved on this device' : author || 'Watch'}
                              </Text>
                            </View>
                            <Pressable
                              style={[styles.roundBtn, { backgroundColor: t.primarySoft }]}
                              onPress={() => handleQueueWatchResult(video)}
                              hitSlop={6}
                              accessibilityLabel={`Add ${video.title} to up next`}
                            >
                              <Icon name="playlist-add" size={18} color={t.primary} />
                            </Pressable>
                          </Pressable>
                        );
                      })}
                      {!watchSearching && !watchSearchError && watchResults.length === 0 ? (
                        <Text style={[styles.resultNote, { color: t.tertiary }]}>No Watches match “{searchQuery.trim()}”</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {searchScope !== 'watch' ? (
                    <View style={[styles.resultSection, searchScope === 'all' && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                      <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: 'rgba(255,0,0,0.12)' }]}>
                          <Icon name="smart-display" size={14} color="#FF0000" />
                        </View>
                        <Text style={[styles.sectionTitle, { color: t.text }]}>YouTube</Text>
                        <Text style={[styles.sectionCaption, { color: t.tertiary }]}>downloads to Watch</Text>
                        {youtubeSearching ? <ActivityIndicator size="small" color={t.primary} /> : null}
                      </View>
                      {youtubeSearchError ? (
                        <Text style={[styles.resultNote, { color: t.error }]}>{youtubeSearchError}</Text>
                      ) : null}
                      {youtubeResults.map((result) => (
                        <Pressable
                          key={`y-${result.videoId}`}
                          style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: t.overlay }]}
                          onPress={() => handleSelectYoutubeResult(result)}
                        >
                          <View style={[styles.resultThumb, { backgroundColor: t.chipBg }]}>
                            {result.thumbnail ? (
                              <Image source={{ uri: result.thumbnail }} style={styles.coverImg} />
                            ) : null}
                          </View>
                          <View style={styles.itemInfo}>
                            <Text style={[styles.itemTitle, { color: t.text }]} numberOfLines={2}>{result.title}</Text>
                            <View style={styles.metaRow}>
                              {result.localWatch ? (
                                <View style={[styles.inWatchBadge, { backgroundColor: t.success + '26' }]}>
                                  <Icon name="check" size={10} color={t.success} />
                                  <Text style={[styles.inWatchText, { color: t.success }]}>In Watch</Text>
                                </View>
                              ) : null}
                              <Text style={[styles.itemMeta, { color: t.muted, marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>
                                {result.channelTitle}
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            hitSlop={6}
                            style={[styles.roundBtn, { backgroundColor: t.chipBg }]}
                            onPress={() =>
                              setDownloadTarget({
                                videoId: result.videoId,
                                title: result.title || 'YouTube video',
                                thumbnail: result.thumbnail,
                              })
                            }
                            accessibilityLabel={`Download ${result.title || 'video'}`}
                          >
                            <Icon name="file-download" size={18} color={t.text} />
                          </Pressable>
                        </Pressable>
                      ))}
                      {!youtubeSearching && !youtubeSearchError && youtubeResults.length === 0 ? (
                        <Text style={[styles.resultNote, { color: t.tertiary }]}>No YouTube results</Text>
                      ) : null}
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </>
          ) : null}
        </View>
      </KeyboardSafeView>
      <YoutubeDownloadBanner jobs={backgroundDownloads} />
      <YoutubeDownloadSheet
        visible={!!downloadTarget}
        onClose={() => setDownloadTarget(null)}
        videoId={downloadTarget?.videoId || null}
        title={downloadTarget?.title}
        thumbnail={downloadTarget?.thumbnail}
      />
      <EqualizerModal
        visible={showEqualizerModal}
        onClose={() => setShowEqualizerModal(false)}
        state={equalizer.state}
        presets={equalizer.presets}
        onStateUpdate={equalizer.updateState}
        onLoadPreset={equalizer.loadPreset}
        onResetToDefaults={equalizer.resetToDefaults}
        isSupported={equalizer.isSupported}
        theme={{
          text: t.text,
          muted: t.muted,
          background: t.pageBgAlt,
          surface: t.surface,
          primary: t.primary,
          border: t.border,
          overlay: t.overlay,
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingLeft: 12,
    paddingRight: 4,
    minHeight: 48,
  },
  searchInputWrap: { flex: 1 },
  searchInput: { fontSize: 15, paddingVertical: 10 },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  body: { flex: 1 },
  searchBackdrop: { ...StyleSheet.absoluteFill },
  searchPanel: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  scopeRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 8 },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
  },
  scopeText: { fontSize: 13, fontWeight: '600' },
  scopeCount: { fontSize: 12, fontWeight: '600', opacity: 0.85 },
  scopeSpinner: { transform: [{ scale: 0.7 }], width: 14, height: 14 },
  searchScroll: { flexGrow: 0 },
  resultSection: { paddingHorizontal: 8, paddingVertical: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionCaption: { flex: 1, fontSize: 12 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 12,
  },
  resultThumb: {
    width: 104,
    height: 58,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPlayBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultNote: { fontSize: 13, paddingHorizontal: 6, paddingVertical: 10 },
  inWatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  inWatchText: { fontSize: 10, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 110, gap: 14 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 13 },
  downloadProgress: { gap: 4, marginTop: 6 },
  downloadProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadTrack: { height: 4, borderRadius: 99, overflow: 'hidden' },
  downloadFill: { height: '100%', borderRadius: 99 },
  stage: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  stageFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  hiddenStageFrame: { opacity: 0 },
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  stageBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  stageBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stageBody: { paddingHorizontal: 16, paddingTop: 14 },
  stageTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  stageMeta: { fontSize: 12, marginTop: 4 },
  progressBlock: { marginTop: 8, marginHorizontal: -8 },
  scrubSlider: { width: '100%', height: 30 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  timeText: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  transportSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  transportBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  actionItem: { alignItems: 'center', gap: 4, minWidth: 64, paddingVertical: 2 },
  actionLabel: { fontSize: 11, fontWeight: '500' },
  disabled: { opacity: 0.35 },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  fullscreenVideo: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  fullscreenTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.62)',
    zIndex: 2,
  },
  fullscreenTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fullscreenBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 2,
  },
  fullscreenTimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenScrubSlider: { width: '100%', height: 32 },
  fullscreenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 8,
  },
  fullscreenActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenPlayBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  coverSpinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  coverImg: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pipPlaceholderText: { fontSize: 14, fontWeight: '600' },
  pillBtn: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnText: { fontSize: 14, fontWeight: '700' },
  emptyStage: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyHint: { textAlign: 'center', marginTop: 6, marginBottom: 18, fontSize: 13, lineHeight: 19 },
  emptyActions: { flexDirection: 'row', gap: 10 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: {},
  tabText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  tabTextActive: { fontWeight: '700' },
  tabCount: { fontSize: 11, fontWeight: '700' },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ghostBtnText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' },
  playlistSaveForm: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playlistNameInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveBtn: {
    height: 44,
    minWidth: 72,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 10,
  },
  playlistIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWide: {
    width: 88,
    height: 50,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  itemMeta: { fontSize: 12, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  reorderCol: { gap: 2 },
  reorderBtn: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    height: 30,
  },
  stepperBtn: { width: 26, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { minWidth: 22, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: { paddingVertical: 24, alignItems: 'center', gap: 6 },
  emptyListTitle: { fontSize: 15, fontWeight: '600' },
  filterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  filterInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  filters: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipTextActive: { fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  sortText: { fontSize: 12, fontWeight: '600' },
  uploadTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  inputLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
});

export default MediaPlayer;
