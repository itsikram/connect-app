import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../lib/api';
import {
  SettingsSectionHeader,
  SettingsSwitchRow,
  SettingsSecondaryButton,
} from './settingsUi';

const CHAT_BG_STORAGE_KEY = '@chat_background_image';

const MessageSettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [showIsTyping, setShowIsTyping] = useState(settings.showIsTyping ?? settings.showTyping ?? true);
  const [isShareEmotion, setIsShareEmotion] = useState(settings.isShareEmotion ?? false);
  const [chatBackground, setChatBackground] = useState<string | null>(settings.chatBackground ?? null);

  useEffect(() => {
    setShowIsTyping(settings.showIsTyping ?? settings.showTyping ?? true);
    setIsShareEmotion(settings.isShareEmotion ?? false);
    setChatBackground(settings.chatBackground ?? null);
  }, [settings]);

  const persistToggle = async (payload: Record<string, boolean>) => {
    setIsUpdating(true);
    try {
      const success = await updateSettings(payload);
      if (success) {
        showSuccess('Message settings updated');
      } else {
        showError('Failed to update message settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showError('Failed to update message settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShowTypingChange = async (value: boolean) => {
    setShowIsTyping(value);
    await persistToggle({ showIsTyping: value });
  };

  const handleShareFaceModeChange = async (value: boolean) => {
    setIsShareEmotion(value);
    await persistToggle({ isShareEmotion: value });
  };

  const handleBackgroundChange = async () => {
    try {
      const result: any = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        selectionLimit: 1,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        showError('Image must be less than 5MB');
        return;
      }

      setIsUploadingBackground(true);
      const formData: any = new FormData();
      formData.append('chatBackground', {
        uri: asset.uri,
        name: asset.fileName || 'chat-background.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as any);

      const updateSetting = await api.post('setting/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (updateSetting.status === 200) {
        const nextBackground = updateSetting.data?.chatBackground || asset.uri;
        setChatBackground(nextBackground);
        await updateSettings({ chatBackground: nextBackground });
        await AsyncStorage.setItem(CHAT_BG_STORAGE_KEY, nextBackground);
        showSuccess('Chat background updated successfully');
      } else {
        showError('Unexpected response from server');
      }
    } catch (error) {
      console.error('Error uploading background:', error);
      showError('Failed to upload chat background');
    } finally {
      setIsUploadingBackground(false);
    }
  };

  const handleRemoveBackground = async () => {
    setIsUploadingBackground(true);
    try {
      const success = await updateSettings({ chatBackground: null });
      if (success) {
        setChatBackground(null);
        await AsyncStorage.removeItem(CHAT_BG_STORAGE_KEY);
        showSuccess('Chat background removed');
      } else {
        showError('Failed to remove chat background');
      }
    } catch (error) {
      console.error('Error removing background:', error);
      showError('Failed to remove chat background');
    } finally {
      setIsUploadingBackground(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Message Settings"
        description="Control messaging delivery and chat preferences."
      />

      <SettingsSwitchRow
        label="Show Typing"
        help="Show your typing indicator to friends before you send a message"
        value={showIsTyping}
        onValueChange={handleShowTypingChange}
        disabled={isUpdating}
      />
      <SettingsSwitchRow
        label="Share Face Mode"
        help="Allow Connect to use your camera to recognize your mood during calls"
        value={isShareEmotion}
        onValueChange={handleShareFaceModeChange}
        disabled={isUpdating}
      />

      <View style={styles.backgroundSection}>
        <Text style={[styles.backgroundLabel, { color: themeColors.text.primary }]}>Chat Background</Text>
        <Text style={[styles.help, { color: themeColors.text.secondary }]}>
          Upload an image to display as your chat background (Max 5MB, PNG, JPG, GIF, WebP). If you don't upload one, a default background will be used.
        </Text>
        <View style={styles.backgroundActions}>
          <SettingsSecondaryButton
            title={isUploadingBackground ? 'Uploading...' : 'Choose image'}
            onPress={handleBackgroundChange}
            disabled={isUploadingBackground}
          />
          {chatBackground ? (
            <SettingsSecondaryButton
              title="Remove & Use Default"
              onPress={handleRemoveBackground}
              disabled={isUploadingBackground}
            />
          ) : null}
        </View>
        <View style={styles.previewWrap}>
          {chatBackground ? (
            <Image source={{ uri: chatBackground }} style={[styles.preview, { borderColor: themeColors.primary }]} />
          ) : (
            <View style={[styles.preview, styles.defaultPreview, { borderColor: themeColors.border.primary, backgroundColor: '#233336' }]} />
          )}
          <Text style={[styles.help, { color: themeColors.text.secondary }]}>
            {chatBackground ? '✓ Custom background' : '📌 Default background'}
          </Text>
        </View>
        {isUploadingBackground ? (
          <Text style={[styles.help, { color: themeColors.primary }]}>Uploading...</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  backgroundSection: {
    marginTop: 8,
  },
  backgroundLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  help: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  backgroundActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  previewWrap: {
    maxWidth: 200,
  },
  preview: {
    width: 200,
    height: 150,
    borderRadius: 4,
    borderWidth: 2,
    resizeMode: 'cover',
  },
  defaultPreview: {
    backgroundColor: '#233336',
  },
});

export default MessageSettings;
