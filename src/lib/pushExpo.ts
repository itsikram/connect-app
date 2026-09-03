// Push notifications service - simplified for Expo compatibility
import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert, AppState, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';
import {
  getIncomingCallChannelId,
  getRingtoneSoundName,
} from './ringtoneAssets';
import { getNativeOrExpoPushToken, PUSH_TOKEN_STORAGE_KEY } from './pushToken';
import config from './config';
import { isAndroidExpoGo } from './expoGo';

const STORAGE_KEY = PUSH_TOKEN_STORAGE_KEY;

// Initialize notifications
export const initializeNotifications = async () => {
  if (isAndroidExpoGo()) return;
  try {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowTimeSensitive: true,
      },
    });
    console.log('✅ Notifications initialized');
  } catch (error) {
    console.error('❌ Failed to initialize notifications:', error);
  }
};

// Get notification token (Expo equivalent)
export const getNotificationToken = async () => {
  if (isAndroidExpoGo()) return null;
  try {
    const result = await getNativeOrExpoPushToken();
    if (!result?.token) return null;
    console.log('✅ Push token retrieved');
    return result;
  } catch (error) {
    console.error('❌ Failed to get push token:', error);
    return null;
  }
};

export const saveNotificationToken = async (token: string, previousToken?: string | null) => {
  if (isAndroidExpoGo()) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, token);

    if (previousToken && previousToken !== token) {
      try {
        await pushAPI.unregisterToken(previousToken);
      } catch (_) {}
    }
    await pushAPI.registerToken(token);
    if (Platform.OS === 'android') {
      const authToken = await AsyncStorage.getItem('authToken');
      try {
        NativeModules.CallNotificationModule?.savePushConfig?.(
          config.API_BASE_URL,
          authToken || '',
        );
      } catch (_) {}
    }
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
