import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { listDownloads, deleteDownload, DOWNLOADS_DIR } from '../lib/downloads';
import { useNavigation } from '@react-navigation/native';

const humanSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

const DownloadsScreen = () => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation();
  const [files, setFiles] = useState<Array<{ name: string; path: string; size: number; mtime?: Date }>>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const handlePlay = (item: { path: string; name: string }) => {
    try {
      (navigation as any).navigate('Menu', {
        screen: 'MediaPlayer',
        params: { source: { type: 'video', uri: `file://${item.path}`, title: item.name } },
      });
    } catch (_) {}
  };

  const handleDelete = async (item: { path: string }) => {
    try {
      await deleteDownload(item.path);
      await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete file');
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={[styles.row, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.surface.secondary }]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: themeColors.text.primary }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.meta, { color: themeColors.text.secondary }]}>
          {humanSize(item.size)}
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
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={[styles.header, { borderColor: themeColors.surface.secondary }]}> 
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Downloads</Text>
        <Text style={[styles.headerPath, { color: themeColors.text.secondary }]} numberOfLines={1}>{DOWNLOADS_DIR}</Text>
      </View>
      <FlatList
        data={files}
        keyExtractor={(item) => item.path}
        renderItem={renderItem}
        onRefresh={load}
        refreshing={refreshing}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: themeColors.text.secondary, marginTop: 40 }}>No downloads yet</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerPath: { fontSize: 10, marginTop: 4 },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: { flex: 1, paddingRight: 10 },
  name: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row' },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});

export default DownloadsScreen;


