import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { deleteMedia, MediaItem } from '../lib/mediaLibrary';

const GalleryPreview = ({ route, navigation }: any) => {
  const item: MediaItem = route.params.item;

  const onDelete = async () => {
    await deleteMedia(item.path);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{item.name}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={onDelete}>
          <Icon name="delete" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.viewer}>
        {item.type === 'image' ? (
          <Image source={{ uri: `file://${item.path}` }} style={styles.media} resizeMode="contain" />
        ) : (
          <Video 
            source={{ uri: `file://${item.path}` }} 
            style={styles.media} 
            useNativeControls={true}
            resizeMode={ResizeMode.CONTAIN} 
          />
        )}
      </View>
    </View>
  );
};

export default GalleryPreview;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 16 : 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '100%' },
});
