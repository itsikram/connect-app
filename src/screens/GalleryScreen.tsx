import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, Alert, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { deleteMedia, listMedia, MediaItem } from '../lib/mediaLibrary';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 8 * 4) / 3;

const GalleryScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listMedia();
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const openItem = useCallback((item: MediaItem) => {
    navigation.navigate('GalleryPreview', { item });
  }, [navigation]);

  const removeItem = useCallback((item: MediaItem) => {
    Alert.alert('Delete', 'Remove this media?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteMedia(item.path);
        load();
      }},
    ]);
  }, [load]);

  const renderItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity style={styles.item} onPress={() => openItem(item)}>
      {item.type === 'image' ? (
        <Image source={{ uri: `file://${item.path}` }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={styles.thumb}>
          <Video source={{ uri: `file://${item.path}` }} style={styles.thumb} muted resizeMode="cover" repeat />
          <View style={styles.playBadge}><Icon name="play-arrow" size={18} color="#fff" /></View>
        </View>
      )}
      <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(item)}>
        <Icon name="delete" size={18} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Gallery</Text>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.path}
        numColumns={3}
        contentContainerStyle={{ padding: 8 }}
        columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={load}
        ListEmptyComponent={<Text style={styles.empty}>No media yet</Text>}
      />
    </View>
  );
};

export default GalleryScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 16 : 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  item: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  thumb: { width: '100%', height: '100%' },
  playBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 },
  deleteBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
  empty: { color: '#aaa', textAlign: 'center', marginTop: 40 },
});
