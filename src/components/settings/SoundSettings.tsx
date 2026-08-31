import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import {
  RINGTONE_OPTIONS,
  playRingtonePreview,
  stopRingtonePreview,
} from '../../lib/ringtoneAssets';
import {
  SettingsSectionHeader,
  SettingsField,
  SettingsPicker,
  SettingsPrimaryButton,
} from './settingsUi';

const normalizeRingtoneId = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return '1';
  return String(parsed);
};

const SoundSettings = () => {
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [ringtone, setRingtone] = useState(normalizeRingtoneId(settings.ringtone));

  useEffect(() => {
    setRingtone(normalizeRingtoneId(settings.ringtone));
  }, [settings.ringtone]);

  useEffect(() => {
    return () => {
      stopRingtonePreview().catch(() => {});
    };
  }, []);

  const handleRingtoneChange = (value: string) => {
    const next = normalizeRingtoneId(value);
    setRingtone(next);
    playRingtonePreview(next).catch(() => {});
  };

  const handleSave = async () => {
    await stopRingtonePreview();
    setIsSaving(true);
    try {
      const success = await updateSettings({ ringtone: normalizeRingtoneId(ringtone) });
      if (success) {
        showSuccess('Sound settings saved');
      } else {
        showError('Failed to save sound settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showError('Failed to save sound settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Sound Settings"
        description="Choose which sounds play for calls, messages, and alerts."
      />
      <SettingsField
        label="Calling Ringtones"
        help="Tap a ringtone to hear a short preview."
      >
        <SettingsPicker
          value={ringtone}
          onValueChange={handleRingtoneChange}
          options={RINGTONE_OPTIONS}
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

export default SoundSettings;
