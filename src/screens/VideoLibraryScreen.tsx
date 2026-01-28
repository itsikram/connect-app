import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, PermissionsAndroid, Platform, StatusBar, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { listDownloads } from '../lib/downloads';

// Use CameraRoll to fetch device videos
let CameraRoll: any = null;
let createThumbnail: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CameraRoll = require('@react-native-camera-roll/camera-roll').CameraRoll;
} catch (error) {
  console.log('CameraRoll not available:', error.message);
  CameraRoll = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  createThumbnail = require('react-native-create-thumbnail').createThumbnail;
} catch (error) {
  console.log('createThumbnail not available:', error.message);
  createThumbnail = null;
}

type VideoAsset = {
  id: string;
  uri: string;
  filename?: string;
  duration?: number;
  playableDuration?: number;
  fileSize?: number;
  isDownloaded?: boolean;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GUTTER = 6;
const NUM_COLUMNS = 3;
const THUMB = Math.floor((SCREEN_WIDTH - GUTTER * (NUM_COLUMNS + 1)) / NUM_COLUMNS);

function formatDuration(seconds?: number) {
  if (!seconds || !isFinite(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

const VideoLibraryScreen = ({ navigation }: any) => {
  const { colors: themeColors } = useTheme();
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloads, setDownloads] = useState<Array<{ name: string; path: string }>>([]);
  const [downloadDurations, setDownloadDurations] = useState<Record<string, number>>({});

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    const sdk = Platform.Version as number;
    try {
      if (sdk >= 33) {
        const res = await PermissionsAndroid.requestMultiple([
          // Android 13+ granular permissions
          'android.permission.READ_MEDIA_VIDEO' as any,
        ]);
        return Object.values(res).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
      }
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch (_) {
      return false;
    }
  }, []);

  const loadPage = useCallback(async (reset = false) => {
    if (!CameraRoll) return;
    if (loading) return;
    setLoading(true);
    try {
      const page = await CameraRoll.getPhotos({
        first: 60,
        assetType: 'Videos',
        include: ['filename', 'fileSize', 'playableDuration'],
        after: reset ? undefined : endCursor || undefined,
      });
      const newAssets: VideoAsset[] = page.edges.map((e: any, idx: number) => ({
        id: e.node.image.uri + (e.node.image.filename || idx),
        uri: e.node.image.uri,
        filename: e.node.image.filename,
        fileSize: e.node.image.fileSize,
        playableDuration: e.node.image.playableDuration,
        duration: e.node.image.playableDuration,
      }));
      setAssets(prev => (reset ? newAssets : [...prev, ...newAssets]));
      setEndCursor(page.page_info.end_cursor || null);
      setHasNextPage(Boolean(page.page_info.has_next_page));
    } catch (e) {
      console.warn('VideoLibrary load error', e);
    } finally {
      setLoading(false);
    }
  }, [endCursor, loading]);

  useEffect(() => {
    (async () => {
      const ok = await requestPermissions();
      if (ok) {
        loadPage(true);
      }
      try {
        const files = await listDownloads();
        setDownloads(files.map(f => ({ name: f.name, path: f.path })));
      } catch (_) {}
    })();
  }, [requestPermissions, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setEndCursor(null);
    setHasNextPage(true);
    await loadPage(true);
    try {
      const files = await listDownloads();
      setDownloads(files.map(f => ({ name: f.name, path: f.path })));
    } catch (_) {}
    setRefreshing(false);
  }, [loadPage]);

  // Derive durations for downloaded files using createThumbnail (if available)
  useEffect(() => {
    if (!createThumbnail) return;
    (async () => {
      for (const d of downloads) {
        if (downloadDurations[d.path] != null) continue;
        try {
          const res = await createThumbnail({ url: `file://${d.path}`, timeStamp: 0 });
          const seconds = res?.duration ? Math.round(Number(res.duration) / 1000) : undefined;
          if (seconds && isFinite(seconds)) {
            setDownloadDurations(prev => ({ ...prev, [d.path]: seconds }));
          }
        } catch (_) {}
      }
    })();
  }, [downloads, downloadDurations]);

  const allItems: VideoAsset[] = React.useMemo(() => {
    const dlAsAssets: VideoAsset[] = downloads.map((d) => ({
      id: `dl:${d.path}`,
      uri: `file://${d.path}`,
      filename: d.name,
      isDownloaded: true,
      duration: downloadDurations[d.path],
    }));
    return [...dlAsAssets, ...assets];
  }, [downloads, assets, downloadDurations]);

  const renderItem = ({ item }: { item: VideoAsset }) => (
    <TouchableOpacity
      style={{ width: THUMB, height: THUMB * 1.3, margin: GUTTER }}
      onPress={() => navigation.navigate('Menu', { screen: 'MediaPlayer', params: { source: { type: 'video', uri: item.uri, title: item.filename } } })}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#111' }} resizeMode="cover" />
      <View style={styles.durationBadge}>
        <Icon name="play-arrow" size={14} color="#fff" />
        <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
      </View>
      {item.isDownloaded && (
        <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Icon name="download" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  // Downloads are now merged into the main list; no separate section

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}> 
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Device Videos</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => onRefresh()}>
          <Icon name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {!CameraRoll ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="video-library" size={48} color="#fff" />
          <Text style={{ color: '#fff', marginTop: 10, opacity: 0.8 }}>Install @react-native-camera-roll/camera-roll</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: GUTTER }}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id}
          data={allItems}
          renderItem={renderItem}
          onEndReached={() => hasNextPage && loadPage(false)}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={undefined}
          ListEmptyComponent={!loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#aaa' }}>No videos found</Text>
            </View>
          ) : null}
        />
      )}
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
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  durationBadge: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  durationText: { color: '#fff', fontSize: 12, marginLeft: 4 },
});

export default VideoLibraryScreen;



