import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import api from '../lib/api';
import { listDownloads, deleteDownload, DownloadItem } from '../lib/downloads';
import { getWatchSavedMetaMap, parseWatchIdFromFileName, removeWatchSavedMeta, saveWatchVideoFromUrl } from '../lib/saveWatchVideo';
import { subscribeWatchDownloads, WatchDownloadJob } from '../utils/watchDownloadProgress';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getStageLabel } from '../lib/ytDownload';
import {
  BackgroundDownloadJob,
  cancelBackgroundDownload,
  subscribeBackgroundDownloads,
} from '../lib/ytDownloadManager';

const humanSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

const getPreviousItemTitle = (item: any) => {
  const metadata = item?.metadata || {};
  return metadata.caption || metadata.title || metadata.name || `Video ${item?.videoId || item?._id || 'download'}`;
};

const getPreviousItemUrl = (item: any) => {
  const metadata = item?.metadata || {};
  const candidates = [
    item?.sourceUrl,
    metadata.videoURL,
    metadata.videoUrl,
    metadata.url,
    metadata.downloadUrl,
    metadata.downloadURL,
    metadata.mediaUrl,
    metadata.mediaURL,
    metadata?.video?.url,
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof match === 'string' ? match.trim() : '';
};

const getPreviousItemThumbnail = (item: any) => {
  const metadata = item?.metadata || {};
  return metadata.thumbnail || metadata.author?.profilePic || '';
};

const DownloadsScreen = () => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation();
  const [files, setFiles] = useState<DownloadItem[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [previousDownloads, setPreviousDownloads] = useState<any[]>([]);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [restoringPrevious, setRestoringPrevious] = useState<string | null>(null);
  const [restoringAllPrevious, setRestoringAllPrevious] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<BackgroundDownloadJob[]>([]);
  const [watchJobs, setWatchJobs] = useState<WatchDownloadJob[]>([]);
  const [deletingPreviousId, setDeletingPreviousId] = useState<string | null>(null);
  const activeJobs = jobs.filter((job) => job.status === 'running');
  const activeWatchJobs = watchJobs.filter((job) => job.status === 'downloading' || job.status === 'failed');

  const loadPreviousDownloads = useCallback(async () => {
    setLoadingPrevious(true);
    try {
      const response = await api.get('saved-videos/history');
      const payload = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const normalized = Array.isArray(payload) ? payload : [];
      normalized.sort((a, b) => {
        const left = new Date(a?.downloadedAt || a?.createdAt || 0).getTime();
        const right = new Date(b?.downloadedAt || b?.createdAt || 0).getTime();
        return right - left;
      });
      setPreviousDownloads(normalized);
    } catch (error) {
      console.warn('[DownloadsScreen] Failed to load previous downloads:', error);
      setPreviousDownloads([]);
    } finally {
      setLoadingPrevious(false);
    }
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [items, meta] = await Promise.all([listDownloads(), getWatchSavedMetaMap()]);
      items.sort((a, b) => (b.mtime?.getTime() || 0) - (a.mtime?.getTime() || 0));
      const nextTitles: Record<string, string> = {};
      items.forEach((item) => {
        const watchId = parseWatchIdFromFileName(item.name);
        if (watchId && meta[watchId]?.title) nextTitles[item.path] = meta[watchId].title;
      });
      setTitles(nextTitles);
      setFiles(items);
    } catch (_) {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    loadPreviousDownloads();
  }, [load, loadPreviousDownloads]);

  useEffect(() => {
    return subscribeBackgroundDownloads((nextJobs) => {
      setJobs(nextJobs);
      if (nextJobs.some((job) => job.status === 'completed')) {
        load();
      }
    });
  }, [load]);

  useEffect(() => {
    return subscribeWatchDownloads((nextJobs) => {
      setWatchJobs(nextJobs);
      if (nextJobs.some((job) => job.status === 'completed')) {
        load();
        loadPreviousDownloads();
      }
    });
  }, [load, loadPreviousDownloads]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadPreviousDownloads();
    }, [load, loadPreviousDownloads]),
  );

  const handlePlay = (item: DownloadItem) => {
    (navigation as any).navigate('MediaPlayer', {
      source: {
        type: item.kind,
        uri: item.uri,
        title: titles[item.path] || item.name,
      },
    });
  };

  const handleDelete = async (item: DownloadItem) => {
    const label = titles[item.path] || item.name;
    Alert.alert('Delete download', `Remove ${label} from the app?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const watchId = parseWatchIdFromFileName(item.name);
            await deleteDownload(item.path);
            if (watchId) await removeWatchSavedMeta(watchId);
            await load();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete file');
          }
        },
      },
    ]);
  };

  const galleryLabel = Platform.OS === 'ios' ? 'Also saved to Photos' : 'Also saved to Gallery';

  const handleRestorePrevious = async (item: any) => {
    const watchId = String(item?.videoId || item?._id || '');
    const sourceUrl = getPreviousItemUrl(item);
    if (!watchId || !sourceUrl) {
      Alert.alert('Restore unavailable', 'This previous download has no saved source URL to restore.');
      return false;
    }

    setRestoringPrevious(watchId);
    try {
      const result = await saveWatchVideoFromUrl({
        _id: watchId,
        caption: getPreviousItemTitle(item),
        thumbnail: getPreviousItemThumbnail(item),
        videoUrl: sourceUrl,
        photos: getPreviousItemThumbnail(item),
        author: item?.metadata?.author,
      });

      if (result?.ok) {
        await load();
        await loadPreviousDownloads();
        return true;
      }

      Alert.alert('Restore failed', 'This previous download could not be restored.');
      return false;
    } catch (error) {
      console.warn('[DownloadsScreen] Failed to restore previous download:', error);
      Alert.alert('Restore failed', 'This previous download could not be restored.');
      return false;
    } finally {
      setRestoringPrevious(null);
    }
  };

  const handleDeletePrevious = async (item: any) => {
    const videoId = String(item?.videoId || item?._id || '');
    if (!videoId) return;

    Alert.alert('Delete previous download', `Remove ${getPreviousItemTitle(item)} from your history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingPreviousId(videoId);
          try {
            await api.delete(`saved-videos/${encodeURIComponent(videoId)}`);
            setPreviousDownloads((current) => current.filter((entry) => String(entry?.videoId || entry?._id) !== videoId));
          } catch (error) {
            console.warn('[DownloadsScreen] Failed to delete previous download:', error);
            Alert.alert('Error', 'Failed to delete previous download');
          } finally {
            setDeletingPreviousId(null);
          }
        },
      },
    ]);
  };

  const handleRestoreAllPrevious = async () => {
    if (restoringAllPrevious || previousDownloads.length === 0) return;
    setRestoringAllPrevious(true);
    try {
      let restoredCount = 0;
      for (const item of previousDownloads) {
        const didRestore = await handleRestorePrevious(item);
        if (didRestore) restoredCount += 1;
      }
      await loadPreviousDownloads();
      if (restoredCount > 0) {
        await load();
      }
      if (restoredCount === 0) {
        Alert.alert('Nothing restored', 'No previous download could be restored right now.');
      }
    } finally {
      setRestoringAllPrevious(false);
    }
  };

  const renderItem = ({ item }: { item: DownloadItem }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.surface.secondary }]}
      onPress={() => handlePlay(item)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, { backgroundColor: themeColors.background.secondary }]}>
        <Icon
          name={item.kind === 'audio' ? 'audiotrack' : 'play-circle-filled'}
          size={28}
          color={themeColors.primary}
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: themeColors.text.primary }]} numberOfLines={2}>
          {titles[item.path] || item.name}
        </Text>
        <Text style={[styles.meta, { color: themeColors.text.secondary }]}>
          {humanSize(item.size)} · {parseWatchIdFromFileName(item.name) ? 'Watch' : item.kind === 'audio' ? 'Audio' : 'Video'}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.primary }]} onPress={() => handlePlay(item)}>
          <Text style={styles.btnText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.status?.error || '#E53935' }]} onPress={() => handleDelete(item)}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const previousHeader = previousDownloads.length > 0 ? (
    <View style={{ marginBottom: 12 }}>
      <View style={[styles.sectionHeader, { borderColor: themeColors.surface.secondary }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Previous Downloads</Text>
        <TouchableOpacity
          style={[styles.inlineBtn, { backgroundColor: themeColors.primary }]}
          onPress={handleRestoreAllPrevious}
          disabled={restoringAllPrevious}
        >
          <Text style={styles.inlineBtnText}>{restoringAllPrevious ? 'Restoring…' : 'Restore all'}</Text>
        </TouchableOpacity>
      </View>
      {loadingPrevious ? (
        <View style={styles.centerRow}>
          <ActivityIndicator size="small" color={themeColors.primary} />
          <Text style={[styles.emptyText, { color: themeColors.text.secondary, marginLeft: 8 }]}>Loading previous downloads...</Text>
        </View>
      ) : (
        previousDownloads.map((item, index) => {
          const itemId = String(item?.videoId || item?._id || '');
          const itemTitle = getPreviousItemTitle(item);
          const itemUrl = getPreviousItemUrl(item);
          const thumb = getPreviousItemThumbnail(item);
          const isRestoring = restoringPrevious === itemId;
          const isDeleting = deletingPreviousId === itemId;
          const stableKey = itemId || `previous-${index}`;

          return (
            <View
              key={stableKey}
              style={[styles.row, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.surface.secondary }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: themeColors.background.secondary }]}>
                {thumb ? (
                  <Image
                    source={{ uri: thumb }}
                    style={styles.thumbPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <Icon name="history" size={22} color={themeColors.primary} />
                )}
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: themeColors.text.primary }]} numberOfLines={2}>{itemTitle}</Text>
                <Text style={[styles.meta, { color: themeColors.text.secondary }]}>{itemUrl ? 'Saved in your account' : 'No source URL stored'}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: themeColors.primary, opacity: itemUrl ? 1 : 0.5 }]}
                  onPress={() => itemUrl && handleRestorePrevious(item)}
                  disabled={!itemUrl || isRestoring}
                >
                  <Text style={styles.btnText}>{isRestoring ? 'Restoring…' : 'Restore'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: themeColors.status?.error || '#E53935', opacity: isDeleting ? 0.7 : 1 }]}
                  onPress={() => handleDeletePrevious(item)}
                  disabled={isDeleting}
                >
                  <Text style={styles.btnText}>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.container, { backgroundColor: themeColors.background.primary }]}
    >
      <View style={[styles.header, { borderColor: themeColors.surface.secondary }]}>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Downloads</Text>
        <Text style={[styles.headerPath, { color: themeColors.text.secondary }]} numberOfLines={1}>
          {galleryLabel}
        </Text>
      </View>
      <FlatList
        data={files}
        keyExtractor={(item) => item.path}
        renderItem={renderItem}
        onRefresh={load}
        refreshing={refreshing}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}
        ListHeaderComponent={
          <>
            {activeJobs.length > 0 || activeWatchJobs.length > 0 ? (
              <View style={{ marginBottom: 12 }}>
                {activeWatchJobs.map((job) => (
                  <View
                    key={`watch-${job.id}`}
                    style={[styles.row, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.surface.secondary }]}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: themeColors.background.secondary }]}>
                      {job.status === 'failed' ? (
                        <Icon name="error" size={22} color={themeColors.status?.error || '#E53935'} />
                      ) : (
                        <ActivityIndicator size="small" color={themeColors.primary} />
                      )}
                    </View>
                    <View style={styles.info}>
                      <Text style={[styles.name, { color: themeColors.text.primary }]} numberOfLines={2}>
                        {job.title}
                      </Text>
                      <Text style={[styles.meta, { color: themeColors.text.secondary }]}>
                        {job.status === 'failed'
                          ? job.error || 'Download failed'
                          : `Saving Watch video · ${Math.round(job.percent)}%`}
                      </Text>
                    </View>
                  </View>
                ))}
                {activeJobs.map((job) => (
                  <View
                    key={job.id}
                    style={[styles.row, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.surface.secondary }]}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: themeColors.background.secondary }]}>
                      <ActivityIndicator size="small" color={themeColors.primary} />
                    </View>
                    <View style={styles.info}>
                      <Text style={[styles.name, { color: themeColors.text.primary }]} numberOfLines={2}>
                        {job.title}
                      </Text>
                      <Text style={[styles.meta, { color: themeColors.text.secondary }]}>
                        {getStageLabel(job.stage)} · {Math.round(job.progress)}%
                      </Text>
                    </View>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.status?.error || '#E53935' }]} onPress={() => cancelBackgroundDownload(job.id)}>
                      <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={
          previousDownloads.length > 0 ? (
            <View style={{ marginTop: 8 }}>{previousHeader}</View>
          ) : null
        }
        ListEmptyComponent={
          activeJobs.length > 0 || activeWatchJobs.length > 0 || previousDownloads.length > 0 ? null : (
            <Text style={{ textAlign: 'center', color: themeColors.text.secondary, marginTop: 40 }}>
              No downloads yet
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerPath: { fontSize: 12, marginTop: 4 },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: { flex: 1, paddingRight: 10 },
  name: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row' },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  inlineBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  inlineBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  emptyText: { fontSize: 12 },
  thumbPreview: { width: 44, height: 44, borderRadius: 10 },
});

export default DownloadsScreen;
