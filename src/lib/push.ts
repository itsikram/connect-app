import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
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



