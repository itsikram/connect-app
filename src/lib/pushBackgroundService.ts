import BackgroundService from 'react-native-background-actions';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

// Background socket state (module-scoped to persist during service lifetime)
let backgroundSocket: any = null;
let isSettingUpSocket = false;
let hasRegisteredSocketHandlers = false;
let fcmMessageListener: (() => void) | null = null;
let isFcmListenerSetup = false;

// Notification deduplication cache for FCM messages
const fcmNotificationCache = new Map<string, number>();
const FCM_NOTIFICATION_CACHE_DURATION = 10000; // 10 seconds

// Helper function to safely get error message
const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
};

// Helper function to check if FCM notification was recently displayed
const isFcmNotificationRecentlyShown = (key: string): boolean => {
  const now = Date.now();
  const lastShown = fcmNotificationCache.get(key);
  
  if (lastShown && (now - lastShown) < FCM_NOTIFICATION_CACHE_DURATION) {
    return true;
  }
  
  fcmNotificationCache.set(key, now);
  return false;
};

// Clean up old FCM cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of fcmNotificationCache.entries()) {
    if (now - timestamp > FCM_NOTIFICATION_CACHE_DURATION) {
      fcmNotificationCache.delete(key);
    }
  }
}, 30000); // Clean up every 30 seconds

// Resolve a safe caller name from payload
const resolveCallerName = (payload: any): string => {
  return (
    payload?.callerName ||
    payload?.name ||
    payload?.fromName ||
    'Unknown Caller'
  );
};

// Normalize incoming call payload across possible server event shapes
const normalizeIncomingCallPayload = (raw: any) => {
  const isAudio = Boolean(
    raw?.isAudio === true || raw?.isAudio === 'true' || raw?.type === 'audio'
  );
  return {
    callerName: resolveCallerName(raw),
    callerProfilePic: raw?.callerProfilePic || raw?.profilePic || '',
    channelName: raw?.channelName || raw?.channel || raw?.room || '',
    isAudio,
    callerId: raw?.callerId || raw?.from || raw?.userId || raw?.id || '',
  };
};

// Android-only: ensure channels exist and ask user to disable battery optimizations
async function ensureAndroidForegroundPrereqs(): Promise<void> {
  if (Platform.OS !== 'android') return;
  
  // Create notification channels (these don't require React Native context)
  // Use HIGH importance for better visibility in production
  try {
    await notifee.createChannel({
      id: 'default',
      name: 'Default Notifications',
      description: 'General app notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: undefined, // No sound
      vibration: false, // No vibration
    });
  } catch (e) {
    // Ignore errors - channels may already exist
  }
  try {
    await notifee.createChannel({
      id: 'incoming_calls',
      name: 'Incoming Calls',
      description: 'Incoming call notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: undefined, // No sound
      vibration: false, // No vibration
      bypassDnd: true, // Bypass Do Not Disturb
    });
  } catch (e) {
    // Ignore errors - channels may already exist
  }
  
  // Battery optimization check is completely skipped in background processes
  // This check requires React Native context which may be null in background threads,
  // causing NullPointerException crashes at the native bridge level.
  // The battery optimization check should only be performed in foreground contexts
  // (e.g., in PermissionsInitializer component when user is actively using the app).
  // Background services don't need this check - notifications will still work.
}

