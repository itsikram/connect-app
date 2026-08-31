import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { SettingsSectionHeader, SettingsPrimaryButton } from './settingsUi';

const CacheSettings = () => {
  const { colors: themeColors } = useTheme();
  const { showSuccess, showError } = useToast();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      const cacheDir = (FileSystem as any).cacheDirectory;
      if (cacheDir) {
        const entries = await FileSystem.readDirectoryAsync(cacheDir);
        await Promise.all(
          entries.map((name) =>
            FileSystem.deleteAsync(`${cacheDir}${name}`, { idempotent: true })
          )
        );
      }
      showSuccess('Browser cache cleared successfully!');
    } catch (error) {
      console.error('Error clearing cache:', error);
      showError('Failed to clear cache. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Browser Cache"
        description="Clear stored data if pages look outdated or something feels stuck."
      />
      <Text style={[styles.body, { color: themeColors.text.primary }]}>
        Clear your browser cache to free up space and potentially resolve loading issues.
        This will clear cached files, session storage, and other browser data.
      </Text>
      <Text style={[styles.note, { color: themeColors.text.secondary }]}>
        Note: After clearing the cache, the page will reload automatically.
      </Text>
      <SettingsPrimaryButton
        title="Clear Browser Cache"
        loadingTitle="Clearing Cache..."
        onPress={handleClearCache}
        loading={isClearing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
});

export default CacheSettings;
