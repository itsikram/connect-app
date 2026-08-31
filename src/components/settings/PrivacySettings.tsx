import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import {
  SettingsSectionHeader,
  SettingsField,
  SettingsPicker,
  SettingsSwitchRow,
  SettingsPrimaryButton,
} from './settingsUi';

const VISIBILITY_OPTIONS = [
  { label: 'Only Me', value: 'om' },
  { label: 'Friend of Friends', value: 'fof' },
  { label: 'Public', value: 'public' },
];

const normalizeVisibility = (value?: string) => {
  if (value === 'only-me' || value === 'om') return 'om';
  if (value === 'friends' || value === 'fof') return 'fof';
  return value || 'public';
};

const PrivacySettings = () => {
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const [privacySettings, setPrivacySettings] = useState({
    postVisibility: normalizeVisibility(settings.postVisibility),
    friendRequestVisibility: normalizeVisibility(settings.friendRequestVisibility),
    timelinePostVisibility: normalizeVisibility(settings.timelinePostVisibility),
    isShareLocation: settings.isShareLocation ?? true,
  });

  React.useEffect(() => {
    setPrivacySettings({
      postVisibility: normalizeVisibility(settings.postVisibility),
      friendRequestVisibility: normalizeVisibility(settings.friendRequestVisibility),
      timelinePostVisibility: normalizeVisibility(settings.timelinePostVisibility),
      isShareLocation: settings.isShareLocation ?? true,
    });
  }, [settings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const success = await updateSettings(privacySettings);
      if (success) {
        showSuccess('Privacy settings saved successfully!');
      } else {
        showError('Failed to save privacy settings');
      }
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      showError('Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationSharingToggle = async (value: boolean) => {
    setPrivacySettings((prev) => ({ ...prev, isShareLocation: value }));
    try {
      await updateSettings({ isShareLocation: value });
    } catch (error) {
      console.error('Error updating location sharing setting:', error);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Privacy Settings"
        description="Control who can see your posts, timeline, and location."
      />

      <SettingsField label="Who Can See your Posts?">
        <SettingsPicker
          value={privacySettings.postVisibility}
          onValueChange={(value) => setPrivacySettings((prev) => ({ ...prev, postVisibility: value }))}
          options={VISIBILITY_OPTIONS}
        />
      </SettingsField>

      <SettingsField label="Who Can Send you Friend Request?">
        <SettingsPicker
          value={privacySettings.friendRequestVisibility}
          onValueChange={(value) => setPrivacySettings((prev) => ({ ...prev, friendRequestVisibility: value }))}
          options={VISIBILITY_OPTIONS}
        />
      </SettingsField>

      <SettingsField label="Who Can Post on your Timeline?">
        <SettingsPicker
          value={privacySettings.timelinePostVisibility}
          onValueChange={(value) => setPrivacySettings((prev) => ({ ...prev, timelinePostVisibility: value }))}
          options={VISIBILITY_OPTIONS}
        />
      </SettingsField>

      <SettingsSwitchRow
        label="Share Location with Friends"
        help="Allow friends to see your real-time location in the info modal"
        value={privacySettings.isShareLocation ?? true}
        onValueChange={handleLocationSharingToggle}
      />

      <SettingsPrimaryButton title="Save Settings" onPress={handleSave} loading={saving} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
});

export default PrivacySettings;