// Handle FCM messages in background context
// CRITICAL: This function must work in production builds
export async function handleFcmMessage(remoteMessage: any): Promise<void> {
  try {
    const messageId = remoteMessage?.messageId || remoteMessage?.data?.messageId || 'unknown';
    // Log in dev mode, but always process in production
    if (__DEV__) {
      console.log('📱 FCM message received in background service:', messageId);
    }
    
    // CRITICAL: If Android already displayed the notification (notification payload exists),
    // skip ALL processing to prevent duplicates
    // Android automatically displays notifications with a notification payload when app is closed
    if (remoteMessage?.notification) {
      if (__DEV__) {
        console.log('📱 Android already displayed notification (has notification payload), skipping processing to prevent duplicates');
      }
      return; // Android handled it, don't process or display again
    }
    
    const data = remoteMessage?.data || {};
    
    // Ensure notification channels exist
    try {
      const { configureNotificationsChannel } = await import('./push');
      await configureNotificationsChannel();
    } catch (e) {
      // Log but continue - channels might already exist
      if (__DEV__) {
        console.warn('⚠️ Failed to configure notification channels in FCM handler');
      }
    }
    
    // Ensure TTS is initialized
    try {
      const { backgroundTtsService } = await import('./backgroundTtsService');
      await backgroundTtsService.initialize();
    } catch (e) {
      // Log errors even in production for debugging
      console.error('❌ TTS init in FCM handler failed:', getErrorMessage(e));
    }
    
    // Handle speak_message type
    if (data.type === 'speak_message' || data.type === 'speak-message') {
      try {
        const { backgroundTtsService } = await import('./backgroundTtsService');
        const message = data.message || data.text || data.body || '';
        if (message && message.trim().length > 0) {
          const priority = data.priority === 'high' ? 'high' : (data.priority === 'low' ? 'low' : 'normal');
          const interrupt = String(data.interrupt ?? 'true') !== 'false';
          await backgroundTtsService.speakMessage(message, { priority, interrupt });
          console.log('🔊 Spoke message from FCM speak_message');
        }
      } catch (ttsError) {
        console.error('❌ Error speaking FCM speak_message:', ttsError);
      }
      return;
    }
    
    // Handle incoming call notifications with highest priority
    if (data.type === 'incoming_call') {
      console.log('📞 Processing incoming call from FCM in background:', {
        callerName: data.callerName,
        isAudio: data.isAudio,
        callerId: data.callerId || data.from,
      });
      
      try {
        const { callNotificationService } = await import('./callNotificationService');
        await callNotificationService.displayIncomingCallNotification({
          callerName: data.callerName || 'Unknown Caller',
          callerProfilePic: data.callerProfilePic || '',
          channelName: data.channelName || '',
          isAudio: String(data.isAudio) === 'true',
          callerId: data.callerId || data.from || '',
        });
        console.log('✅ Incoming call notification displayed from FCM');
      } catch (error) {
        console.error('❌ Error displaying incoming call notification from FCM:', error);
        // Fallback to basic notification
        try {
          await notifee.displayNotification({
            title: String(data.isAudio) === 'true' ? 'Incoming Audio Call' : 'Incoming Video Call',
            body: `Call from ${data.callerName || 'Unknown Caller'}`,
            android: {
              channelId: 'incoming_calls',
              smallIcon: 'ic_notification',
              ongoing: true,
              pressAction: { id: 'open_incoming_call', launchActivity: 'default' },
              fullScreenAction: { id: 'incoming_call_fullscreen', launchActivity: 'default' },
            },
            data: { type: 'incoming_call', ...data, isAudio: String(data.isAudio) },
          });
        } catch (fallbackError) {
          console.error('❌ Error displaying fallback call notification:', fallbackError);
        }
      }
      return;
    }
    
    // Handle chat messages (when app is closed) - data-only messages
    if (data.type === 'chat' || data.type === 'new_message') {
      const notificationKey = `chat_${messageId}_${data.messageId || ''}`;
      
      // Check if this notification was recently displayed
      if (isFcmNotificationRecentlyShown(notificationKey)) {
        console.log('⏭️ Skipping duplicate chat notification (recently displayed):', notificationKey);
        return;
      }
      
      console.log('💬 Processing chat message from FCM (data-only):', {
        senderName: data.senderName,
        message: data.message?.substring(0, 50) + '...',
        messageId: messageId,
      });
      
      const chatTitle = data.senderName || data.title || 'New Message';
      const chatBody = data.message || data.body || 'You have a new message';
      
      try {
        await notifee.displayNotification({
          title: chatTitle,
          body: chatBody,
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
            sound: undefined, // No sound
          },
          data,
        });
        console.log('✅ Chat notification displayed from FCM (data-only):', chatTitle);
      } catch (notifyErr) {
        console.error('❌ Error displaying chat notification from FCM:', notifyErr);
      }
      return;
    }
    
    // Handle other notification types - data-only messages
    const title = data.title || data.senderName || 'Message';
    const body = data.body || data.message || '';

    const notificationKey = `general_${messageId}_${data.messageId || ''}`;
    
    // Check if this notification was recently displayed
    if (isFcmNotificationRecentlyShown(notificationKey)) {
      console.log('⏭️ Skipping duplicate notification (recently displayed):', notificationKey);
      return;
    }

    // Display notification only if Android didn't already display it (data-only message)
    if (title || body) {
      try {
        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
            sound: undefined, // No sound
          },
          data,
        });
        console.log('✅ Background notification displayed from FCM (data-only):', title);
      } catch (notifyErr) {
        console.error('❌ Error displaying background notification from FCM:', notifyErr);
      }
    }
  } catch (e) {
    console.error('❌ Error in FCM message handler:', e);
  }
}

