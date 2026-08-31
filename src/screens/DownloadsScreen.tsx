import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { listDownloads, deleteDownload, DownloadItem } from '../lib/downloads';
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

const DownloadsScreen = () => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation();
  const [files, setFiles] = useState<DownloadItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<BackgroundDownloadJob[]>([]);
  const activeJobs = jobs.filter((job) => job.status === 'running');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const items = await listDownloads();
      items.sort((a, b) => (b.mtime?.getTime() || 0) - (a.mtime?.getTime() || 0));
      setFiles(items);
    } catch (_) {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return subscribeBackgroundDownloads((nextJobs) => {
      setJobs(nextJobs);
      if (nextJobs.some((job) => job.status === 'completed')) {
        load();
      }
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handlePlay = (item: DownloadItem) => {
    (navigation as any).navigate('MediaPlayer', {
      source: {
        type: item.kind,
        uri: item.uri,
        title: item.name,
      },
    });
  };

  const handleDelete = async (item: DownloadItem) => {
    Alert.alert('Delete download', `Remove ${item.name} from the app?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDownload(item.path);
            await load();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete file');
          }
        },
      },
    ]);
  };

  const galleryLabel = Platform.OS === 'ios' ? 'Also saved to Photos' : 'Also saved to Gallery';

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
        <Text style={[styles.name, { color: themeColors.text.primary }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.meta, { color: themeColors.text.secondary }]}>
          {humanSize(item.size)} · {item.kind === 'audio' ? 'Audio' : 'Video'}
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
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
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          activeJobs.length > 0 ? (
            <View style={{ marginBottom: 12 }}>
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
          ) : null
        }
        ListEmptyComponent={
          activeJobs.length > 0 ? null : (
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
});

export default DownloadsScreen;
