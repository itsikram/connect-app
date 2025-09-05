import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';

const STORAGE_KEY = 'fcmToken';

export async function requestPushPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  return enabled;
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
        navigate('IncomingCall', {
          callerId: data.callerId,
          callerName: data.callerName,
          callerProfilePic: data.callerProfilePic,
          channelName: data.channelName,
          isAudio: data.isAudio === 'true',
        });
      }
    }
  });
}

export function listenForegroundMessages() {
  return messaging().onMessage(async remoteMessage => {
    const title = remoteMessage.notification?.title || 'Message';
    const body = remoteMessage.notification?.body || '';
    await displayLocalNotification(title, body, (remoteMessage.data || {}) as Record<string, string>);
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



