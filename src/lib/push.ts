import messaging from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, EventType } from '@notifee/react-native';
import { Platform, Linking, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';
import { callNotificationService } from './callNotificationService';
import { backgroundTtsService } from './backgroundTtsService';

// Suppress Firebase deprecation warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('This method is deprecated')) {
    return; // Suppress Firebase deprecation warnings
  }
  originalWarn.apply(console, args);
};

const STORAGE_KEY = 'fcmToken';

// Notification deduplication
let notificationCache = new Map<string, number>(); // Cache to prevent duplicate notifications
const NOTIFICATION_CACHE_DURATION = 5000; // 5 seconds

// Helper function to check if notification was recently shown
const isNotificationRecentlyShown = (key: string): boolean => {
  const now = Date.now();
  const lastShown = notificationCache.get(key);
  
  if (lastShown && (now - lastShown) < NOTIFICATION_CACHE_DURATION) {
    return true;
  }
  
  notificationCache.set(key, now);
  return false;
};

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > NOTIFICATION_CACHE_DURATION) {
      notificationCache.delete(key);
    }
  }
}, 10000); // Clean up every 10 seconds

export async function requestPushPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Android 13+ requires explicit user consent for notifications
      const settings = await notifee.requestPermission({
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      });
      
      if (settings.authorizationStatus === 1) { // AUTHORIZED
        return true;
      }
      
      // Also request Firebase messaging permission
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      return enabled;
    }
    
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch (e) {
    console.error('Error requesting push permission:', e);
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
  try {
    // Create default notification channel - SOUND DISABLED
    await notifee.createChannel({
      id: 'default',
      name: 'Default Notifications',
      description: 'General app notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: undefined, // No sound
      vibration: false, // No vibration
      vibrationPattern: undefined,
    });
    
    // Create calls notification channel with maximum priority for incoming calls - SOUND DISABLED
    await notifee.createChannel({
      id: 'calls',
      name: 'Incoming Calls',
      description: 'Incoming call notifications - full screen alerts',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: undefined, // No sound
      vibration: false, // No vibration
      vibrationPattern: undefined,
      lights: true,
      lightColor: '#FF0000',
      bypassDnd: true, // Bypass Do Not Disturb
    });
    
    console.log('Notification channels configured successfully (sounds disabled)');
  } catch (error) {
    console.error('Error configuring notification channels:', error);
  }
}

export async function displayLocalNotification(title: string, body: string, data: Record<string, string> = {}) {
  // Check if app is in foreground - if so, skip notification
  const appState = AppState.currentState;
  if (appState === 'active') {
    console.log('📱 App is in foreground - skipping notification:', title);
    return;
  }
  
  // Create a unique key for deduplication
  const notificationKey = `local_${title}_${body}_${JSON.stringify(data)}`;
  
  // Check if this notification was recently shown
  if (isNotificationRecentlyShown(notificationKey)) {
    console.log('Skipping duplicate local notification:', title);
    return;
  }
  
  // TTS disabled - no longer speaking notifications
  // try {
  //   await backgroundTtsService.speakNotification(title, body, { priority: 'normal' });
  // } catch (ttsError) {
  //   console.error('❌ Error speaking notification:', ttsError);
  // }
  
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
  try {
    // Use the dedicated call notification service
    await callNotificationService.displayIncomingCallNotification(payload);
  } catch (error) {
    console.error('❌ Error displaying incoming call notification:', error);
  }
}

