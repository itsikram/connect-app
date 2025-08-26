import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface MessageSettings {
  showTyping: boolean;
  isShareEmotion: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  messagePreview: boolean;
  autoSaveDrafts: boolean;
}

const MessageSettings = () => {
  const { colors: themeColors } = useTheme();
  
  const [messageSettings, setMessageSettings] = useState<MessageSettings>({
    showTyping: true,
    isShareEmotion: false,
    readReceipts: true,
    typingIndicators: true,
    messagePreview: true,
    autoSaveDrafts: true,
  });

  const handleToggle = (key: keyof MessageSettings) => {
    setMessageSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    console.log('Message settings:', messageSettings);
  };

  const renderSwitchSetting = (
    key: keyof MessageSettings,
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
