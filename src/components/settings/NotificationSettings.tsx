import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import api, { pushAPI } from '../../lib/api';
import { getOrCreateFcmToken } from '../../lib/push';
import {
  SettingsSectionHeader,
  SettingsSwitchRow,
  SettingsPrimaryButton,
  SettingsDangerButton,
} from './settingsUi';

const PUSH_TOGGLES = [
  { key: 'connectRequestReceived', label: 'Connect Request Received', help: 'Get notified when someone sends you a connect request' },
  { key: 'connectRequestAccepted', label: 'Connect Request Accepted', help: 'Get notified when someone accepts your connect request' },
  { key: 'newMessageReceived', label: 'New Message Received', help: 'Get notified when you receive a new message' },
  { key: 'newConnectPost', label: "New Connect's Post", help: 'Get notified when your connects create new posts' },
  { key: 'newConnectStory', label: "New Connect's Story", help: 'Get notified when your connects share new stories' },
  { key: 'newConnectWatch', label: "New Connect's Watch", help: 'Get notified when your connects share new watch content' },
] as const;

const EMAIL_TOGGLES = [
  { key: 'connectRequestReceivedEmail', label: 'Connect Request Received', help: 'Get email notifications for new connect requests' },
  { key: 'connectRequestAcceptedEmail', label: 'Connect Request Accepted', help: 'Get email notifications when connect requests are accepted' },
  { key: 'newMessageReceivedEmail', label: 'New Message Received', help: 'Get email notifications for new messages' },
  { key: 'newConnectPostEmail', label: "New Connect's Post", help: 'Get email notifications for new connect posts' },
  { key: 'newConnectStoryEmail', label: "New Connect's Story", help: 'Get email notifications for new connect stories' },
  { key: 'newConnectWatchEmail', label: "New Connect's Watch", help: 'Get email notifications for new connect watch content' },
] as const;

type NotificationKey = typeof PUSH_TOGGLES[number]['key'] | typeof EMAIL_TOGGLES[number]['key'];

const NotificationSettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState<Record<NotificationKey, boolean>>({
    connectRequestReceived: settings.connectRequestReceived ?? true,
    connectRequestAccepted: settings.connectRequestAccepted ?? true,
    newMessageReceived: settings.newMessageReceived ?? true,
    newConnectPost: settings.newConnectPost ?? true,
    newConnectStory: settings.newConnectStory ?? true,
    newConnectWatch: settings.newConnectWatch ?? true,
    connectRequestReceivedEmail: settings.connectRequestReceivedEmail ?? false,
    connectRequestAcceptedEmail: settings.connectRequestAcceptedEmail ?? false,
    newMessageReceivedEmail: settings.newMessageReceivedEmail ?? false,
    newConnectPostEmail: settings.newConnectPostEmail ?? false,
    newConnectStoryEmail: settings.newConnectStoryEmail ?? false,
    newConnectWatchEmail: settings.newConnectWatchEmail ?? false,
  });

  React.useEffect(() => {
    setNotificationSettings({
      connectRequestReceived: settings.connectRequestReceived ?? true,
      connectRequestAccepted: settings.connectRequestAccepted ?? true,
      newMessageReceived: settings.newMessageReceived ?? true,
      newConnectPost: settings.newConnectPost ?? true,
      newConnectStory: settings.newConnectStory ?? true,
      newConnectWatch: settings.newConnectWatch ?? true,
      connectRequestReceivedEmail: settings.connectRequestReceivedEmail ?? false,
      connectRequestAcceptedEmail: settings.connectRequestAcceptedEmail ?? false,
      newMessageReceivedEmail: settings.newMessageReceivedEmail ?? false,
      newConnectPostEmail: settings.newConnectPostEmail ?? false,
      newConnectStoryEmail: settings.newConnectStoryEmail ?? false,
      newConnectWatchEmail: settings.newConnectWatchEmail ?? false,
    });
  }, [settings]);

  const handleToggle = (key: NotificationKey) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const success = await updateSettings(notificationSettings);
      if (success) {
        showSuccess('Notification settings saved');
      } else {
        showError('Failed to save notification settings');
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      showError('Failed to save notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnregisterAllDevices = () => {
    Alert.alert(
      'Unregister devices',
      'Unregister all browsers and devices for notifications? This will unregister all other devices except the current one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unregister',
          style: 'destructive',
          onPress: async () => {
            setIsUnregistering(true);
            try {
              const currentToken = await getOrCreateFcmToken();
              const authToken = await AsyncStorage.getItem('authToken');
              await api.post('/web-notification/unregister-all-browsers');
              await pushAPI.unregisterAllOtherTokens(currentToken || '', authToken || undefined);
              showSuccess('All other devices have been unregistered for notifications.');
            } catch (error) {
              console.error('Error unregistering devices:', error);
              showError('Failed to unregister devices. Please try again.');
            } finally {
              setIsUnregistering(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SettingsSectionHeader
        title="Notification Settings"
        description="Choose which alerts you get on Connect and by email."
      />

      <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Push Notifications</Text>
      {PUSH_TOGGLES.map((item) => (
        <SettingsSwitchRow
          key={item.key}
          label={item.label}
          help={item.help}
          value={notificationSettings[item.key]}
          onValueChange={() => handleToggle(item.key)}
        />
      ))}

      <SettingsDangerButton
        title={isUnregistering ? 'Unregistering…' : 'Unregister all browsers & devices'}
        onPress={handleUnregisterAllDevices}
        loading={isUnregistering}
      />

      <View style={styles.divider} />

      <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Email Notifications</Text>
      {EMAIL_TOGGLES.map((item) => (
        <SettingsSwitchRow
          key={item.key}
          label={item.label}
          help={item.help}
          value={notificationSettings[item.key]}
          onValueChange={() => handleToggle(item.key)}
        />
      ))}

      <SettingsPrimaryButton title="Save Settings" onPress={handleSave} loading={isSaving} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,135,148,0.4)',
    marginVertical: 16,
  },
});

export default NotificationSettings;
