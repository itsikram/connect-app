import { Platform, Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestPushPermission } from './push';

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  notification: boolean;
}

/**
 * Check camera permission status using Expo
 */
export async function checkCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return false;
  }
}

/**
 * Request camera permission using Expo
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
}

/**
 * Check microphone permission status using Expo
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
}

/**
 * Request microphone permission using Expo
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
}

/**
 * Check notification permission status
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    // Use the existing requestPushPermission from push.ts
    // It handles both Android and iOS properly
    return await requestPushPermission();
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Check all required permissions status
 */
export async function checkAllPermissions(): Promise<PermissionStatus> {
  const [camera, microphone, notification] = await Promise.all([
    checkCameraPermission(),
    checkMicrophonePermission(),
    checkNotificationPermission(),
  ]);

  return { camera, microphone, notification };
}

/**
 * Request all required permissions
 * Only requests permissions that haven't been granted yet
 */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  console.log('📱 Checking current permission status...');
  
  // Check current status
  const currentStatus = await checkAllPermissions();
  console.log('📊 Current permissions:', currentStatus);

  // Request permissions that aren't granted
  const results: PermissionStatus = { ...currentStatus };

  // Request camera if not granted
  if (!currentStatus.camera) {
    console.log('📷 Requesting camera permission...');
    results.camera = await requestCameraPermission();
    console.log('📷 Camera permission result:', results.camera);
  }

  // Request microphone if not granted
  if (!currentStatus.microphone) {
    console.log('🎤 Requesting microphone permission...');
    results.microphone = await requestMicrophonePermission();
    console.log('🎤 Microphone permission result:', results.microphone);
  }

  // Request notification if not granted
  if (!currentStatus.notification) {
    console.log('🔔 Requesting notification permission...');
    results.notification = await requestNotificationPermission();
    console.log('🔔 Notification permission result:', results.notification);
  }

  console.log('✅ All permissions requested. Final status:', results);
  return results;
}

/**
 * Request all permissions with user-friendly alerts
 * Shows explanation before requesting and handles denials gracefully
 */
export async function requestAllPermissionsWithAlerts(): Promise<PermissionStatus> {
  console.log('📱 Starting permission request flow...');

  // Check current status
  const currentStatus = await checkAllPermissions();
  const needsPermissions = !currentStatus.camera || !currentStatus.microphone || !currentStatus.notification;

  if (!needsPermissions) {
    console.log('✅ All permissions already granted');
    return currentStatus;
  }

  // Show explanation alert
  return new Promise((resolve) => {
    Alert.alert(
      'Permissions Required',
      'This app needs access to your camera, microphone, and notifications to provide the best experience:\n\n' +
      '• Camera: For video calls, sharing photos, and emotion detection\n' +
      '• Microphone: For voice and video calls\n' +
      '• Notifications: To alert you of new messages and calls',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => {
            console.log('User declined permission request');
            resolve(currentStatus);
          },
        },
        {
          text: 'Continue',
          onPress: async () => {
            const results = await requestAllPermissions();
            
            // Check if any permissions were denied
            const deniedPermissions = [];
            if (!results.camera) deniedPermissions.push('Camera');
            if (!results.microphone) deniedPermissions.push('Microphone');
            if (!results.notification) deniedPermissions.push('Notifications');

            if (deniedPermissions.length > 0) {
              Alert.alert(
                'Permissions Needed',
                `Some permissions were not granted: ${deniedPermissions.join(', ')}\.\n\n` +
                'You can enable them later in Settings to use all features.',
                [
                  {
                    text: 'Later',
                    style: 'cancel',
                  },
                  {
                    text: 'Open Settings',
                    onPress: () => Linking.openSettings(),
                  },
                ]
              );
            }

            resolve(results);
          },
        },
      ]
    );
  });
}

/**
 * Open app settings
 */
export function openAppSettings(): void {
  Linking.openSettings();
}

