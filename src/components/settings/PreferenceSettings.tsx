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

interface PreferenceSettings {
  themeMode: string;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

const PreferenceSettings = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [preferences, setPreferences] = useState<PreferenceSettings>({
    themeMode: 'default',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  });

  const themeOptions = [
    { label: 'Default', value: 'default' },
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
  ];

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Chinese', value: 'zh' },
    { label: 'Japanese', value: 'ja' },
  ];

  const timezoneOptions = [
    { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
    { label: 'EST (Eastern Standard Time)', value: 'EST' },
    { label: 'CST (Central Standard Time)', value: 'CST' },
    { label: 'MST (Mountain Standard Time)', value: 'MST' },
    { label: 'PST (Pacific Standard Time)', value: 'PST' },
    { label: 'GMT (Greenwich Mean Time)', value: 'GMT' },
  ];

  const dateFormatOptions = [
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
    { label: 'DD Month YYYY', value: 'DD Month YYYY' },
  ];

  const timeFormatOptions = [
    { label: '12-hour (AM/PM)', value: '12h' },
    { label: '24-hour', value: '24h' },
  ];

  const handleSave = () => {
    // Here you would typically make an API call to save the preference settings
    console.log('Preference settings:', preferences);
  };

  const renderPicker = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options: Array<{ label: string; value: string }>,
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
          {options.map((option) => (
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
          Preference Settings
        </Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          Customize your app experience and appearance
        </Text>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Appearance
        </Text>
        
        {renderPicker(
          'Theme Mode',
          preferences.themeMode,
          (value) => setPreferences(prev => ({ ...prev, themeMode: value })),
          themeOptions,
          'Choose your preferred theme. Default follows your system settings.'
        )}
      </View>

      {/* Language & Region */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Language & Region
        </Text>
        
        {renderPicker(
          'Language',
          preferences.language,
          (value) => setPreferences(prev => ({ ...prev, language: value })),
          languageOptions,
          'Select your preferred language for the app interface.'
        )}
        
        {renderPicker(
          'Timezone',
          preferences.timezone,
          (value) => setPreferences(prev => ({ ...prev, timezone: value })),
          timezoneOptions,
          'Choose your timezone for accurate time display.'
        )}
      </View>

      {/* Date & Time Format */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Date & Time Format
        </Text>
        
        {renderPicker(
          'Date Format',
          preferences.dateFormat,
          (value) => setPreferences(prev => ({ ...prev, dateFormat: value })),
          dateFormatOptions,
          'Choose how dates are displayed throughout the app.'
        )}
        
        {renderPicker(
          'Time Format',
          preferences.timeFormat,
          (value) => setPreferences(prev => ({ ...prev, timeFormat: value })),
          timeFormatOptions,
          'Choose between 12-hour and 24-hour time format.'
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.infoContainer}>
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
          <Text style={[styles.infoTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
            Theme Information
          </Text>
          <Text style={[styles.infoText, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
            • Default: Follows your device's system theme{'\n'}
            • Dark: Always uses dark theme{'\n'}
            • Light: Always uses light theme{'\n'}
            • Changes take effect immediately
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
          <Text style={[styles.infoTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
            Language & Region
          </Text>
          <Text style={[styles.infoText, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
            • Language changes affect the entire app{'\n'}
            • Timezone affects post timestamps and scheduling{'\n'}
            • Some features may require app restart{'\n'}
            • Date/time formats are applied globally
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Preferences</Text>
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
  infoContainer: {
    gap: 16,
    marginBottom: 24,
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
    marginBottom: 32,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PreferenceSettings;
