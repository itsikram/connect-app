import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';

const STORAGE_KEY = 'fcmToken';

export async function requestPushPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Android 13+ requires explicit user consent for notifications
      await notifee.requestPermission();
      return true;
    }
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch (e) {
    return false;
  }
}

export async function getOrCreateFcmToken(): Promise<string | null> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEY, token);
      return token;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function registerTokenWithServer(): Promise<string | null> {
  const ok = await requestPushPermission();
  if (!ok) return null;
  const token = await getOrCreateFcmToken();
  if (!token) return null;
  try {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return token;
    await pushAPI.registerToken(token, authToken);
  } catch (e) {}
  return token;
}

export async function unregisterTokenWithServer(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEY);
    const authToken = await AsyncStorage.getItem('authToken');
    if (token && authToken) {
      await pushAPI.unregisterToken(token, authToken);
    }
  } catch (e) {}
}

export async function configureNotificationsChannel() {
  await notifee.createChannel({
    id: 'default',
    name: 'Default',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
  });
  await notifee.createChannel({
    id: 'calls',
    name: 'Calls',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
  });
}

export async function displayLocalNotification(title: string, body: string, data: Record<string, string> = {}) {
  await configureNotificationsChannel();
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: 'default',
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
    data,
  });
}

// Show a full-screen incoming call notification that opens the IncomingCall screen
export async function displayIncomingCallNotification(payload: {
  callerName: string;
  callerProfilePic?: string;
  channelName: string;
  isAudio: boolean;
  callerId: string;
}) {
  await configureNotificationsChannel();
  await notifee.displayNotification({
    title: payload.isAudio ? 'Incoming Audio Call' : 'Incoming Video Call',
    body: payload.callerName,
    android: {
      channelId: 'calls',
      category: AndroidCategory.CALL,
      colorized: true,
      fullScreenAction: {
        id: 'default',
        // Opening the app with deep link to show IncomingCall
        mainComponent: 'default',
      },
      // Ensure heads-up and lockscreen visibility
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      smallIcon: 'ic_launcher',
      pressAction: {
        id: 'open-incoming',
        launchActivity: 'default',
      },
      actions: [
        {
          title: 'Accept',
          pressAction: {
            id: 'accept_call',
            launchActivity: 'default',
          },
        },
        {
          title: 'Reject',
          pressAction: {
            id: 'reject_call',
            launchActivity: 'default',
          },
        },
      ],
    },
    data: {
      type: 'incoming_call',
      callerId: payload.callerId,
      callerName: payload.callerName,
      callerProfilePic: payload.callerProfilePic || '',
      channelName: payload.channelName,
      isAudio: String(payload.isAudio),
    },
  });
}

// Handle notification events (foreground)
export function listenNotificationEvents(navigate: (screen: string, params?: any) => void) {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      const data = detail.notification?.data || {} as any;
      if (data.type === 'incoming_call') {
        const actionId = detail.pressAction?.id;
        if (actionId === 'accept_call') {
          navigate('IncomingCall', {
            callerId: data.callerId,
            callerName: data.callerName,
            callerProfilePic: data.callerProfilePic,
            channelName: data.channelName,
            isAudio: data.isAudio === 'true',
            autoAccept: true,
          });
        } else if (actionId === 'reject_call') {
          // We can emit a socket event to reject if needed; UI navigation optional
          // For now, just cancel the notification
          try { await notifee.cancelNotification(detail.notification?.id as string); } catch (e) {}
        } else {
          navigate('IncomingCall', {
            callerId: data.callerId,
            callerName: data.callerName,
            callerProfilePic: data.callerProfilePic,
            channelName: data.channelName,
            isAudio: data.isAudio === 'true',
          });
        }
      }
    }
  });
}

export function listenForegroundMessages() {
  return messaging().onMessage(async remoteMessage => {
    const data = (remoteMessage.data || {}) as Record<string, string>;
    try {
      // If this is an incoming call, render the specialized full-screen call notification
      if (data.type === 'incoming_call') {
        await displayIncomingCallNotification({
          callerName: data.callerName || 'Unknown',
          callerProfilePic: data.callerProfilePic || '',
          channelName: data.channelName || '',
          isAudio: String(data.isAudio) === 'true',
          callerId: data.callerId || data.from || '',
        });
        return;
      }

      // Fallback to standard notification for other message types
      const title = remoteMessage.notification?.title || 'Message';
      const body = remoteMessage.notification?.body || '';
      await displayLocalNotification(title, body, data);
    } catch (e) {}
  });
}

export function listenTokenRefresh() {
  return messaging().onTokenRefresh(async newToken => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newToken);
      const authToken = await AsyncStorage.getItem('authToken');
      if (authToken) {
        await pushAPI.registerToken(newToken, authToken);
      }
    } catch (e) {}
  });
}