// Set up FCM message listener for background service
async function setupFcmMessageListener(): Promise<void> {
  if (isFcmListenerSetup) {
    return; // Already set up
  }
  
  try {
    // Ensure Firebase is initialized
    const { getApp } = await import('@react-native-firebase/app');
    try {
      getApp();
    } catch (firebaseError) {
      console.error('❌ Firebase not initialized in FCM listener setup:', firebaseError);
      return;
    }
    
    // Check for initial notification (app opened from notification when killed)
    try {
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        console.log('📱 Processing initial FCM notification (app opened from killed state)');
        await handleFcmMessage(initialNotification);
      }
    } catch (e) {
      console.error('❌ Error checking initial FCM notification:', e);
    }
    
    // Set up message listener for background/foreground messages
    // Note: This works when app is in background or foreground, but not when completely killed
    // When killed, messages are handled via getInitialNotification above or when service restarts
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      try {
        // CRITICAL FIX: Don't access AppState in background process - it may not be available
        // In background service context, we should handle all messages
        // The foreground handler in push.ts will handle foreground messages separately
        // This listener is specifically for background context, so process all messages
        await handleFcmMessage(remoteMessage);
      } catch (e) {
        console.error('❌ Error handling FCM message in background listener:', e);
      }
    });
    
    fcmMessageListener = unsubscribe;
    isFcmListenerSetup = true;
    console.log('✅ FCM message listener set up for background service');
  } catch (e) {
    console.error('❌ Error setting up FCM message listener:', e);
    // Don't mark as set up if there was an error - allow retry
    isFcmListenerSetup = false;
  }
}

// Set up a resilient socket connection usable in background context
async function ensureBackgroundSocketConnected(): Promise<void> {
  if (isSettingUpSocket || (backgroundSocket && backgroundSocket.connected)) {
    return;
  }
  isSettingUpSocket = true;
  try {
    // Defer imports to avoid heavy init on module load
    const [{ initializeSocket }, { default: configAsync }] = await Promise.all([
      import('../socket/socket'),
      import('@react-native-async-storage/async-storage'),
    ]);

    // Read stored user to get profile id
    let profileId: string | undefined;
    try {
      const userJson = await AsyncStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : null;
      profileId = user?.profile?._id;
    } catch (e) {
      // ignore
    }

    if (!profileId) {
      isSettingUpSocket = false;
      return; // No user session; nothing to do
    }

    backgroundSocket = await initializeSocket(profileId);

    if (!hasRegisteredSocketHandlers && backgroundSocket) {
      hasRegisteredSocketHandlers = true;

      // Generic incoming call handler (covers multiple event names)
      const handleIncoming = async (payload: any) => {
        try {
          const { callNotificationService } = await import('./callNotificationService');
          const normalized = normalizeIncomingCallPayload(payload);
          if (!normalized.channelName || !normalized.callerId) {
            return;
          }
          await callNotificationService.displayIncomingCallNotification(normalized);
        } catch (e) {
          // Fallback: minimal notifee notification if service import fails
          try {
            const normalized = normalizeIncomingCallPayload(payload);
            // Ensure channel exists before displaying notification
            await notifee.createChannel({
              id: 'incoming_calls',
              name: 'Incoming Calls',
              importance: AndroidImportance.HIGH,
            });
            await notifee.displayNotification({
              title: normalized.isAudio ? 'Incoming Audio Call' : 'Incoming Video Call',
              body: `Call from ${normalized.callerName}`,
              android: {
                channelId: 'incoming_calls',
                smallIcon: 'ic_notification',
                ongoing: true,
                pressAction: { id: 'open_incoming_call', launchActivity: 'default' },
                fullScreenAction: { id: 'incoming_call_fullscreen', launchActivity: 'default' },
              },
              data: { type: 'incoming_call', ...normalized, isAudio: String(normalized.isAudio) },
            });
          } catch (fallbackError) {
            console.error('❌ Error displaying fallback notification:', fallbackError);
          }
        }
      };

      // Listen to various possible server events for incoming calls
      const incomingEvents = [
        'incoming_call',
        'incoming-call',
        'incoming-audio-call',
        'incoming-video-call',
      ];
      incomingEvents.forEach(evt => {
        try { backgroundSocket.on(evt, handleIncoming); } catch (_) {}
      });

      // Speak message handler (server-driven TTS) - re-enabled for socket 'speak_message' events
      const handleSpeakMessage = async (payload: any) => {
        try {
          const { backgroundTtsService } = await import('./backgroundTtsService');
          await backgroundTtsService.initialize();
          const message: string = String(
            payload?.message || payload?.text || payload?.body || ''
          );
          if (!message.trim()) return;

          const priority = (payload?.priority === 'high' || payload?.priority === 'low') ? payload.priority : 'normal';
          const interrupt = payload?.interrupt !== false; // default true

          console.log('🔊 Speaking message from socket speak_message event:', payload);
          await backgroundTtsService.speakMessage(message, { priority, interrupt });
        } catch (error) {
          console.error('❌ Error speaking message from socket:', error);
        }
      };
      const speakEvents = [ 'speak_message', 'speak-message' ];
      speakEvents.forEach(evt => {
        try { backgroundSocket.on(evt, handleSpeakMessage); } catch (_) {}
      });

      // Keep minimal logging to observe connection state
      try { backgroundSocket.on('disconnect', () => {}); } catch (_) {}
      try { backgroundSocket.on('connect_error', () => {}); } catch (_) {}
    }
  } catch (e) {
    // ignore connection errors; will retry on next tick
  } finally {
    isSettingUpSocket = false;
  }
}

