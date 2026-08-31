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
  { key: 'friendRequestReceived', label: 'Friend Request Received', help: 'Get notified when someone sends you a friend request' },
  { key: 'friendRequestAccepted', label: 'Friend Request Accepted', help: 'Get notified when someone accepts your friend request' },
  { key: 'newMessageReceived', label: 'New Message Received', help: 'Get notified when you receive a new message' },
  { key: 'newFriendPost', label: "New Friend's Post", help: 'Get notified when your friends create new posts' },
  { key: 'newFriendStory', label: "New Friend's Story", help: 'Get notified when your friends share new stories' },
  { key: 'newFriendWatch', label: "New Friend's Watch", help: 'Get notified when your friends share new watch content' },
] as const;

const EMAIL_TOGGLES = [
  { key: 'friendRequestReceivedEmail', label: 'Friend Request Received', help: 'Get email notifications for new friend requests' },
  { key: 'friendRequestAcceptedEmail', label: 'Friend Request Accepted', help: 'Get email notifications when friend requests are accepted' },
  { key: 'newMessageReceivedEmail', label: 'New Message Received', help: 'Get email notifications for new messages' },
  { key: 'newFriendPostEmail', label: "New Friend's Post", help: 'Get email notifications for new friend posts' },
  { key: 'newFriendStoryEmail', label: "New Friend's Story", help: 'Get email notifications for new friend stories' },
  { key: 'newFriendWatchEmail', label: "New Friend's Watch", help: 'Get email notifications for new friend watch content' },
] as const;

type NotificationKey = typeof PUSH_TOGGLES[number]['key'] | typeof EMAIL_TOGGLES[number]['key'];

const NotificationSettings = () => {
  const { colors: themeColors } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { showSuccess, showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState<Record<NotificationKey, boolean>>({
    friendRequestReceived: settings.friendRequestReceived ?? true,
    friendRequestAccepted: settings.friendRequestAccepted ?? true,
    newMessageReceived: settings.newMessageReceived ?? true,
    newFriendPost: settings.newFriendPost ?? true,
    newFriendStory: settings.newFriendStory ?? true,
    newFriendWatch: settings.newFriendWatch ?? true,
    friendRequestReceivedEmail: settings.friendRequestReceivedEmail ?? false,
    friendRequestAcceptedEmail: settings.friendRequestAcceptedEmail ?? false,
    newMessageReceivedEmail: settings.newMessageReceivedEmail ?? false,
    newFriendPostEmail: settings.newFriendPostEmail ?? false,
    newFriendStoryEmail: settings.newFriendStoryEmail ?? false,
    newFriendWatchEmail: settings.newFriendWatchEmail ?? false,
  });

  React.useEffect(() => {
    setNotificationSettings({
      friendRequestReceived: settings.friendRequestReceived ?? true,
      friendRequestAccepted: settings.friendRequestAccepted ?? true,
      newMessageReceived: settings.newMessageReceived ?? true,
      newFriendPost: settings.newFriendPost ?? true,
      newFriendStory: settings.newFriendStory ?? true,
      newFriendWatch: settings.newFriendWatch ?? true,
      friendRequestReceivedEmail: settings.friendRequestReceivedEmail ?? false,
      friendRequestAcceptedEmail: settings.friendRequestAcceptedEmail ?? false,
      newMessageReceivedEmail: settings.newMessageReceivedEmail ?? false,
      newFriendPostEmail: settings.newFriendPostEmail ?? false,
      newFriendStoryEmail: settings.newFriendStoryEmail ?? false,
      newFriendWatchEmail: settings.newFriendWatchEmail ?? false,
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
