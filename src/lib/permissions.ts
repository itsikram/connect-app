import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { requestPushPermission } from './push';

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  notification: boolean;
}

/**
 * Check if a specific permission is granted
 */
async function checkPermission(permission: Permission): Promise<boolean> {
  try {
    const result = await check(permission);
    return result === RESULTS.GRANTED;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Request a specific permission
 */
async function requestPermission(permission: Permission): Promise<boolean> {
  try {
    const result = await request(permission);
    return result === RESULTS.GRANTED;
  } catch (error) {
    console.error('Error requesting permission:', error);
    return false;
  }
}

/**
 * Check camera permission status
 */
export async function checkCameraPermission(): Promise<boolean> {
  const permission = Platform.OS === 'ios' 
    ? PERMISSIONS.IOS.CAMERA 
    : PERMISSIONS.ANDROID.CAMERA;
  return checkPermission(permission);
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  const permission = Platform.OS === 'ios' 
    ? PERMISSIONS.IOS.CAMERA 
    : PERMISSIONS.ANDROID.CAMERA;
  
  const isGranted = await checkPermission(permission);
  if (isGranted) {
    return true;
  }
  
  return requestPermission(permission);
}

/**
 * Check microphone permission status
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  const permission = Platform.OS === 'ios' 
    ? PERMISSIONS.IOS.MICROPHONE 
    : PERMISSIONS.ANDROID.RECORD_AUDIO;
  return checkPermission(permission);
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const permission = Platform.OS === 'ios' 
    ? PERMISSIONS.IOS.MICROPHONE 
    : PERMISSIONS.ANDROID.RECORD_AUDIO;
  
  const isGranted = await checkPermission(permission);
  if (isGranted) {
    return true;
  }
  
  return requestPermission(permission);
}

/**
 * Check notification permission status
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // For Android 13+, we need to check POST_NOTIFICATIONS permission
      if (Platform.Version >= 33) {
        const permission = 'android.permission.POST_NOTIFICATIONS' as Permission;
        const result = await check(permission);
        return result === RESULTS.GRANTED;
      }
      // For older Android versions, notifications are granted by default
      return true;
    } else {
      // For iOS, check notification permission through Firebase messaging
      // This is handled by the push.ts requestPushPermission function
      return false; // Always request to check properly
    }
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
                `Some permissions were not granted: ${deniedPermissions.join(', ')}.\n\n` +
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

