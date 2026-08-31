import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Audio, Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useWatchPip } from '../../contexts/WatchPipContext';
import { clampPlayCount } from '../../utils/videoPlayerLibrary';
import { getPipPlaylistIndex } from '../../utils/watchPipHelpers';
import { navigate } from '../../lib/navigationService';
import { useWatchTokens } from '../../theme/watchTokens';
import {
  configurePipAudioMode,
  createPipBackgroundSound,
  unloadPipBackgroundSound,
  isAppBackgrounded,
} from '../../lib/pipBackgroundPlayback';

const EDGE_PAD = 8;
const CLOSE_LONG_PRESS_MS = 500;

type Dock = 'left' | 'right' | 'top' | 'bottom';

const clampPos = (
  x: number,
  y: number,
  width: number,
  height: number,
  winW: number,
  winH: number,
) => {
  const maxX = Math.max(EDGE_PAD, winW - width - EDGE_PAD);
  const maxY = Math.max(EDGE_PAD, winH - height - EDGE_PAD);
  return {
    x: Math.min(maxX, Math.max(EDGE_PAD, x)),
    y: Math.min(maxY, Math.max(EDGE_PAD, y)),
  };
};

const nearestDock = (
  x: number,
  y: number,
  width: number,
  height: number,
  winW: number,
  winH: number,
): Dock => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const distances: Record<Dock, number> = {
    left: cx,
    right: winW - cx,
    top: cy,
    bottom: winH - cy,
  };
  return (Object.keys(distances) as Dock[]).reduce((best, side) =>
    distances[side] < distances[best] ? side : best,
  );
};

const snapToDock = (
  dock: Dock,
  width: number,
  height: number,
  currentY: number,
  currentX: number,
  winW: number,
  winH: number,
) => {
  const maxX = Math.max(EDGE_PAD, winW - width - EDGE_PAD);
  const maxY = Math.max(EDGE_PAD, winH - height - EDGE_PAD);
  const x = Math.min(maxX, Math.max(EDGE_PAD, currentX));
  const y = Math.min(maxY, Math.max(EDGE_PAD, currentY));
  if (dock === 'left') return { x: EDGE_PAD, y };
  if (dock === 'right') return { x: maxX, y };
  if (dock === 'top') return { x, y: EDGE_PAD };
  return { x, y: maxY };
};

