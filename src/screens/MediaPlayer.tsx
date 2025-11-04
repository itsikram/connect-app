import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Dimensions, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Media source passed via route params or defaults
type MediaSource = {
  type: 'video' | 'audio';
  uri: string; // remote or file URI
  title?: string;
  poster?: string; // for video poster image (optional)
};

const DEFAULT_VIDEO: MediaSource = {
  type: 'video',
  // Fallback sample: expects you to pass a valid uri via route params
  uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  title: 'Sample Video',
};

const DEFAULT_AUDIO: MediaSource = {
  type: 'audio',
  // Use a bundled ringtone as an example; replace with your own
  uri: '',
  title: 'Sample Audio',
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = m < 10 ? `0${m}` : String(m);
  const ss = s < 10 ? `0${s}` : String(s);
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const MediaPlayer = ({ route, navigation }: any) => {
  const { colors: themeColors, isDarkMode } = useTheme();

  const paramsSource: MediaSource | undefined = route?.params?.source;
  const source: MediaSource = paramsSource || DEFAULT_VIDEO;

  // Lazy require for react-native-video to avoid hard dependency issues
  let VideoComp: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    VideoComp = require('react-native-video').default;
  } catch (_) {
    VideoComp = null;
  }

  const playerRef = useRef<any>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(false);
      StatusBar.setBackgroundColor('#000');
    }
    StatusBar.setBarStyle('light-content');
  }, []);

  const isVideo = source.type === 'video';

  const togglePlay = () => setPaused(p => !p);
  const toggleMute = () => setMuted(m => !m);
  const toggleLoop = () => setLoop(l => !l);
  const cycleRate = () => {
    setRate(r => {
      const next = r >= 2 ? 0.5 : r + 0.5; // 0.5 -> 1.0 -> 1.5 -> 2.0 -> 0.5
      return parseFloat(next.toFixed(1));
    });
  };

  const seekTo = (seconds: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.seek(seconds);
    } catch (_) {}
  };

  const skip = (delta: number) => {
    const next = Math.max(0, Math.min(duration, position + delta));
    seekTo(next);
    setPosition(next);
  };

  const onLoad = (meta: any) => {
    setDuration(meta?.duration || 0);
    setBuffering(false);
  };
  const onProgress = (prog: any) => {
    if (!seeking) setPosition(prog?.currentTime || 0);
  };
  const onBuffer = (e: any) => setBuffering(!!e?.isBuffering);
  const onEnd = () => {
    if (loop) {
      seekTo(0);
    } else {
      setPaused(true);
    }
  };

  const headerTitle = useMemo(() => source.title || (isVideo ? 'Video' : 'Audio'), [source.title, isVideo]);

  const renderControls = () => (
    <View style={styles.controlsRow}>
      <TouchableOpacity style={styles.iconBtn} onPress={() => skip(-10)}>
        <Icon name="replay-10" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: themeColors.primary }]} onPress={togglePlay}>
        <Icon name={paused ? 'play-arrow' : 'pause'} size={30} color="#000" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconBtn} onPress={() => skip(10)}>
        <Icon name="forward-10" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={styles.iconBtn} onPress={toggleMute}>
        <Icon name={muted ? 'volume-off' : 'volume-up'} size={22} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.chipBtn} onPress={cycleRate}>
        <Text style={styles.chipText}>{rate.toFixed(1)}x</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={toggleLoop}>
        <Icon name={loop ? 'repeat-on' : 'repeat'} size={22} color={loop ? themeColors.primary : '#fff'} />
      </TouchableOpacity>
      {isVideo && (
        <TouchableOpacity style={styles.iconBtn} onPress={() => setFullscreen(f => !f)}>
          <Icon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} color="#fff" />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.iconBtn} onPress={() => setRotated(r => !r)}>
        <Icon name="screen-rotation" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderSeekbar = () => (
    <View style={styles.seekRow}>
      <Text style={styles.timeText}>{formatTime(position)}</Text>
      <Slider
        style={{ flex: 1, height: 32, marginHorizontal: 8 }}
        minimumValue={0}
        maximumValue={Math.max(1, duration)}
        minimumTrackTintColor={themeColors.primary}
        maximumTrackTintColor={'rgba(255,255,255,0.4)'}
        thumbTintColor={themeColors.primary}
        value={position}
        onSlidingStart={() => setSeeking(true)}
        onSlidingComplete={(v) => {
          setSeeking(false);
          seekTo(v);
          setPosition(v);
        }}
        onValueChange={(v) => setPosition(v)}
      />
      <Text style={styles.timeText}>{formatTime(duration)}</Text>
    </View>
  );

  const playerStyle = isVideo
    ? (fullscreen ? styles.videoFullscreen : styles.video)
    : styles.audioPlaceholder;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}> 
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('VideoLibrary')}>
          <Icon name="video-library" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.playerArea}>
        {VideoComp ? (
          <VideoComp
            ref={playerRef}
            source={{ uri: source.uri }}
            paused={paused}
            muted={muted}
            repeat={loop}
            rate={rate}
            onLoad={onLoad}
            onProgress={onProgress}
            onBuffer={onBuffer}
            onEnd={onEnd}
            style={[playerStyle, rotated && styles.rotate90]}
            poster={isVideo ? source.poster : undefined}
            playInBackground
            playWhenInactive
            ignoreSilentSwitch="ignore"
            useTextureView
          />
        ) : (
          <View style={[playerStyle, { justifyContent: 'center', alignItems: 'center' }]}>
            <Icon name="movie" size={48} color="#fff" />
            <Text style={{ color: '#fff', marginTop: 8, opacity: 0.8 }}>Install react-native-video to enable playback</Text>
          </View>
        )}

        {buffering && (
          <View style={styles.bufferBadge}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Buffering…</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPanel}>
        {renderSeekbar()}
        {renderControls()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    backgroundColor: '#000',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  playerArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  video: { width: SCREEN_WIDTH, height: Math.min(400, SCREEN_HEIGHT * 0.45), backgroundColor: '#000' },
  videoFullscreen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7, backgroundColor: '#000' },
  audioPlaceholder: { width: SCREEN_WIDTH, height: 160, backgroundColor: '#111' },
  bufferBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },

  bottomPanel: { backgroundColor: 'rgba(12,12,12,0.92)', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  seekRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  timeText: { color: '#fff', fontSize: 12, width: 48, textAlign: 'center' },

  controlsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  primaryBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  chipBtn: { height: 32, borderRadius: 16, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 2 },
  chipText: { color: '#fff', fontWeight: '700' },
  rotate90: { transform: [{ rotate: '90deg' }] },
});

export default MediaPlayer;


