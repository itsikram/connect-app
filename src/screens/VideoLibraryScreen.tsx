import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, PermissionsAndroid, Platform, SafeAreaView, StatusBar, RefreshControl, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

// Use CameraRoll to fetch device videos
let CameraRoll: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CameraRoll = require('@react-native-camera-roll/camera-roll').CameraRoll;
} catch (_) {
  CameraRoll = null;
}

type VideoAsset = {
  id: string;
  uri: string;
  filename?: string;
  duration?: number;
  playableDuration?: number;
  fileSize?: number;
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
    })();
  }, [requestPermissions, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setEndCursor(null);
    setHasNextPage(true);
    await loadPage(true);
    setRefreshing(false);
  }, [loadPage]);

  const renderItem = ({ item }: { item: VideoAsset }) => (
    <TouchableOpacity
      style={{ width: THUMB, height: THUMB * 1.3, margin: GUTTER }}
      onPress={() => navigation.navigate('Menu', { screen: 'MediaPlayer', params: { source: { type: 'video', uri: item.uri, title: item.filename } } })}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
      <View style={styles.durationBadge}>
        <Icon name="play-arrow" size={14} color="#fff" />
        <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
      </View>
    </TouchableOpacity>
  );

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
          data={assets}
          renderItem={renderItem}
          onEndReached={() => hasNextPage && loadPage(false)}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={onRefresh} />}
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