// Minimal task to keep JS runtime alive in background and maintain socket
async function backgroundTask({ taskName }: { taskName: string }) {
  // CRITICAL: Wrap entire task in try-catch to prevent service crashes
  try {
  // Initialize TTS for background speech
  try {
    const { backgroundTtsService } = await import('./backgroundTtsService');
    await backgroundTtsService.initialize();
    } catch (e) {
      console.error('❌ Failed to initialize TTS in background task:', getErrorMessage(e));
      // Continue even if TTS fails - it's not critical for service operation
    }

  // Ensure Android notification channels exist
  // Note: Battery optimization check is skipped in background processes
  // to avoid null context errors - it's not critical for background functionality
  try { 
    await ensureAndroidForegroundPrereqs(); 
  } catch (e) {
    // Silently ignore errors - notification channels will still work
    // Battery optimization check is optional and not critical
      console.error('❌ Failed to ensure Android prerequisites:', getErrorMessage(e));
  }

  // Best-effort: bring up socket once on start
    try {
  await ensureBackgroundSocketConnected();
    } catch (e) {
      console.error('❌ Failed to connect socket initially:', getErrorMessage(e));
      // Continue - socket will retry in loop
    }
  
  // Set up FCM message listener for background notifications
    try {
  await setupFcmMessageListener();
    } catch (e) {
      console.error('❌ Failed to setup FCM listener initially:', getErrorMessage(e));
      // Continue - will retry in loop
    }

  // Optimized loop: check socket connection less frequently to reduce battery drain
  // Start with 5 seconds, then increase to 30 seconds after initial connection
  let checkInterval = 5000; // Start with 5 seconds
  let consecutiveSuccesses = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10; // After 10 errors, retry FCM setup
  
  for (;;) {
      try {
    await new Promise<void>(resolve => setTimeout(() => resolve(), checkInterval));
        
        // Periodically retry FCM listener setup if it failed
        if (!isFcmListenerSetup && consecutiveErrors % 5 === 0) {
          try {
            await setupFcmMessageListener();
          } catch (e) {
            console.error('❌ Retry FCM listener setup failed:', getErrorMessage(e));
          }
        }
        
    try {
      const wasConnected = backgroundSocket && backgroundSocket.connected;
      await ensureBackgroundSocketConnected();
      const isConnected = backgroundSocket && backgroundSocket.connected;
      
      // If socket is connected and was already connected, increase interval to save battery
      if (isConnected && wasConnected) {
        consecutiveSuccesses++;
            consecutiveErrors = 0; // Reset error count on success
        // After 3 successful checks (15 seconds), increase interval to 30 seconds
        if (consecutiveSuccesses >= 3 && checkInterval < 30000) {
          checkInterval = 30000; // 30 seconds
          console.log('Background service: Socket stable, reducing check frequency to save battery');
        }
      } else {
        // Reset interval if connection changed
        consecutiveSuccesses = 0;
        checkInterval = 5000; // Back to 5 seconds
      }
        } catch (e) {
      // Reset on error
      consecutiveSuccesses = 0;
          consecutiveErrors++;
      checkInterval = 5000;
          
          // Log error but don't crash - service should continue running
          if (consecutiveErrors % 10 === 0) {
            console.error(`❌ Background service error (count: ${consecutiveErrors}):`, getErrorMessage(e));
          }
          
          // If too many consecutive errors, something is seriously wrong
          // But don't crash - just log and continue
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`❌ Background service has ${consecutiveErrors} consecutive errors - service may be unstable`);
            consecutiveErrors = 0; // Reset to prevent log spam
          }
        }
      } catch (e) {
        // Catch any errors in the loop itself
        console.error('❌ Critical error in background task loop:', getErrorMessage(e));
        // Wait a bit longer before retrying to avoid tight error loops
        await new Promise<void>(resolve => setTimeout(() => resolve(), 10000));
      }
    }
  } catch (e) {
    // If the entire task fails, log and rethrow to let the service handle it
    console.error('❌ Fatal error in background task:', getErrorMessage(e));
    throw e;
  }
}

