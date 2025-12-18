import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';

interface PrivacySettings {
  postVisibility: string;
  friendRequestVisibility: string;
  timelinePostVisibility: string;
  isShareLocation?: boolean;
}

const PrivacySettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    postVisibility: settings.postVisibility ?? 'public',
    friendRequestVisibility: settings.friendRequestVisibility ?? 'public',
    timelinePostVisibility: settings.timelinePostVisibility ?? 'public',
    isShareLocation: settings.isShareLocation ?? true,
  });

  React.useEffect(() => {
    setPrivacySettings({
      postVisibility: settings.postVisibility ?? 'public',
      friendRequestVisibility: settings.friendRequestVisibility ?? 'public',
      timelinePostVisibility: settings.timelinePostVisibility ?? 'public',
      isShareLocation: settings.isShareLocation ?? true,
    });
  }, [settings]);

  const visibilityOptions = [
    { label: 'Only Me', value: 'only-me' },
    { label: 'Friends of Friends', value: 'fof' },
    { label: 'Public', value: 'public' },
  ];

  const handleSave = async () => {
    console.log('Privacy settings:', privacySettings);
    try {
      const success = await updateSettings(privacySettings);
      if (success) {
        showSuccess('Privacy settings saved');
      } else {
        showError('Failed to save privacy settings');
      }
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      showError('Failed to save privacy settings');
    }
  };

  const handleLocationSharingToggle = async (value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, isShareLocation: value }));
    // Auto-save location sharing setting
    try {
      await updateSettings({ isShareLocation: value });
    } catch (error) {
      console.error('Error updating location sharing setting:', error);
    }
  };

  const renderPicker = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    description?: string
  ) => (
    <View style={styles.settingItem}>
      <Text style={[styles.settingLabel, { color: themeColors.text.primary }]}>
        {label}
      </Text>
      <View style={[styles.pickerContainer, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={[styles.picker, { color: themeColors.text.primary }]}
          dropdownIconColor={themeColors.text.primary}
        >
          {visibilityOptions.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
              color={themeColors.text.primary}
            />
          ))}
        </Picker>
      </View>
      {description && (
        <Text style={[styles.description, { color: themeColors.text.secondary }]}>
          {description}
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Privacy Settings
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Control who can see your content and interact with you
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Content Visibility
        </Text>
        
        {renderPicker(
          'Who can see your posts?',
          privacySettings.postVisibility,
          (value) => setPrivacySettings(prev => ({ ...prev, postVisibility: value })),
          'Choose who can see the posts you create'
        )}
        
        {renderPicker(
          'Who can send you friend requests?',
          privacySettings.friendRequestVisibility,
          (value) => setPrivacySettings(prev => ({ ...prev, friendRequestVisibility: value })),
          'Control who can send you friend requests'
        )}
        
        {renderPicker(
          'Who can post on your timeline?',
          privacySettings.timelinePostVisibility,
          (value) => setPrivacySettings(prev => ({ ...prev, timelinePostVisibility: value })),
          'Manage who can post content on your timeline'
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Location Sharing
        </Text>
        
        <View style={[styles.settingItem, { backgroundColor: themeColors.surface.secondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: themeColors.border.primary }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[styles.settingLabel, { color: themeColors.text.primary }]}>
                Share Location with Friends
              </Text>
              <Text style={[styles.description, { color: themeColors.text.secondary, marginTop: 4 }]}>
                Allow friends to see your real-time location in the info modal
              </Text>
            </View>
            <Switch
              value={privacySettings.isShareLocation ?? true}
              onValueChange={handleLocationSharingToggle}
              trackColor={{ false: themeColors.gray[300], true: themeColors.primary + '80' }}
              thumbColor={privacySettings.isShareLocation ? themeColors.primary : themeColors.gray[400]}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Additional Privacy Options
        </Text>
        
        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Profile Privacy
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            Your profile information visibility is controlled by your general privacy settings. 
            You can customize specific fields in the Profile tab.
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.primary }]} onPress={handleSave}>
        <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Save Privacy Settings</Text>
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
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  description: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
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
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PrivacySettings;
