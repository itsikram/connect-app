import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushAPI } from './api';

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
    // Create default notification channel
    await notifee.createChannel({
      id: 'default',
      name: 'Default Notifications',
      description: 'General app notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500],
    });
    
    // Create calls notification channel with higher priority
    await notifee.createChannel({
      id: 'calls',
      name: 'Incoming Calls',
      description: 'Incoming call notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      lights: true,
      lightColor: '#FF0000',
    });
    
    console.log('Notification channels configured successfully');
  } catch (error) {
    console.error('Error configuring notification channels:', error);
  }
}

export async function displayLocalNotification(title: string, body: string, data: Record<string, string> = {}) {
  // Create a unique key for deduplication
  const notificationKey = `local_${title}_${body}_${JSON.stringify(data)}`;
  
  // Check if this notification was recently shown
  if (isNotificationRecentlyShown(notificationKey)) {
    console.log('Skipping duplicate local notification:', title);
    return;
  }
  
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
    // Create a unique key for deduplication based on caller and call type
    const notificationKey = `incoming_call_${payload.callerId}_${payload.isAudio ? 'audio' : 'video'}`;
    
    // Check if this call notification was recently shown
    if (isNotificationRecentlyShown(notificationKey)) {
      console.log('Skipping duplicate incoming call notification for:', payload.callerName);
      return;
    }
    
    await configureNotificationsChannel();
    
    const notificationId = `incoming_call_${payload.callerId}_${Date.now()}`;
    
    await notifee.displayNotification({
      id: notificationId,
      title: payload.isAudio ? 'Incoming Audio Call' : 'Incoming Video Call',
      body: `Call from ${payload.callerName}`,
      android: {
        channelId: 'calls',
        category: AndroidCategory.CALL,
        colorized: true,
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        // Ensure heads-up and lockscreen visibility
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        smallIcon: 'ic_launcher',
        largeIcon: payload.callerProfilePic || 'ic_launcher',
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
        // Auto-cancel after 30 seconds if not answered
        autoCancel: false,
        ongoing: true,
        showTimestamp: true,
      },
      data: {
        type: 'incoming_call',
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerProfilePic: payload.callerProfilePic || '',
        channelName: payload.channelName,
        isAudio: String(payload.isAudio),
        notificationId: notificationId,
      },
    });
    
    console.log('Incoming call notification displayed:', notificationId);
  } catch (error) {
    console.error('Error displaying incoming call notification:', error);
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
        } else {
          // Default action - just open the IncomingCall screen
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
      
      // Create a unique key for FCM message deduplication
      const messageKey = `fcm_${title}_${body}_${JSON.stringify(data)}`;
      
      // Check if this FCM message was recently processed
      if (isNotificationRecentlyShown(messageKey)) {
        console.log('Skipping duplicate FCM message:', title);
        return;
      }
      
      await displayLocalNotification(title, body, data);
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

// Initialize all notification services
export async function initializeNotifications(): Promise<boolean> {
  try {
    console.log('Initializing notifications...');
    
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
    
    console.log('Notifications initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return false;
  }
}

// Cancel all incoming call notifications
export async function cancelIncomingCallNotifications(): Promise<void> {
  try {
    const notifications = await notifee.getDisplayedNotifications();
    for (const notification of notifications) {
      if (notification.notification?.data?.type === 'incoming_call' && notification.id) {
        await notifee.cancelNotification(notification.id);
      }
    }
  } catch (error) {
    console.error('Error canceling incoming call notifications:', error);
  }
}