const WatchPipPlayer = () => {
  const t = useWatchTokens();
  const { pip, closePip, updatePip } = useWatchPip();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const videoRef = useRef<ExpoVideo | null>(null);
  const [paused, setPaused] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dock, setDock] = useState<Dock>('right');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, moved: false });
  const sizeRef = useRef({ width: 280, height: 220 });
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const currentTimeRef = useRef(0);
  const resumeAppliedRef = useRef('');
  const endedKeyRef = useRef('');
  const handleEndedRef = useRef<() => void>(() => {});
  const bgSoundRef = useRef<Audio.Sound | null>(null);
  const bgActiveRef = useRef(false);
  const handingOffRef = useRef(false);
  const [bgActive, setBgActive] = useState(false);
  const wantPlayingRef = useRef(false);

  const playlist = Array.isArray(pip?.playlist) ? pip.playlist : [];
  const isLibrary = pip?.source === 'library';
  const looping = !!pip?.looping;
  const pipTrackKey = pip
    ? `${pip.source}:${pip.watchId || pip.libraryVideoId}:${pip.videoUrl}`
    : '';

  useEffect(() => {
    configurePipAudioMode().catch(() => {});
  }, []);

  useEffect(() => {
    setMediaReady(false);
    resumeAppliedRef.current = '';
    endedKeyRef.current = '';
    setPaused(pip?.playing === false);
  }, [pipTrackKey]);

  const expandedWidth = Math.min(winW - 24, isLibrary ? 420 : 240);
  const videoHeight = isLibrary
    ? Math.min(expandedWidth * (9 / 16), winH * 0.4)
    : Math.min(expandedWidth * (16 / 9), winH * 0.46);
  const miniVertical = dock === 'left' || dock === 'right';
  const playerWidth = minimized ? (miniVertical ? 64 : Math.min(winW - 24, 280)) : expandedWidth;
  const playerHeight = minimized ? (miniVertical ? 220 : 56) : videoHeight + 88;

  useEffect(() => {
    sizeRef.current = { width: playerWidth, height: playerHeight };
  }, [playerWidth, playerHeight]);

  useEffect(() => {
    if (!pip) {
      setPos(null);
      setMinimized(false);
      return;
    }
    setPos((prev) => {
      const next = clampPos(
        prev?.x ?? winW - playerWidth - 12,
        prev?.y ?? winH - playerHeight - Math.max(insets.bottom, 12) - 64,
        playerWidth,
        playerHeight,
        winW,
        winH,
      );
      return next;
    });
  }, [pip, playerWidth, playerHeight, winW, winH, insets.bottom]);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const stopBackgroundSound = useCallback(async () => {
    const sound = bgSoundRef.current;
    bgSoundRef.current = null;
    bgActiveRef.current = false;
    setBgActive(false);
    return unloadPipBackgroundSound(sound);
  }, []);

  const startBackgroundSound = useCallback(async () => {
    const uri = pip?.videoUrl;
    if (!uri || handingOffRef.current) return;
    handingOffRef.current = true;
    try {
      let positionMillis = Math.max(0, currentTimeRef.current * 1000);
      const video = videoRef.current;
      if (video) {
        try {
          const status = await video.getStatusAsync();
          if (status.isLoaded) {
            positionMillis = status.positionMillis || positionMillis;
            currentTimeRef.current = positionMillis / 1000;
          }
          await video.pauseAsync();
          await video.setIsMutedAsync(true);
        } catch (_) {}
      }
      if (bgSoundRef.current) {
        await unloadPipBackgroundSound(bgSoundRef.current);
        bgSoundRef.current = null;
      }
      const sound = await createPipBackgroundSound({
        uri,
        positionMillis,
        title: pip?.title,
        onEnded: () => {
          handleEndedRef.current?.();
        },
      });
      bgSoundRef.current = sound;
      bgActiveRef.current = true;
      setBgActive(true);
    } catch (err) {
      console.warn('PiP background handoff failed', err);
      bgActiveRef.current = false;
      setBgActive(false);
      try {
        await videoRef.current?.setIsMutedAsync(false);
        if (wantPlayingRef.current) await videoRef.current?.playAsync();
      } catch (_) {}
    } finally {
      handingOffRef.current = false;
    }
  }, [pip?.videoUrl, pip?.title]);

  const playCurrent = useCallback(async () => {
    wantPlayingRef.current = true;
    setPaused(false);
    updatePip({ playing: true });
    if (bgActiveRef.current && bgSoundRef.current) {
      try {
        await bgSoundRef.current.playAsync();
      } catch (_) {}
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.setIsMutedAsync(false);
      await video.playAsync();
    } catch (_) {
      setPaused(true);
    }
  }, [updatePip]);

  const pauseCurrent = useCallback(async () => {
    wantPlayingRef.current = false;
    setPaused(true);
    updatePip({ playing: false });
    if (bgActiveRef.current && bgSoundRef.current) {
      try {
        await bgSoundRef.current.pauseAsync();
      } catch (_) {}
      return;
    }
    try {
      await videoRef.current?.pauseAsync();
    } catch (_) {}
  }, [updatePip]);

  const persistNow = useCallback(() => {
    const time = currentTimeRef.current;
    updatePip({
      currentTime: time,
      playing: !paused,
    });
    return time;
  }, [paused, updatePip]);

  const switchPlaylistByOffset = useCallback(
    (offset: number) => {
      if (playlist.length <= 1 || !pip) return;
      const idx = Math.max(0, getPipPlaylistIndex(playlist, pip));
      let next = null as (typeof playlist)[number] | null;
      for (let step = 1; step <= playlist.length; step += 1) {
        const candidate =
          playlist[(idx + offset * step + playlist.length * step) % playlist.length];
        if (candidate?.url && candidate.url !== pip.videoUrl) {
          next = candidate;
          break;
        }
        if (candidate?.url) next = candidate;
      }
      if (!next?.url) return;
      const nextWatchId = next.watchId || (pip.source === 'watch' ? next.id : null);
      updatePip({
        watchId: nextWatchId || pip.watchId || null,
        libraryVideoId: next.videoId || next.id,
        videoId: next.videoId || next.id,
        videoUrl: next.url,
        title: next.title,
        thumbnail: next.thumbnail || '',
        currentTime: 0,
        playing: true,
        playPass: 1,
        source: nextWatchId ? 'watch' : pip.source || 'library',
      });
    },
    [playlist, pip, updatePip],
  );

  const replayCurrent = useCallback(async () => {
    wantPlayingRef.current = true;
    currentTimeRef.current = 0;
    setPaused(false);
    updatePip({ playing: true, currentTime: 0 });
    try {
      if (bgActiveRef.current && bgSoundRef.current) {
        await bgSoundRef.current.setPositionAsync(0);
        await bgSoundRef.current.playAsync();
        return;
      }
      await videoRef.current?.setPositionAsync(0);
      await videoRef.current?.setIsMutedAsync(false);
      await videoRef.current?.playAsync();
    } catch (_) {}
  }, [updatePip]);

  const handlePrev = useCallback(() => {
    if (currentTimeRef.current > 3 || playlist.length <= 1) {
      replayCurrent();
      return;
    }
    switchPlaylistByOffset(-1);
  }, [playlist.length, replayCurrent, switchPlaylistByOffset]);

  const handleNext = useCallback(() => {
    if (playlist.length <= 1) {
      replayCurrent();
      return;
    }
    switchPlaylistByOffset(1);
  }, [playlist.length, replayCurrent, switchPlaylistByOffset]);

  const handleEnded = useCallback(() => {
    if (!pip) return;
    const idx = getPipPlaylistIndex(playlist, pip);
    const item = (idx >= 0 ? playlist[idx] : null) || ({} as any);
    const times = clampPlayCount(item.playCount || 1);
    const pass = Math.max(1, Number(pip.playPass) || 1);

    if (pass < times) {
      updatePip({ playPass: pass + 1, currentTime: 0, playing: true });
      replayCurrent();
      return;
    }

    if (playlist.length <= 1) {
      if (looping) {
        updatePip({ playPass: 1, currentTime: 0, playing: true });
        replayCurrent();
      } else {
        pauseCurrent();
      }
      return;
    }

    const atLast = idx >= playlist.length - 1;
    if (atLast && !looping) {
      pauseCurrent();
      return;
    }
    switchPlaylistByOffset(1);
  }, [pip, playlist, looping, updatePip, replayCurrent, pauseCurrent, switchPlaylistByOffset]);

  handleEndedRef.current = handleEnded;
  wantPlayingRef.current = pip?.playing !== false;

  useEffect(() => {
    if (pip) return undefined;
    stopBackgroundSound();
    return undefined;
  }, [pip, stopBackgroundSound]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (!pip?.videoUrl) return;
      if (isAppBackgrounded(next) && wantPlayingRef.current) {
        await startBackgroundSound();
        return;
      }
      if (next === 'active' && bgActiveRef.current) {
        const positionMillis = await stopBackgroundSound();
        currentTimeRef.current = positionMillis / 1000;
        const video = videoRef.current;
        if (!video) return;
        try {
          if (positionMillis > 0) await video.setPositionAsync(positionMillis);
          await video.setIsMutedAsync(false);
          if (wantPlayingRef.current) await video.playAsync();
        } catch (_) {}
      }
    });
    return () => sub.remove();
  }, [pip?.videoUrl, startBackgroundSound, stopBackgroundSound]);

  useEffect(() => {
    if (!bgActiveRef.current || !pip?.videoUrl || !wantPlayingRef.current) return;
    startBackgroundSound();
  }, [pipTrackKey]);

  const togglePlay = () => {
    if (paused) playCurrent();
    else pauseCurrent();
  };

  const handleClose = () => {
    pauseCurrent();
    stopBackgroundSound();
    closePip();
  };

  const handleExpand = async () => {
    if (bgSoundRef.current) {
      try {
        const status = await bgSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          currentTimeRef.current = (status.positionMillis || 0) / 1000;
        }
      } catch (_) {}
    }
    const time = persistNow();
    await stopBackgroundSound();
    closePip();
    navigate('Menu', {
      screen: 'MediaPlayer',
      params: {
        videoId: pip?.videoId || pip?.libraryVideoId,
        resumeAt: time,
        autoplay: pip?.playing !== false,
        playUrl: pip?.videoUrl,
        playTitle: pip?.title,
      },
    });
  };

  const handleMinimize = () => {
    const nextDock = nearestDock(
      pos?.x ?? 0,
      pos?.y ?? 0,
      playerWidth,
      playerHeight,
      winW,
      winH,
    );
    const vertical = nextDock === 'left' || nextDock === 'right';
    const next = snapToDock(
      nextDock,
      vertical ? 64 : Math.min(winW - 24, 280),
      vertical ? 220 : 56,
      pos?.y ?? EDGE_PAD,
      pos?.x ?? EDGE_PAD,
      winW,
      winH,
    );
    setDock(nextDock);
    setMinimized(true);
    setPos(next);
  };

  const handleRestore = () => setMinimized(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          dragOrigin.current = {
            x: posRef.current?.x ?? 0,
            y: posRef.current?.y ?? 0,
            moved: false,
          };
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 6) dragOrigin.current.moved = true;
          const next = clampPos(
            dragOrigin.current.x + g.dx,
            dragOrigin.current.y + g.dy,
            sizeRef.current.width,
            sizeRef.current.height,
            winW,
            winH,
          );
          posRef.current = next;
          setPos(next);
        },
        onPanResponderRelease: () => {
          if (!dragOrigin.current.moved || !minimized) return;
          const current = posRef.current || { x: EDGE_PAD, y: EDGE_PAD };
          const nextDock = nearestDock(
            current.x,
            current.y,
            sizeRef.current.width,
            sizeRef.current.height,
            winW,
            winH,
          );
          const snapped = snapToDock(
            nextDock,
            sizeRef.current.width,
            sizeRef.current.height,
            current.y,
            current.x,
            winW,
            winH,
          );
          setDock(nextDock);
          posRef.current = snapped;
          setPos(snapped);
        },
      }),
    [minimized, winW, winH],
  );

  const pipSource = useMemo(
    () => (pip?.videoUrl ? { uri: pip.videoUrl } : undefined),
    [pip?.videoUrl],
  );

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setMediaReady(true);
    if (!bgActiveRef.current) {
      currentTimeRef.current = (status.positionMillis || 0) / 1000;
    }
    if (status.didJustFinish && !bgActiveRef.current && endedKeyRef.current !== pipTrackKey) {
      endedKeyRef.current = pipTrackKey;
      handleEndedRef.current();
    }

    if (resumeAppliedRef.current !== pipTrackKey && pip) {
      resumeAppliedRef.current = pipTrackKey;
      const resumeAt = Number(pip.currentTime) || 0;
      if (resumeAt > 0.2) {
        videoRef.current?.setPositionAsync(resumeAt * 1000).catch(() => {});
      }
    }
  }, [pipTrackKey, pip]);

  if (!pip) return null;

  const playlistIndex = getPipPlaylistIndex(playlist, pip);
  const canSkip = playlist.length > 1;
  const left = pos?.x ?? winW - playerWidth - 12;
  const top = pos?.y ?? winH - playerHeight - 80;

  const iconOn = t.text;
  const iconOff = t.disabled;

  const playButton = (
    extra: object = {},
    longPressClose = false,
  ) => (
    <Pressable
      style={[styles.btn, { width: 34, height: 34, borderRadius: 17, backgroundColor: t.primary }]}
      onPress={togglePlay}
      onLongPress={longPressClose ? handleClose : undefined}
      delayLongPress={CLOSE_LONG_PRESS_MS}
      hitSlop={8}
      {...extra}
    >
      <Icon name={paused ? 'play-arrow' : 'pause'} size={18} color={t.ctaText} />
    </Pressable>
  );

  const chromeBtn = { backgroundColor: t.btnBg };

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          styles.player,
          isLibrary ? styles.isLibrary : styles.isWatch,
          minimized && styles.minimized,
          minimized && miniVertical && styles.minimizedVertical,
          {
            left,
            top,
            width: playerWidth,
            backgroundColor: t.surface,
            borderColor: t.border,
          },
        ]}
      >
        {minimized ? (
          <View style={[styles.mini, miniVertical && styles.miniVertical]}>
            <View style={[styles.miniThumb, { backgroundColor: t.btnBg }]} {...panResponder.panHandlers}>
              {pip.thumbnail ? (
                <Image source={{ uri: pip.thumbnail }} style={styles.thumbImg} />
              ) : (
                <Icon name="movie" size={18} color={t.muted} />
              )}
            </View>
            <Pressable style={[styles.btn, chromeBtn]} onPress={handlePrev} disabled={!canSkip} hitSlop={8}>
              <Icon name="skip-previous" size={16} color={canSkip ? iconOn : iconOff} />
            </Pressable>
            {playButton({}, true)}
            <Pressable style={[styles.btn, chromeBtn]} onPress={handleNext} disabled={!canSkip} hitSlop={8}>
              <Icon name="skip-next" size={16} color={canSkip ? iconOn : iconOff} />
            </Pressable>
            <Pressable style={[styles.btn, chromeBtn]} onPress={handleRestore} hitSlop={8}>
              <Icon name="open-in-full" size={14} color={iconOn} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.chrome, { backgroundColor: t.overlay }]}>
            <View style={{ flex: 1, minWidth: 0 }} {...panResponder.panHandlers}>
              <Text style={[styles.chromeTitle, { color: t.text }]} numberOfLines={1}>
                {pip.title}
              </Text>
            </View>
            <Pressable style={[styles.btn, chromeBtn]} onPress={handleMinimize} hitSlop={8}>
              <Icon name="remove" size={16} color={iconOn} />
            </Pressable>
            <Pressable style={[styles.btn, chromeBtn]} onPress={handleExpand} hitSlop={8}>
              <Icon name="fullscreen" size={16} color={iconOn} />
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: t.error }]} onPress={handleClose} hitSlop={8}>
              <Icon name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        )}

        <View
          style={[
            styles.videoWrap,
            !isLibrary && !minimized && styles.videoWrapWatch,
            minimized && styles.videoHidden,
          ]}
          pointerEvents={minimized ? 'none' : 'auto'}
        >
          <ExpoVideo
            ref={(node) => {
              videoRef.current = node;
            }}
            source={pipSource}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={pip.playing !== false && !bgActive}
            isMuted={!!pip.muted}
            isLooping={false}
            useNativeControls={false}
            progressUpdateIntervalMillis={500}
            posterSource={pip.thumbnail ? { uri: pip.thumbnail } : undefined}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          />
          {!minimized && !mediaReady ? (
            <View style={styles.cover} pointerEvents="none">
              {pip.thumbnail ? (
                <Image source={{ uri: pip.thumbnail }} style={styles.thumbImg} />
              ) : (
                <Icon name="hourglass-empty" size={22} color={t.mediaIcon} />
              )}
            </View>
          ) : null}
        </View>

        {!minimized ? (
          <View style={[styles.toolbar, { backgroundColor: t.overlay }]}>
            <Pressable style={[styles.btn, chromeBtn]} onPress={handlePrev} disabled={!canSkip}>
              <Icon name="skip-previous" size={16} color={canSkip ? iconOn : iconOff} />
            </Pressable>
            {playButton()}
            <Pressable style={[styles.btn, chromeBtn]} onPress={handleNext} disabled={!canSkip}>
              <Icon name="skip-next" size={16} color={canSkip ? iconOn : iconOff} />
            </Pressable>
            <Pressable
              style={[styles.btn, chromeBtn, looping && { backgroundColor: t.primaryMid }]}
              onPress={() => updatePip({ looping: !looping })}
            >
              <Icon name="repeat" size={16} color={looping ? t.ctaText : iconOn} />
            </Pressable>
            {canSkip ? (
              <Text style={[styles.index, { color: t.muted }]}>
                {playlistIndex >= 0 ? playlistIndex + 1 : 1}/{playlist.length}
                {clampPlayCount(playlist[playlistIndex]?.playCount || 1) > 1
                  ? ` · ${Math.max(1, Number(pip.playPass) || 1)}/${clampPlayCount(playlist[playlistIndex].playCount)}`
                  : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  player: {
    position: 'absolute',
    zIndex: 10050,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  isLibrary: {},
  isWatch: {},
  minimized: {},
  minimizedVertical: {},
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chromeTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  miniVertical: {
    flexDirection: 'column',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  miniThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  videoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoWrapWatch: {
    aspectRatio: 9 / 16,
    maxHeight: 360,
  },
  videoHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  index: {
    marginLeft: 4,
    fontSize: 11,
  },
});

export default WatchPipPlayer;
