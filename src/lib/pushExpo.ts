// Push notifications service - simplified for Expo compatibility
import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';
import Constants from 'expo-constants';
import {
  getIncomingCallChannelId,
  getRingtoneSoundName,
} from './ringtoneAssets';

const STORAGE_KEY = 'fcmToken';
const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId || '76d83a3a-a10d-43fb-a110-e50066ce889f';

// Initialize notifications
export const initializeNotifications = async () => {
  try {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    console.log('✅ Notifications initialized');
  } catch (error) {
    console.error('❌ Failed to initialize notifications:', error);
  }
};

// Get notification token (Expo equivalent)
export const getNotificationToken = async () => {
  try {
    // Get expo push token with fallback
    let token;
    try {
      token = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
    } catch (projectError: any) {
      // Fallback for when projectId is not configured
      console.warn('⚠️ Project ID not configured, trying without projectId:', projectError?.message);
      try {
        token = await Notifications.getExpoPushTokenAsync();
      } catch (fallbackError: any) {
        console.error('❌ Failed to get Expo push token even with fallback:', fallbackError?.message);
        return null;
      }
    }
    console.log('✅ Expo push token:', token.data);
    return token.data;
  } catch (error) {
    console.error('❌ Failed to get Expo push token:', error);
    return null;
  }
};

// Save token to storage and server
export const saveNotificationToken = async (token: string) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, token);
    
    // Send token to server (using registerToken instead)
    await pushAPI.registerToken(token);
    console.log('✅ Notification token saved');
  } catch (error) {
    console.error('❌ Failed to save notification token:', error);
  }
};

// Display notification (simplified for Expo)
export const displayNotification = async (title: string, body: string, data?: any) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('❌ Failed to display notification:', error);
  }
};

// Display incoming call notification
export const displayIncomingCallNotification = async (data: {
  callerName: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  callerId: string;
}) => {
  try {
    await displayNotification(
      `Incoming ${data.isAudio ? 'Audio' : 'Video'} Call`,
      `${data.callerName} is calling...`,
      {
        type: 'incoming_call',
        callerId: data.callerId,
        channelName: data.channelName,
        isAudio: data.isAudio,
        callerName: data.callerName,
        callerProfilePic: data.callerProfilePic,
      }
    );
  } catch (error) {
    console.error('❌ Failed to display incoming call notification:', error);
  }
};

// Configure notification channels
export const configureNotificationsChannel = async () => {
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
      bypassDnd: true,
    });
    const callAudioAttributes = {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: {
        enforceAudibility: true,
        requestHardwareAudioVideoSynchronization: false,
      },
    };
    const callChannel = (id: string, sound: string) =>
      Notifications.setNotificationChannelAsync(id, {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400, 200, 400],
        sound,
        bypassDnd: true,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: callAudioAttributes,
      });
    await callChannel('incoming_calls', 'ringtone_1');
    await callChannel('incoming_calls_v3', 'ringtone_1');
    for (let i = 1; i <= 5; i += 1) {
      await callChannel(getIncomingCallChannelId(String(i)), getRingtoneSoundName(String(i)));
    }
  } catch (error) {
    console.error('❌ Failed to configure notification channels:', error);
  }
};

export default {
  initializeNotifications,
  getNotificationToken,
  saveNotificationToken,
  displayNotification,
  displayIncomingCallNotification,
  configureNotificationsChannel,
};