const options = {
  taskName: 'ConnectBackground',
  taskTitle: 'Background service running',
  taskDesc: 'Handling notifications and background tasks',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' as const },
  color: '#0A84FF',
  linkingURI: 'connect://home',
  parameters: { taskName: 'ConnectBackground' },
  allowExecutionInForeground: false,
  stopWithTerminate: false, // Continue running even when app is terminated/closed
  // Android specific
  foregroundService: true,
};

class PushBackgroundService {
  private isRunning = false;
  private appStateListener: any = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    try {
      await BackgroundService.start(backgroundTask as any, options as any);
      this.isRunning = true;
      console.log("background server running");
      
      // Set up AppState listener to stop service when app is closed
      this.setupAppStateListener();
    } catch (e) {
      // If already running or failed to start, ignore
      this.isRunning = true;
    }
  }
  
  private setupAppStateListener(): void {
    // CRITICAL FIX: Don't use AppState in background service
    // AppState may not be available in background process and can cause crashes
    // The background service should run independently of app state
    // Remove AppState listener setup - it's not needed for background service
    // The service runs independently and doesn't need to track app state
    try {
      // Only try to set up AppState listener if we're in the main process
      // In background process, this will fail silently
      const { AppState } = require('react-native');
      if (AppState && typeof AppState.addEventListener === 'function') {
    // Remove existing listener if any
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    
        // Listen for app state changes (only in main process)
    this.appStateListener = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        // App is going to background - keep service running for notifications
        console.log('📱 App moved to background, keeping service running');
      } else if (nextAppState === 'active') {
        // App is active - service can continue running
        console.log('📱 App is active');
      }
    });
      }
    } catch (e) {
      // AppState not available in background process - this is expected and OK
      // Don't log error to avoid noise in production logs
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      // Remove AppState listener
      if (this.appStateListener) {
        try {
          this.appStateListener.remove();
          this.appStateListener = null;
          console.log('✅ AppState listener removed');
        } catch (e) {
          console.error('Error removing AppState listener:', e);
        }
      }
      
      // Clean up FCM listener
      if (fcmMessageListener) {
        try {
          fcmMessageListener();
          fcmMessageListener = null;
          isFcmListenerSetup = false;
          console.log('✅ FCM message listener cleaned up');
        } catch (e) {
          console.error('Error cleaning up FCM listener:', e);
        }
      }
      
      await BackgroundService.stop();
    } catch (e) {
      // ignore
    } finally {
      this.isRunning = false;
      console.log('background service stopped')
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  // Convenience to ensure service is running before operations
  async ensure(): Promise<void> {
    if (!this.isRunning) {
      await this.start();
    }
  }

  // This service handles all background notifications via background-fetch plugin:
  // 1. Keeping background socket connection alive
  // 2. Handling incoming call notifications via socket
  // 3. Handling speak_message events for TTS
  // 4. Handling FCM push notifications (incoming_call, chat, speak_message, etc.)
  // Native FCM background handlers have been removed to avoid conflicts
}

export const pushBackgroundService = new PushBackgroundService();
export default pushBackgroundService;
