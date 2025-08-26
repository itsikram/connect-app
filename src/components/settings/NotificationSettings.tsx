import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  useColorScheme,
} from 'react-native';
import { colors } from '../../theme/colors';

interface NotificationSettings {
  // Push Notifications
  friendRequestReceived: boolean;
  friendRequestAccepted: boolean;
  newMessageReceived: boolean;
  newFriendPost: boolean;
  newFriendStory: boolean;
  newFriendWatch: boolean;
  
  // Email Notifications
  friendRequestReceivedEmail: boolean;
  friendRequestAcceptedEmail: boolean;
  newMessageReceivedEmail: boolean;
  newFriendPostEmail: boolean;
  newFriendStoryEmail: boolean;
  newFriendWatchEmail: boolean;
}

const NotificationSettings = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    friendRequestReceived: true,
    friendRequestAccepted: true,
    newMessageReceived: true,
    newFriendPost: true,
    newFriendStory: true,
    newFriendWatch: true,
    friendRequestReceivedEmail: false,
    friendRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
    newFriendPostEmail: false,
    newFriendStoryEmail: false,
    newFriendWatchEmail: false,
  });

  const handleToggle = (key: keyof NotificationSettings) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    // Here you would typically make an API call to save the notification settings
    console.log('Notification settings:', notificationSettings);
  };

  const renderSwitchSetting = (
    key: keyof NotificationSettings,
    label: string,
    description: string
  ) => (
    <View style={styles.switchItem}>
      <View style={styles.switchContent}>
        <Text style={[styles.switchLabel, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          {label}
        </Text>
        <Text style={[styles.switchDescription, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={notificationSettings[key]}
        onValueChange={() => handleToggle(key)}
        trackColor={{ false: isDarkMode ? colors.gray[700] : colors.gray[300], true: colors.primary }}
        thumbColor={notificationSettings[key] ? colors.white : isDarkMode ? colors.gray[500] : colors.gray[400]}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Notification Settings
        </Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          Control how and when you receive notifications
        </Text>
      </View>

      {/* Push Notifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Push Notifications
        </Text>
        <Text style={[styles.sectionDescription, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          Receive instant notifications on your device
        </Text>
        
        {renderSwitchSetting(
          'friendRequestReceived',
          'Friend Request Received',
          'Get notified when someone sends you a friend request'
        )}
        
        {renderSwitchSetting(
          'friendRequestAccepted',
          'Friend Request Accepted',
          'Get notified when someone accepts your friend request'
        )}
        
        {renderSwitchSetting(
          'newMessageReceived',
          'New Message Received',
          'Get notified when you receive a new message'
        )}
        
        {renderSwitchSetting(
          'newFriendPost',
          'New Friend\'s Post',
          'Get notified when your friends create new posts'
        )}
        
        {renderSwitchSetting(
          'newFriendStory',
          'New Friend\'s Story',
          'Get notified when your friends share new stories'
        )}
        
        {renderSwitchSetting(
          'newFriendWatch',
          'New Friend\'s Watch',
          'Get notified when your friends share new watch content'
        )}
      </View>

      {/* Email Notifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Email Notifications
        </Text>
        <Text style={[styles.sectionDescription, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          Receive email notifications for important updates
        </Text>
        
        {renderSwitchSetting(
          'friendRequestReceivedEmail',
          'Friend Request Received',
          'Get email notifications for new friend requests'
        )}
        
        {renderSwitchSetting(
          'friendRequestAcceptedEmail',
          'Friend Request Accepted',
          'Get email notifications when friend requests are accepted'
        )}
        
        {renderSwitchSetting(
          'newMessageReceivedEmail',
          'New Message Received',
          'Get email notifications for new messages'
        )}
        
        {renderSwitchSetting(
          'newFriendPostEmail',
          'New Friend\'s Post',
          'Get email notifications for new friend posts'
        )}
        
        {renderSwitchSetting(
          'newFriendStoryEmail',
          'New Friend\'s Story',
          'Get email notifications for new friend stories'
        )}
        
        {renderSwitchSetting(
          'newFriendWatchEmail',
          'New Friend\'s Watch',
          'Get email notifications for new friend watch content'
        )}
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: isDarkMode ? colors.gray[800] : colors.white }]}>
        <Text style={[styles.infoTitle, { color: isDarkMode ? colors.text.light : colors.text.primary }]}>
          Notification Tips
        </Text>
        <Text style={[styles.infoText, { color: isDarkMode ? colors.gray[400] : colors.gray[600] }]}>
          • Push notifications are instant and appear on your device{'\n'}
          • Email notifications are sent periodically and may be delayed{'\n'}
          • You can customize these settings at any time{'\n'}
          • Some notifications are required for app functionality
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Notification Settings</Text>
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
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
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 24,
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

export default NotificationSettings;