// Handle notification events (foreground)
export function listenNotificationEvents(navigate: (screen: string, params?: any) => void) {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      const data = detail.notification?.data || {} as any;
      if (data.type === 'incoming_call') {
        const actionId = detail.pressAction?.id;
        const notificationId = detail.notification?.id;
        
        console.log('📞 Notification event received:', { actionId, callerName: data.callerName });
        
        if (actionId === 'accept_call') {
          // Cancel the notification first
          if (notificationId) {
            try { 
              await notifee.cancelNotification(notificationId); 
            } catch (e) {
              console.error('Error canceling notification:', e);
            }
          }
          
          // Navigate to IncomingCall screen with auto-accept flag
          console.log('📞 Navigating to IncomingCall with auto-accept');
          navigate('Message', {
            screen: 'IncomingCall',
            params: {
              callerId: data.callerId,
              callerName: data.callerName,
              callerProfilePic: data.callerProfilePic,
              channelName: data.channelName,
              isAudio: data.isAudio === 'true',
              autoAccept: true,
            }
          });
        } else if (actionId === 'reject_call') {
          // Cancel the notification
          if (notificationId) {
            try { 
              await notifee.cancelNotification(notificationId); 
            } catch (e) {
              console.error('Error canceling notification:', e);
            }
          }
          
          // Emit socket event to reject the call
          try {
            const { emitCallRejection } = await import('./notificationSocketService');
            emitCallRejection(data.callerId, data.channelName, data.isAudio === 'true');
          } catch (error) {
            console.error('Error sending call rejection:', error);
          }
        } else if (actionId === 'incoming_call_fullscreen' || actionId === 'open_incoming_call' || actionId === 'open-incoming') {
          // Full screen action or default action - open the IncomingCall screen
          console.log('📞 Opening IncomingCall screen from notification');
          
          // Try to use native bridge first for better reliability
          try {
            const { openIncomingCallScreen } = await import('./CallNotificationBridge');
            const success = await openIncomingCallScreen({
              callerId: data.callerId,
              callerName: data.callerName,
              callerProfilePic: data.callerProfilePic,
              channelName: data.channelName,
              isAudio: data.isAudio === 'true',
              autoAccept: false,
            });
            
            if (success) {
              console.log('✅ Successfully opened incoming call screen via native bridge');
              return;
            }
          } catch (error) {
            console.warn('Native bridge failed, using navigation fallback:', error);
          }
          
          // Fallback to navigation
          navigate('Message', {
            screen: 'IncomingCall',
            params: {
              callerId: data.callerId,
              callerName: data.callerName,
              callerProfilePic: data.callerProfilePic,
              channelName: data.channelName,
              isAudio: data.isAudio === 'true',
            }
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
      // Skip visual notifications when app is in foreground
      // But still handle TTS for important messages
      console.log('📱 Message received in foreground - processing TTS only');
      
      // TTS disabled - no longer speaking notifications in foreground
      // if (data.type === 'incoming_call') {
      //   await backgroundTtsService.speakIncomingCall(
      //     data.callerName || 'Unknown Caller',
      //     String(data.isAudio) === 'true'
      //   );
      // } else if (data.type === 'new_message') {
      //   await backgroundTtsService.speakNewMessage(
      //     data.senderName || 'Someone',
      //     data.message || 'New message received'
      //   );
      // } else if (data.type === 'notification' || data.type === 'general') {
      //   const title = remoteMessage.notification?.title || 'Notification';
      //   const body = remoteMessage.notification?.body || 'You have a new notification';
      //   await backgroundTtsService.speakNotification(title, body, { priority: 'normal' });
      // }
      
      return;
    } catch (e) {
      console.error('Error processing FCM message:', e);
    }
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
    } catch (e) {
      console.error('Error refreshing token:', e);
    }
  });
}

// Global initialization guard
let isInitializing = false;
let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

// Initialize all notification services
export async function initializeNotifications(): Promise<boolean> {
  // If already initialized, return true
  if (isInitialized) {
    console.log('Notifications already initialized');
    return true;
  }

  // If currently initializing, wait for the existing promise
  if (isInitializing && initializationPromise) {
    console.log('Notifications initialization already in progress, waiting...');
    return await initializationPromise;
  }

  // Start initialization
  isInitializing = true;
  console.log('Initializing notifications...');

  initializationPromise = (async () => {
    try {
      // Configure notification channels first
      await configureNotificationsChannel();
      
      // Request permissions
      const hasPermission = await requestPushPermission();
      if (!hasPermission) {
        console.warn('Notification permission not granted');
        return false;
      }
      
      // Get and register FCM token
      const token = await registerTokenWithServer();
      if (!token) {
        console.warn('Failed to get FCM token');
        return false;
      }
      
      isInitialized = true;
      console.log('Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  })();

  return await initializationPromise;
}

// Cancel all incoming call notifications
export async function cancelIncomingCallNotifications(): Promise<void> {
  try {
    // Use the call notification service to cancel notifications
    await callNotificationService.cancelIncomingCallNotification();
  } catch (error) {
    console.error('Error canceling incoming call notifications:', error);
  }
}

// Request battery optimization exemption for reliable call notifications
export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const powerManagerInfo = await notifee.getPowerManagerInfo();
    if (powerManagerInfo.activity) {
      // Device has a power manager that may affect notifications
      console.log('Power manager detected on device');
      
      // Check if we should request exemption
      const hasAsked = await AsyncStorage.getItem('batteryOptimizationAsked');
      if (hasAsked === 'true') {
        return true; // Already asked, don't spam the user
      }
      
      Alert.alert(
        'Enable Reliable Call Notifications',
        'To receive incoming calls when the app is closed, please disable battery optimization for this app.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: async () => {
              await AsyncStorage.setItem('batteryOptimizationAsked', 'true');
            },
          },
          {
            text: 'Enable',
            onPress: async () => {
              try {
                await notifee.openBatteryOptimizationSettings();
                await AsyncStorage.setItem('batteryOptimizationAsked', 'true');
              } catch (e) {
                console.error('Error opening battery optimization settings:', e);
              }
            },
          },
        ]
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting battery optimization exemption:', error);
    return false;
  }
}

// Request all necessary permissions for incoming calls
export async function requestIncomingCallPermissions(): Promise<boolean> {
  try {
    // Request notification permissions
    const notifPermission = await requestPushPermission();
    if (!notifPermission) {
      console.warn('Notification permission not granted');
      return false;
    }
    
    // Request battery optimization exemption (non-blocking)
    await requestBatteryOptimizationExemption();
    
    return true;
  } catch (error) {
    console.error('Error requesting incoming call permissions:', error);
    return false;
  }
}



