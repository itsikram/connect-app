import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import api from '../lib/api';
import UserPP from './UserPP';
import {
  CHAT_THEMES,
  QUICK_REACTION_PRESETS,
} from '../utils/chatThemes';
import useFriendChatSettings from '../hooks/useFriendChatSettings';

interface Props {
  isOpen: boolean;
  onRequestClose: () => void;
  friendId?: string | null;
  friendProfile?: any;
}

const ChatSettingsModal = ({
  isOpen,
  onRequestClose,
  friendId,
  friendProfile,
}: Props) => {
  const {
    settings,
    theme,
    wallpaper,
    updateSettings,
    resetSettings,
  } = useFriendChatSettings(friendId);
  const [isUploading, setIsUploading] = useState(false);

  const friendName =
    friendProfile?.fullName ||
    `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`.trim() ||
    'this chat';

  const handleThemeSelect = useCallback(
    (themeId: string) => {
      const next: any = { themeId };
      if (settings.wallpaperSource !== 'custom') {
        next.wallpaperSource = 'theme';
      }
      if (themeId === 'love' && (!settings.actionEmoji || settings.actionEmoji === '👍')) {
        next.actionEmoji = '❤️';
      }
      updateSettings(next);
    },
    [updateSettings, settings.wallpaperSource, settings.actionEmoji],
  );

  const handleUploadBackground = useCallback(async () => {
    try {
      const result: any = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        selectionLimit: 1,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Too large', 'Image must be less than 5MB');
        return;
      }

      setIsUploading(true);
      const formData: any = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'wallpaper.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as any);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.secure_url || res.data?.url;
      if (res.status === 200 && url) {
        await updateSettings({
          wallpaperSource: 'custom',
          customBackground: url,
        });
      } else {
        Alert.alert('Upload failed', 'Could not upload wallpaper');
      }
    } catch (error) {
      console.error('Chat wallpaper upload failed:', error);
      Alert.alert('Upload failed', 'Failed to upload wallpaper');
    } finally {
      setIsUploading(false);
    }
  }, [updateSettings]);

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onRequestClose}
    >
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Chat appearance</Text>
              <Text style={styles.subtitle}>Customize this conversation with {friendName}</Text>
            </View>
            <TouchableOpacity onPress={onRequestClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={styles.friendRow}>
              <UserPP
                image={friendProfile?.profilePic}
                isActive={friendProfile?.isActive}
                size={42}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.friendName}>{friendName}</Text>
                <Text style={styles.muted}>Settings apply only to this chat</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>THEME · {theme.name}</Text>
            <View style={styles.themeGrid}>
              {CHAT_THEMES.map((item) => {
                const selected = item.id === settings.themeId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.themeCard,
                      item.couple && styles.themeCardWide,
                      selected && { borderColor: item.colors.accent },
                    ]}
                    onPress={() => handleThemeSelect(item.id)}
                  >
                    <LinearGradient
                      colors={item.colors.wallpaper as [string, string, ...string[]]}
                      style={styles.themePreview}
                    >
                      {item.couple ? (
                        <View style={styles.coupleBadge}>
                          <Text style={styles.coupleBadgeTxt}>Couples</Text>
                        </View>
                      ) : null}
                      <View style={[styles.bubble, { width: '54%', backgroundColor: item.preview.recv }]} />
                      <View
                        style={[
                          styles.bubble,
                          { width: '46%', alignSelf: 'flex-end', backgroundColor: item.preview.sent },
                        ]}
                      />
                    </LinearGradient>
                    <Text style={styles.themeName}>{item.name}</Text>
                    <Text style={styles.themeDesc}>{item.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {theme.loveRain ? (
              <Text style={styles.loveHint}>
                Send ❤️ 🥰 😘 or words like “love you”, “miss you”, “jaan”, or
                “ভালোবাসি” and a shower of ❤️ 🥰 😘 💋 💕 😍 🫶 🌹 falls for both of you.
              </Text>
            ) : null}

            <Text style={styles.sectionLabel}>WALLPAPER</Text>
            <View style={styles.wallpaperPreview}>
              {wallpaper.type === 'image' ? (
                <LinearGradient colors={['#0a0a0b', '#0a0a0b']} style={StyleSheet.absoluteFill} />
              ) : (
                <LinearGradient
                  colors={wallpaper.value as [string, string, ...string[]]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {settings.showBackgroundOverlay ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]} />
              ) : null}
              <View style={styles.previewBubbles}>
                <View style={[styles.bubble, { width: 90, backgroundColor: 'rgba(255,255,255,0.22)' }]} />
                <View
                  style={[
                    styles.bubble,
                    { width: 76, alignSelf: 'flex-end', backgroundColor: theme.colors.accent },
                  ]}
                />
              </View>
            </View>
            <View style={styles.radioRow}>
              {(['theme', 'global', 'custom'] as const).map((source) => (
                <TouchableOpacity
                  key={source}
                  style={[
                    styles.radio,
                    settings.wallpaperSource === source && {
                      borderColor: theme.colors.accent,
                      backgroundColor: `${theme.colors.accent}22`,
                    },
                  ]}
                  onPress={() => updateSettings({ wallpaperSource: source })}
                >
                  <Text style={styles.radioTxt}>
                    {source === 'theme'
                      ? 'Theme default'
                      : source === 'global'
                        ? 'Account wallpaper'
                        : 'Custom photo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btn}
                onPress={handleUploadBackground}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnTxt}>Upload photo</Text>
                )}
              </TouchableOpacity>
              {settings.customBackground ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() =>
                    updateSettings({ wallpaperSource: 'theme', customBackground: null })
                  }
                >
                  <Text style={styles.btnTxt}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.toggleTitle}>Background overlay</Text>
                <Text style={styles.muted}>Dim the wallpaper so messages stay readable</Text>
              </View>
              <Switch
                value={settings.showBackgroundOverlay !== false}
                onValueChange={(value) =>
                  updateSettings({ showBackgroundOverlay: value })
                }
                trackColor={{ false: '#3a3b3c', true: theme.colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.sectionLabel}>QUICK REACTION</Text>
            <Text style={styles.muted}>Tap the composer button to send this instantly</Text>
            <View style={styles.emojiRow}>
              {QUICK_REACTION_PRESETS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    settings.actionEmoji === emoji && {
                      borderColor: theme.colors.accent,
                      backgroundColor: `${theme.colors.accent}22`,
                    },
                  ]}
                  onPress={() => updateSettings({ actionEmoji: emoji })}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnGhost, { marginTop: 18 }]}
              onPress={() => {
                resetSettings();
                Alert.alert('Reset', 'Chat appearance reset');
              }}
            >
              <Text style={styles.btnTxt}>Reset to default</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#161718',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#9aa0a6', fontSize: 13, marginTop: 4 },
  closeBtn: { paddingVertical: 6, paddingLeft: 12 },
  closeTxt: { color: '#00d4ff', fontWeight: '700' },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 16,
  },
  friendName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  muted: { color: '#8b9198', fontSize: 12, marginTop: 2 },
  sectionLabel: {
    color: '#c5c9ce',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  themeCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  themeCardWide: { width: '100%' },
  themePreview: {
    height: 76,
    borderRadius: 10,
    padding: 10,
    justifyContent: 'flex-end',
    gap: 6,
  },
  coupleBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(251,113,133,0.92)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  coupleBadgeTxt: { color: '#3f0712', fontSize: 10, fontWeight: '700' },
  bubble: { height: 10, borderRadius: 999 },
  themeName: { color: '#fff', fontWeight: '600', marginTop: 8, fontSize: 13 },
  themeDesc: { color: '#8b9198', fontSize: 11, marginTop: 2 },
  loveHint: {
    marginTop: 8,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(251,113,133,0.1)',
    color: '#fecdd3',
    fontSize: 13,
    lineHeight: 18,
  },
  wallpaperPreview: {
    height: 110,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  previewBubbles: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
    gap: 8,
  },
  radioRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  radio: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  radioTxt: { color: '#e8eaed', fontSize: 11, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  btn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  btnTxt: { color: '#e8eaed', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  toggleTitle: { color: '#fff', fontWeight: '600' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatSettingsModal;
