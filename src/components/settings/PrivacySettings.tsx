import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors } from '../../theme/colors';

interface PrivacySettings {
  postVisibility: string;
  friendRequestVisibility: string;
  timelinePostVisibility: string;
}

const PrivacySettings = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    postVisibility: 'public',
    friendRequestVisibility: 'public',
    timelinePostVisibility: 'public',
  });

  const visibilityOptions = [
    { label: 'Only Me', value: 'only-me' },
    { label: 'Friends of Friends', value: 'fof' },
    { label: 'Public', value: 'public' },
  ];

  const handleSave = () => {
    // Here you would typically make an API call to save the privacy settings
    console.log('Privacy settings:', privacySettings);
  };

  const renderPicker = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    description?: string
  ) => (
    <View style={styles.settingItem}>
      <Text style={[styles.settingLabel, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
        {label}
      </Text>
      <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={[styles.picker, { color: isDarkMode ? colors.text.light : colors.text.primary }]}
          dropdownIconColor={isDarkMode ? colors.text.light : colors.text.primary}
        >
          {visibilityOptions.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
              color={isDarkMode ? colors.text.light : colors.text.primary}
            />
          ))}
        </Picker>
      </View>
      {description && (
        <Text style={[styles.description, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          {description}
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Privacy Settings
        </Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          Control who can see your content and interact with you
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
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
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Additional Privacy Options
        </Text>
        
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
          <Text style={[styles.infoTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
            Profile Privacy
          </Text>
          <Text style={[styles.infoText, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
            Your profile information visibility is controlled by your general privacy settings. 
            You can customize specific fields in the Profile tab.
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Privacy Settings</Text>
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
    borderColor: '#E5E5EA',
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
    borderColor: '#E5E5EA',
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
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PrivacySettings;
