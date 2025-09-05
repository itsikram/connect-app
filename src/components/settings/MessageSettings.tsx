import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '../../contexts/ToastContext';

interface MessageSettings {
  showTyping: boolean;
  isShareEmotion: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  messagePreview: boolean;
  autoSaveDrafts: boolean;
  chatBackground: string | null;
}

type BooleanSettingKey = Exclude<keyof MessageSettings, 'chatBackground'>;

const MessageSettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings, loading } = useSettings();
  const CHAT_BG_STORAGE_KEY = '@chat_background_image';
  const { showSuccess, showError } = useToast();
  
  const defaultBackgrounds: { id: string; uri: string }[] = [
    {
      id: 'bg-1',
      uri: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'bg-2',
      uri: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'bg-3',
      uri: 'https://images.unsplash.com/photo-1476231682828-37e571bc172f?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'bg-4',
      uri: 'https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'bg-5',
      uri: 'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'bg-6',
      uri: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=60',
    },
  ];
  
  const [messageSettings, setMessageSettings] = useState<MessageSettings>({
    showTyping: settings.showTyping ?? true,
    isShareEmotion: settings.isShareEmotion ?? false,
    readReceipts: settings.readReceipts ?? true,
    typingIndicators: settings.typingIndicators ?? true,
    messagePreview: settings.messagePreview ?? true,
    autoSaveDrafts: settings.autoSaveDrafts ?? true,
    chatBackground: settings.chatBackground ?? null,
  });

  useEffect(() => {
    setMessageSettings({
      showTyping: settings.showTyping ?? true,
      isShareEmotion: settings.isShareEmotion ?? false,
      readReceipts: settings.readReceipts ?? true,
      typingIndicators: settings.typingIndicators ?? true,
      messagePreview: settings.messagePreview ?? true,
      autoSaveDrafts: settings.autoSaveDrafts ?? true,
      chatBackground: settings.chatBackground ?? null,
    });
  }, [settings]);

  const handleToggle = (key: BooleanSettingKey) => {
    setMessageSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    console.log('Message settings:', messageSettings);
    try {
      // Save to settings context (which handles server sync)
      const success = await updateSettings(messageSettings);
      
      // Also save chat background to AsyncStorage for immediate access
      if (messageSettings.chatBackground) {
        await AsyncStorage.setItem(CHAT_BG_STORAGE_KEY, messageSettings.chatBackground);
      } else {
        await AsyncStorage.removeItem(CHAT_BG_STORAGE_KEY);
      }
      
      if (success) {
        showSuccess('Messaging settings saved');
      } else {
        showError('Failed to save settings');
      }
    } catch (e) {
      console.log('Failed to save settings:', e);
      showError('Failed to save settings');
    }
  };

  const renderSwitchSetting = (
    key: BooleanSettingKey,
    label: string,
    description: string
  ) => (
    <View style={[styles.switchItem, { borderBottomColor: themeColors.border.primary }]}>
      <View style={styles.switchContent}>
        <Text style={[styles.switchLabel, { color: themeColors.text.primary }]}>
          {label}
        </Text>
        <Text style={[styles.switchDescription, { color: themeColors.text.secondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={messageSettings[key]}
        onValueChange={() => handleToggle(key)}
        trackColor={{ false: themeColors.gray[300], true: themeColors.primary }}
        thumbColor={messageSettings[key] ? themeColors.text.inverse : themeColors.gray[400]}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Messaging Settings
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Customize your messaging experience and privacy
        </Text>
      </View>

      {/* Privacy & Visibility */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Privacy & Visibility
        </Text>
        
        {renderSwitchSetting(
          'showTyping',
          'Show Typing Indicator',
          'Let others see when you are typing a message'
        )}
        
        {renderSwitchSetting(
          'readReceipts',
          'Read Receipts',
          'Show when your messages have been read by others'
        )}
        
        {renderSwitchSetting(
          'messagePreview',
          'Message Preview',
          'Show message previews in notifications and chat list'
        )}
      </View>

      {/* Advanced Features */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Advanced Features
        </Text>
        
        {renderSwitchSetting(
          'isShareEmotion',
          'Share Face Mode',
          'Access camera to recognize your mood by scanning your face'
        )}
        
        {renderSwitchSetting(
          'typingIndicators',
          'Typing Indicators',
          'Show typing indicators for incoming messages'
        )}
        
        {renderSwitchSetting(
          'autoSaveDrafts',
          'Auto-save Drafts',
          'Automatically save message drafts as you type'
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.infoContainer}>
        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Typing Indicators
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            When enabled, your friends will see "typing..." when you're composing a message. 
            This helps them know you're actively responding.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Face Mode Sharing
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            This feature uses your camera to analyze facial expressions and share your mood 
            with friends. Camera access is required and can be revoked in device settings.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Read Receipts
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            Read receipts show when your messages have been seen by the recipient. 
            This works both ways - you'll also see when others have read your messages.
          </Text>
        </View>
      </View>

      {/* Chat Background */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Chat Background</Text>
        <Text style={[styles.switchDescription, { color: themeColors.text.secondary, marginBottom: 12 }]}>
          Choose a background for your chat screen
        </Text>
        <View style={styles.backgroundGrid}>
          {defaultBackgrounds.map(bg => {
            const isSelected = messageSettings.chatBackground === bg.uri;
            return (
              <TouchableOpacity
                key={bg.id}
                activeOpacity={0.8}
                onPress={() => setMessageSettings(prev => ({ ...prev, chatBackground: bg.uri }))}
                style={[styles.backgroundItem, { borderColor: isSelected ? themeColors.primary : themeColors.border.primary }]}
              >
                <Image source={{ uri: bg.uri }} style={styles.backgroundThumb} />
              </TouchableOpacity>
            );
          })}
        </View>
        {messageSettings.chatBackground && (
          <TouchableOpacity
            onPress={() => setMessageSettings(prev => ({ ...prev, chatBackground: null }))}
            style={[styles.clearButton, { borderColor: themeColors.border.primary }]}
          >
            <Text style={{ color: themeColors.text.primary }}>Remove background</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.primary }]} onPress={handleSave}>
        <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Save Message Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  infoContainer: {
    gap: 16,
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  backgroundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  backgroundItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
  },
  backgroundThumb: {
    width: '100%',
    height: '100%',
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default MessageSettings;
