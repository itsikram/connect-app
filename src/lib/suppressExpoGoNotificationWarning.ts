import Constants from 'expo-constants';
import { LogBox, Platform } from 'react-native';

const isAndroidExpoGo =
  Platform.OS === 'android' &&
  (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient');

if (isAndroidExpoGo) {
  const unsupportedRemoteNotificationMessage = 'expo-notifications: Android Push notifications';
  const originalWarn = console.warn as unknown as (...args: any[]) => void;
  const originalError = console.error as unknown as (...args: any[]) => void;
  const containsUnsupportedMessage = (args: any[]) =>
    args.some((value) => {
      const text = value instanceof Error ? `${value.message}\n${value.stack || ''}` : String(value || '');
      return text.includes(unsupportedRemoteNotificationMessage);
    });

  LogBox.ignoreLogs([unsupportedRemoteNotificationMessage]);

  console.warn = (...args: any[]) => {
    if (containsUnsupportedMessage(args)) return;
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    if (containsUnsupportedMessage(args)) return;
    originalError(...args);
  };
}
