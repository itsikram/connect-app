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
import { useTheme } from '../../contexts/ThemeContext';
import { themes, ThemeType } from '../../theme/colors';
import { useToast } from '../../contexts/ToastContext';

interface PreferenceSettings {
  themeMode: ThemeType;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

const PreferenceSettings = () => {
  const { currentTheme, setTheme, colors: themeColors } = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { showSuccess } = useToast();
  
  const [preferences, setPreferences] = useState<PreferenceSettings>({
    themeMode: currentTheme,
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  });

  const themeOptions = [
    { label: 'Default (System)', value: 'default' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Blue', value: 'blue' },
    { label: 'Green', value: 'green' },
    { label: 'Purple', value: 'purple' },
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

  const handleThemeChange = (theme: ThemeType) => {
    setPreferences(prev => ({ ...prev, themeMode: theme }));
    setTheme(theme);
  };

  const handleSave = () => {
    // Here you would typically make an API call to save the preference settings
    console.log('Preference settings:', preferences);
    showSuccess('Preference settings saved');
  };

  const renderPicker = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options: Array<{ label: string; value: string }>,
    description?: string
  ) => (
    <View style={styles.settingItem}>
      <Text style={[styles.settingLabel, { color: themeColors.text.primary }]}>
        {label}
      </Text>
      <View style={[styles.pickerContainer, { backgroundColor: themeColors.surface.secondary }]}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={[styles.picker, { color: themeColors.text.primary }]}
          dropdownIconColor={themeColors.text.primary}
        >
          {options.map((option) => (
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
        <Text style={[styles.description, { color: themeColors.text.tertiary }]}>
          {description}
        </Text>
      )}
    </View>
  );

  const renderThemePreview = () => (
    <View style={styles.themePreviewSection}>
      <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
        Theme Preview
      </Text>
      <View style={styles.themePreviewContainer}>
        {themeOptions.map((themeOption) => (
          <TouchableOpacity
            key={themeOption.value}
            style={[
              styles.themePreviewCard,
              { 
                backgroundColor: themes[themeOption.value as ThemeType]?.surface.primary || themeColors.surface.primary,
                borderColor: preferences.themeMode === themeOption.value ? themeColors.primary : themeColors.border.primary,
                borderWidth: preferences.themeMode === themeOption.value ? 2 : 1,
              }
            ]}
            onPress={() => handleThemeChange(themeOption.value as ThemeType)}
          >
            <View style={[
              styles.themePreviewHeader,
              { backgroundColor: themes[themeOption.value as ThemeType]?.primary || themeColors.primary }
            ]}>
              <Text style={[styles.themePreviewTitle, { color: themeColors.text.inverse }]}>
                {themeOption.label}
              </Text>
            </View>
            <View style={styles.themePreviewContent}>
              <View style={[
                styles.themePreviewButton,
                { backgroundColor: themes[themeOption.value as ThemeType]?.primary || themeColors.primary }
              ]}>
                <Text style={[styles.themePreviewButtonText, { color: themeColors.text.inverse }]}>
                  Button
                </Text>
              </View>
              <Text style={[
                styles.themePreviewText,
                { color: themes[themeOption.value as ThemeType]?.text.primary || themeColors.text.primary }
              ]}>
                Sample text
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Preference Settings
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Customize your app experience and appearance
        </Text>
      </View>

      {/* Theme Preview */}
      {renderThemePreview()}

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Appearance
        </Text>
        
        {renderPicker(
          'Theme Mode',
          preferences.themeMode,
          (value) => handleThemeChange(value as ThemeType),
          themeOptions,
          'Choose your preferred theme. Default follows your system settings.'
        )}
      </View>

      {/* Language & Region */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
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
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
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
        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Theme Information
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            • Default: Follows your device's system theme{'\n'}
            • Light: Clean, bright interface{'\n'}
            • Dark: Easy on the eyes in low light{'\n'}
            • Blue: Calming blue color scheme{'\n'}
            • Green: Natural, eco-friendly theme{'\n'}
            • Purple: Creative, artistic theme{'\n'}
            • Changes take effect immediately
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Language & Region
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            • Language changes affect the entire app{'\n'}
            • Timezone affects post timestamps and scheduling{'\n'}
            • Some features may require app restart{'\n'}
            • Date/time formats are applied globally
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.primary }]} onPress={handleSave}>
        <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Save Preferences</Text>
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
    fontSize: 18,
    fontWeight: '600',
  },
  themePreviewSection: {
    marginBottom: 24,
  },
  themePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  themePreviewCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  themePreviewHeader: {
    padding: 12,
    alignItems: 'center',
  },
  themePreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  themePreviewContent: {
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  themePreviewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  themePreviewButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themePreviewText: {
    fontSize: 12,
  },
});

export default PreferenceSettings;
