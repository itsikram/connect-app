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

interface SoundSettings {
  ringtone: string;
  notificationSound: string;
  messageSound: string;
  vibrationEnabled: boolean;
  silentMode: boolean;
  volumeLevel: number;
}

const SoundSettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    ringtone: settings.ringtone ?? '1',
    notificationSound: settings.notificationSound ?? '1',
    messageSound: settings.messageSound ?? '1',
    vibrationEnabled: settings.vibrationEnabled ?? true,
    silentMode: settings.silentMode ?? false,
    volumeLevel: settings.volumeLevel ?? 80,
  });

  React.useEffect(() => {
    setSoundSettings({
      ringtone: settings.ringtone ?? '1',
      notificationSound: settings.notificationSound ?? '1',
      messageSound: settings.messageSound ?? '1',
      vibrationEnabled: settings.vibrationEnabled ?? true,
      silentMode: settings.silentMode ?? false,
      volumeLevel: settings.volumeLevel ?? 80,
    });
  }, [settings]);

  const ringtones = [
    { id: '1', name: 'Default Ringtone' },
    { id: '2', name: 'Classic Bell' },
    { id: '3', name: 'Digital Chime' },
    { id: '4', name: 'Gentle Melody' },
    { id: '5', name: 'Upbeat Tune' },
    { id: '6', name: 'Nature Sounds' },
    { id: '7', name: 'Electronic Beep' },
    { id: '8', name: 'Soft Piano' },
  ];

  const notificationSounds = [
    { id: '1', name: 'Default Notification' },
    { id: '2', name: 'Gentle Ping' },
    { id: '3', name: 'Soft Chime' },
    { id: '4', name: 'Quick Beep' },
  ];

  const messageSounds = [
    { id: '1', name: 'Default Message' },
    { id: '2', name: 'Soft Pop' },
    { id: '3', name: 'Gentle Ding' },
    { id: '4', name: 'Quick Alert' },
  ];

  const handleSave = async () => {
    console.log('Sound settings:', soundSettings);
    try {
      const success = await updateSettings(soundSettings);
      if (success) {
        showSuccess('Sound settings saved');
      } else {
        showError('Failed to save sound settings');
      }
    } catch (error) {
      console.error('Error saving sound settings:', error);
      showError('Failed to save sound settings');
    }
  };

  const renderPicker = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options: Array<{ id: string; name: string }>,
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
          {options.map((option) => (
            <Picker.Item
              key={option.id}
              label={option.name}
              value={option.id}
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

  const renderSwitchSetting = (
    key: keyof SoundSettings,
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
        value={soundSettings[key] as boolean}
        onValueChange={() => setSoundSettings(prev => ({ ...prev, [key]: !prev[key] }))}
        trackColor={{ false: themeColors.gray[300], true: themeColors.primary }}
        thumbColor={(soundSettings[key] as boolean) ? themeColors.text.inverse : themeColors.gray[400]}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Sound Settings
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Customize your audio experience and notifications
        </Text>
      </View>

     
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Call Sounds
        </Text>
        
        {renderPicker(
          'Calling Ringtones',
          soundSettings.ringtone,
          (value) => setSoundSettings(prev => ({ ...prev, ringtone: value })),
          ringtones,
          'Choose the sound that plays when you receive calls'
        )}
      </View>

     
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Notification Sounds
        </Text>
        
        {renderPicker(
          'Notification Sound',
          soundSettings.notificationSound,
          (value) => setSoundSettings(prev => ({ ...prev, notificationSound: value })),
          notificationSounds,
          'Sound played for general notifications'
        )}
        
        {renderPicker(
          'Message Sound',
          soundSettings.messageSound,
          (value) => setSoundSettings(prev => ({ ...prev, messageSound: value })),
          messageSounds,
          'Sound played when receiving messages'
        )}
      </View>

     
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Sound Controls
        </Text>
        
        {renderSwitchSetting(
          'vibrationEnabled',
          'Vibration',
          'Enable vibration for calls and notifications'
        )}
        
        {renderSwitchSetting(
          'silentMode',
          'Silent Mode',
          'Mute all sounds (notifications and calls)'
        )}
      </View>

     
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Volume Control
        </Text>
        
        <View style={styles.volumeContainer}>
          <Text style={[styles.volumeLabel, { color: themeColors.text.primary }]}>
            Notification Volume
          </Text>
          <View style={[styles.volumeBar, { backgroundColor: themeColors.gray[300] }]}>
            <View 
              style={[
                styles.volumeFill, 
                { 
                  width: `${soundSettings.volumeLevel}%`,
                  backgroundColor: themeColors.primary 
                }
              ]} 
            />
          </View>
          <Text style={[styles.volumeText, { color: themeColors.text.secondary }]}>
            {soundSettings.volumeLevel}%
          </Text>
        </View>
      </View>

     
      <View style={styles.infoContainer}>
        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Sound Tips
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            • Ringtones play during incoming calls{'\n'}
            • Notification sounds play for alerts{'\n'}
            • Message sounds play for new messages{'\n'}
            • Vibration works alongside sounds{'\n'}
            • Silent mode overrides all sounds
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
          <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
            Device Integration
          </Text>
          <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
            Sound settings integrate with your device's volume controls. 
            Make sure your device is not on silent mode to hear sounds properly.
          </Text>
        </View>
      </View>

     
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: themeColors.primary }]} onPress={handleSave}>
        <Text style={[styles.saveButtonText, { color: themeColors.text.inverse }]}>Save Sound Settings</Text>
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
  volumeContainer: {
    marginBottom: 16,
  },
  volumeLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  volumeBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    borderRadius: 4,
  },
  volumeText: {
    fontSize: 14,
    textAlign: 'center',
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

export default SoundSettings;
