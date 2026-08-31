import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, ExtendedThemeType } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import {
  SettingsSectionHeader,
  SettingsField,
  SettingsPicker,
  SettingsPrimaryButton,
} from './settingsUi';

const THEME_OPTIONS = [
  { label: 'Default', value: 'default' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
];

const toWebTheme = (mode?: string) => {
  if (mode === 'light' || mode === 'dark' || mode === 'default') return mode;
  return 'dark';
};

const PreferenceSettings = () => {
  const { currentTheme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [themeMode, setThemeMode] = useState(toWebTheme(settings.themeMode || currentTheme));

  React.useEffect(() => {
    setThemeMode(toWebTheme(settings.themeMode || currentTheme));
  }, [settings.themeMode, currentTheme]);

  const handleThemeChange = (value: string) => {
    setThemeMode(value);
    setTheme(value as ExtendedThemeType);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateSettings({ themeMode });
      if (success) {
        setTheme(themeMode as ExtendedThemeType);
        showSuccess('Preference settings saved');
      } else {
        showError('Failed to save preference settings');
      }
    } catch (error) {
      console.error('Error saving preference settings:', error);
      showError('Failed to save preference settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Preference Settings"
        description="Customize how Connect looks and feels for you."
      />
      <SettingsField label="Theme Mode">
        <SettingsPicker
          value={themeMode}
          onValueChange={handleThemeChange}
          options={THEME_OPTIONS}
          variant="list"
        />
      </SettingsField>
      <SettingsPrimaryButton title="Save Settings" onPress={handleSave} loading={isSaving} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
});

export default PreferenceSettings;
