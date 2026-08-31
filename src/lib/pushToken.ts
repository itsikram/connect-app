import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const PUSH_TOKEN_STORAGE_KEY = 'fcmToken';

const EXPO_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId || '76d83a3a-a10d-43fb-a110-e50066ce889f';

export function isExpoPushToken(token: string | null | undefined): boolean {
  const value = String(token || '');
  return value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken');
}

function tokenFromDevice(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === 'string' && result.trim()) return result.trim();
  const data = (result as { data?: unknown })?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  return null;
}

/**
 * Android incoming-call alerts in background/killed need a native FCM token.
 * Expo push tokens are kept as a fallback (iOS / if native retrieval fails).
 */
export async function getNativeOrExpoPushToken(): Promise<{
  token: string;
  previousToken: string | null;
} | null> {
  const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  const runningInExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

  // Expo Go cannot use this project's native FCM / APNs identity. Always use an Expo push token.
  if (Platform.OS === 'android' && !runningInExpoGo) {
    try {
      const device = await Notifications.getDevicePushTokenAsync();
      const nativeToken = tokenFromDevice(device);
      if (nativeToken) {
        if (previousToken !== nativeToken) {
          await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, nativeToken);
        }
        return {
          token: nativeToken,
          previousToken: previousToken && previousToken !== nativeToken ? previousToken : null,
        };
      }
    } catch (error) {
      console.warn('Native FCM token failed, falling back to Expo push token', error);
    }
  }

  if (previousToken && (Platform.OS !== 'android' || isExpoPushToken(previousToken))) {
    try {
      const expo = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
      const expoToken = tokenFromDevice(expo);
      if (expoToken) {
        if (previousToken !== expoToken) {
          await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoToken);
        }
        return {
          token: expoToken,
          previousToken: previousToken !== expoToken ? previousToken : null,
        };
      }
    } catch (_) {}
  }

  try {
    const expo = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
    const expoToken = tokenFromDevice(expo);
    if (expoToken) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoToken);
      return {
        token: expoToken,
        previousToken: previousToken && previousToken !== expoToken ? previousToken : null,
      };
    }
  } catch (projectError: any) {
    console.warn('Expo push token with projectId failed', projectError?.message);
    try {
      const expo = await Notifications.getExpoPushTokenAsync();
      const expoToken = tokenFromDevice(expo);
      if (expoToken) {
        await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoToken);
        return {
          token: expoToken,
          previousToken: previousToken && previousToken !== expoToken ? previousToken : null,
        };
      }
    } catch (fallbackError: any) {
      console.error('Failed to get Expo push token', fallbackError?.message);
    }
  }

  return previousToken ? { token: previousToken, previousToken: null } : null;
}
