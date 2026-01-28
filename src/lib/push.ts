// Firebase and Notifee removed for Expo compatibility
import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';
import { callNotificationService } from './callNotificationService';
// Background TTS service removed for Expo compatibility

// Import Notifee types and functions - made optional for Expo Go compatibility
let Notifee: any = null;
let AndroidImportance: any = null;
let AndroidVisibility: any = null;
let EventType: any = null;

try {
  const notifeeModule = require('@notifee/react-native');
  Notifee = notifeeModule.default;
  AndroidImportance = notifeeModule.AndroidImportance;
  AndroidVisibility = notifeeModule.AndroidVisibility;
  EventType = notifeeModule.EventType;
} catch (error) {
  console.log('Notifee not available - using expo-notifications only');
}

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
    // Use expo-notifications for permission requests
    const settings = await Notifications.requestPermissionsAsync();
    
    if (settings.status === 'granted') {
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error requesting push permission:', e);
    return false;
  }
}

export async function getOrCreateFcmToken(): Promise<string | null> {
  try {
    // Check if we have a cached token first
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing) {
      console.log('✅ Using cached push token');
      return existing;
    }

    // Get expo push token with fallback
    let token;
    try {
      token = await Notifications.getExpoPushTokenAsync({
        projectId: '76d83a3a-a10d-43fb-a110-e50066ce889f' // Replace with your actual Expo project ID
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
    if (token.data) {
      await AsyncStorage.setItem(STORAGE_KEY, token.data);
      console.log('✅ Expo push token retrieved successfully');
      return token.data;
    }
    
    console.warn('⚠️ Expo push token is empty');
    return null;
  } catch (e: any) {
    console.error('❌ Unexpected error in getOrCreateFcmToken:', e?.message || String(e || ''));
    return null;
  }
}

export async function registerTokenWithServer(): Promise<string | null> {
  try {
    const ok = await requestPushPermission();
    if (!ok) {
      console.warn('⚠️ Push permission not granted, cannot register FCM token');
      return null;
    }
    
    const token = await getOrCreateFcmToken();
    if (!token) {
      console.warn('⚠️ Failed to get FCM token in registerTokenWithServer');
      return null;
    }
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        console.log('ℹ️ No auth token available, skipping server registration (token retrieved successfully)');
        return token;
      }
      await pushAPI.registerToken(token, authToken);
      console.log('✅ FCM token registered with server');
    } catch (e: any) {
      console.warn('⚠️ Failed to register token with server (but token is available):', e?.message || String(e || ''));
      // Return token anyway since we have it, server registration is optional
    }
    return token;
  } catch (e: any) {
    console.error('❌ Unexpected error in registerTokenWithServer:', e?.message || String(e || ''));
    return null;
  }
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
    // Check if Notifee module is available
    if (!Notifee || typeof Notifee.createChannel !== 'function') {
      console.warn('⚠️ Notifee not ready, skipping channel configuration');
      return;
    }

    // Create default notification channel - SOUND DISABLED
    await Notifee.createChannel({
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
    await Notifee.createChannel({
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
    
    // Also create 'incoming_calls' channel (used by some parts of the code)
    await Notifee.createChannel({
      id: 'incoming_calls',
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
    
    console.log('✅ Notification channels configured successfully (sounds disabled)');
  } catch (error: any) {
    // Check if error is due to null context (React Native not ready)
    const errorMessage = error?.message || String(error || '');
    if (errorMessage.includes('null') || errorMessage.includes('NullPointerException') || errorMessage.includes('getSystemService')) {
      console.warn('⚠️ React Native not ready for notification channels, will retry later');
      return;
    }
    console.error('❌ Error configuring notification channels:', error);
    // Don't throw - channels may already exist, which is fine
  }
}

export async function displayLocalNotification(title: string, body: string, data: Record<string, string> = {}) {
  try {
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

    await configureNotificationsChannel();
    
    // Use expo-notifications if Notifee is not available
    if (!Notifee) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
        },
        trigger: null, // Show immediately
      });
      return;
    }
    
    await Notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
      data: data || {},
    });
  } catch (error) {
    console.error('Error displaying notification:', error);
  }
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
  // Use expo-notifications if Notifee is not available
  if (!Notifee) {
    return Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response.notification.request.content.data || {} as any;
      if (data.type === 'incoming_call') {
        // Cancel the notification first
        if (response.notification.request.identifier) {
          try { 
            await Notifications.dismissNotificationAsync(response.notification.request.identifier);
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
      } else if (data.type === 'new_message') {
        // Navigate to SingleMessage screen
        navigate('Message', {
          screen: 'SingleMessage',
          params: {
            friendId: data.friendId,
            friendName: data.friendName,
          }
        });
      }
    });
  }

  return Notifee.onForegroundEvent(async ({ type, detail }) => {
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
              await Notifee.cancelNotification(notificationId); 
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
              await Notifee.cancelNotification(notificationId); 
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
  return Notifications.addNotificationResponseReceivedListener(async response => {
    const data = (response.notification.request.content.data || {}) as Record<string, string>;
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
      //   const title = response.notification.request.content.title || 'Notification';
      //   const body = response.notification.request.content.body || 'You have a new notification';
      //   await backgroundTtsService.speakNotification(title, body, { priority: 'normal' });
      // }
      
      return;
    } catch (e) {
      console.error('Error processing notification response:', e);
    }
  });
}

export function listenTokenRefresh() {
  // Expo doesn't have token refresh listeners in the same way as Firebase
  // Return a no-op listener for compatibility
  return {
    remove: () => {}
  };
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
        console.error('❌ Failed to get FCM token - notifications will not work properly');
        console.error('   This may be due to:');
        console.error('   1. Firebase not being properly initialized');
        console.error('   2. Missing or invalid google-services.json configuration');
        console.error('   3. Network issues preventing token retrieval');
        console.error('   4. Permission issues');
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

  // Skip if Notifee is not available (Expo Go)
  if (!Notifee) {
    console.log('Battery optimization exemption skipped - Notifee not available');
    return true;
  }

  try {
    const powerManagerInfo = await Notifee.getPowerManagerInfo();
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
                await Notifee.openBatteryOptimizationSettings();
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



