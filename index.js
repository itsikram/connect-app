/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, ErrorUtils } from 'react-native';
import 'react-native-reanimated';

// Global error handler for unhandled errors
// Check if ErrorUtils is available before using it
let originalErrorHandler = null;
if (ErrorUtils && typeof ErrorUtils.getGlobalHandler === 'function') {
  try {
    originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        // Log error in development only to reduce performance impact
        if (__DEV__) {
          console.error('Global error handler:', error, isFatal);
        }
        
        // Prevent app crash by handling the error gracefully
        // The ErrorBoundary will catch React errors
        if (isFatal && originalErrorHandler) {
          // Only call original handler for truly fatal errors
          originalErrorHandler(error, isFatal);
        }
      } catch (e) {
        // If error handler itself fails, use original
        if (originalErrorHandler) {
          originalErrorHandler(error, isFatal);
        }
      }
    });
  } catch (e) {
    // If setting error handler fails, continue anyway
    if (__DEV__) {
      console.warn('Failed to set global error handler:', e);
    }
  }
}

// Handle unhandled promise rejections
if (typeof global !== 'undefined' && !global.HermesInternal) {
  const originalUnhandledRejection = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    try {
      if (__DEV__) {
        console.warn('Unhandled promise rejection:', event?.reason || event);
      }
      // Prevent default crash behavior
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    } catch (e) {
      // Fallback to original handler if available
      if (originalUnhandledRejection) {
        originalUnhandledRejection(event);
      }
    }
  };
}

// Reduce console.log overhead in production
if (!__DEV__) {
  const noop = () => {};
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // Keep error logs but reduce others
  console.log = noop;
  console.warn = noop;
  // Keep console.error for critical errors
}
// Ensure vector icon fonts are loaded early to avoid missing icons on Android/iOS
try {
  // MaterialIcons
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const MaterialIcons = require('react-native-vector-icons/MaterialIcons').default;
  if (MaterialIcons && MaterialIcons.loadFont) {
    MaterialIcons.loadFont();
  }
  // FontAwesome5
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FA5 = require('react-native-vector-icons/FontAwesome5').default;
  if (FA5 && FA5.loadFont) {
    FA5.loadFont();
  }
} catch (_) {}
import App from './App';
import { name as appName } from './app.json';
import { getApp, initializeApp } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { displayIncomingCallNotification, configureNotificationsChannel } from './src/lib/push';
import mobileAds from 'react-native-google-mobile-ads';
import { appOpenAdManager } from './src/lib/ads';
import { backgroundTtsService } from './src/lib/backgroundTtsService';
import { backgroundServiceManager } from './src/lib/backgroundServiceManager';
import { pushBackgroundService } from './src/lib/pushBackgroundService';
import api from './src/lib/api';
import { setRemoteConfig } from './src/lib/remoteConfig';

// Suppress Firebase deprecation warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('This method is deprecated')) {
    return; // Suppress Firebase deprecation warnings
  }
  originalWarn.apply(console, args);
};

// Initialize Firebase explicitly to ensure it's ready before use
// React Native Firebase should auto-initialize from google-services.json on Android
// This helper function ensures Firebase is initialized before use
async function ensureFirebaseInitialized() {
  try {
    // Try to get the default app first (it may already be initialized)
    getApp();
    return true;
  } catch (error) {
    // Firebase should auto-initialize from google-services.json on Android
    // If it's not initialized, wait a bit and retry (native code may still be loading)
    if (__DEV__) {
      console.warn('⚠️ Firebase app not initialized yet, waiting for native initialization...');
    }
    
    // Wait for Firebase to be initialized by native code (max 3 seconds)
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        getApp();
        if (__DEV__) {
          console.log('✅ Firebase app initialized after wait');
        }
        return true;
      } catch (e) {
        // Continue waiting
      }
    }
    
    // If still not initialized, try to initialize explicitly
    try {
      // React Native Firebase should auto-initialize, but if it doesn't,
      // we can't manually initialize without config, so just log the error
      if (__DEV__) {
        console.error('❌ Firebase app not initialized after waiting');
      }
      return false;
    } catch (initError) {
      if (__DEV__) {
        console.error('❌ Failed to initialize Firebase:', initError);
      }
      return false;
    }
  }
}

// Handle Notifee background events (e.g., action presses when app is killed)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    const data = detail.notification?.data || {};
    if (data?.type === 'incoming_call') {
      const actionId = detail.pressAction?.id;
      const notificationId = detail.notification?.id;
      
      if (actionId === 'reject_call') {
        // Cancel the notification
        if (notificationId) {
          try { 
            await notifee.cancelNotification(notificationId); 
          } catch (e) {
            console.error('Error canceling notification in background:', e);
          }
        }
        
        // Emit socket event to reject the call
        try {
          const { emitCallRejection } = require('./src/lib/notificationSocketService');
          emitCallRejection(data.callerId, data.channelName, data.isAudio === 'true');
        } catch (error) {
          console.error('Error sending call rejection from background:', error);
        }
      }
      // Accept action from background cannot directly navigate; app open will be handled by foreground listener
    }
  } catch (e) {
    console.error('Error in background notification handler:', e);
  }
});

// Background message handler for when app is completely killed
// This is required for FCM to work when app is killed - it wakes up the JS runtime
// The handler delegates to pushBackgroundService which uses react-native-background-actions
// CRITICAL: This function MUST work in production builds and handle errors gracefully
const backgroundMessageHandler = async (remoteMessage) => {
  // Always try to handle the message, even if logging is disabled
  try {
    // Log in dev mode, but always process the message
    if (__DEV__) {
      console.log('📱 FCM background message received (app killed):', remoteMessage?.messageId || 'unknown');
    }
    
    // Ensure Firebase is initialized - this is critical for production
    try {
      getApp();
    } catch (firebaseError) {
      // In production, we need to handle this gracefully
      // Try to continue anyway - Firebase might auto-initialize
      if (__DEV__) {
        console.error('❌ Firebase not initialized in background handler:', firebaseError);
      }
      // Don't return early - try to handle the message anyway
    }
    
    // Ensure background service is running to handle the message
    try {
      await pushBackgroundService.ensure();
    } catch (e) {
      // Log but continue - fallback handler will work
      if (__DEV__) {
        console.error('❌ Failed to ensure background service in FCM handler:', e);
      }
    }
    
    // Import and use the FCM handler from pushBackgroundService
    // This ensures consistent handling whether app is killed or in background
    try {
      // The pushBackgroundService will handle the message via its FCM listener
      // But we also need to handle it here since the service might not have the listener set up yet
      const { handleFcmMessage } = await import('./src/lib/pushBackgroundService');
      if (handleFcmMessage) {
        await handleFcmMessage(remoteMessage);
        return; // Successfully handled
      }
    } catch (e) {
      // If import or service handler fails, fall through to direct handler
      if (__DEV__) {
        console.error('❌ Error with pushBackgroundService handler:', e);
      }
    }
    
    // Fallback: handle directly if service handler not available
    // This ensures notifications work even if the service fails
    await handleFcmMessageDirectly(remoteMessage);
    
  } catch (e) {
    // Last resort error handling - log critical errors even in production
    // This helps debug production issues
    console.error('❌ Critical error in FCM background message handler:', e?.message || e);
    
    // Try to at least show a basic notification if everything else fails
    try {
      const data = remoteMessage?.data || {};
      if (data?.title || data?.body || data?.message) {
        await notifee.displayNotification({
          title: data.title || data.senderName || 'New Message',
          body: data.body || data.message || 'You have a new message',
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
          },
          data,
        });
      }
    } catch (fallbackError) {
      // If even the fallback fails, there's nothing more we can do
      // But at least we tried
    }
  }
};

// Direct FCM message handler (fallback when service handler not available)
// CRITICAL: This must work in production builds - no __DEV__ checks that prevent execution
async function handleFcmMessageDirectly(remoteMessage) {
  try {
    const messageId = remoteMessage?.messageId || remoteMessage?.data?.messageId || 'unknown';
    const data = remoteMessage?.data || {};
    
    // If Android already displayed the notification, skip processing
    if (remoteMessage?.notification) {
      if (__DEV__) {
        console.log('📱 Android already displayed notification, skipping');
      }
      return;
    }
    
    // Ensure notification channels exist - critical for production
    try {
      await configureNotificationsChannel();
    } catch (e) {
      // Log but continue - channels might already exist
      if (__DEV__) {
        console.warn('⚠️ Failed to configure notification channels:', e);
      }
    }
    
    // Handle incoming call
    if (data.type === 'incoming_call') {
      try {
        await displayIncomingCallNotification({
          callerName: data.callerName || 'Unknown Caller',
          callerProfilePic: data.callerProfilePic || '',
          channelName: data.channelName || '',
          isAudio: String(data.isAudio) === 'true',
          callerId: data.callerId || data.from || '',
        });
        if (__DEV__) {
          console.log('✅ Incoming call notification displayed from FCM background handler');
        }
      } catch (error) {
        // Log errors even in production for debugging
        console.error('❌ Error displaying incoming call notification:', error?.message || error);
      }
      return;
    }
    
    // Handle chat messages
    if (data.type === 'chat' || data.type === 'new_message') {
      const title = data.senderName || data.title || 'New Message';
      const body = data.message || data.body || 'You have a new message';
      
      try {
        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
            sound: undefined,
          },
          data,
        });
        if (__DEV__) {
          console.log('✅ Chat notification displayed from FCM background handler');
        }
      } catch (notifyErr) {
        // Log errors even in production
        console.error('❌ Error displaying chat notification:', notifyErr?.message || notifyErr);
      }
      return;
    }
    
    // Handle general notifications
    const title = data.title || data.senderName || 'Message';
    const body = data.body || data.message || '';
    
    if (title || body) {
      try {
        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
            sound: undefined,
          },
          data,
        });
        if (__DEV__) {
          console.log('✅ Notification displayed from FCM background handler');
        }
      } catch (notifyErr) {
        // Log errors even in production
        console.error('❌ Error displaying notification:', notifyErr?.message || notifyErr);
      }
    }
  } catch (e) {
    // Always log critical errors, even in production
    console.error('❌ Error in direct FCM message handler:', e?.message || e);
  }
}

// Set up background message handler for FCM (required when app is killed)
// This ensures FCM messages are received even when app is completely closed
// CRITICAL: This MUST be called before AppRegistry.registerComponent
// and MUST work in production builds (no __DEV__ checks that prevent execution)
function setupBackgroundMessageHandler() {
  try {
    const messagingInstance = messaging();
    
    // setBackgroundMessageHandler must be called at the top level, before app registration
    // This handler runs in a headless JS context when app is killed
    messagingInstance.setBackgroundMessageHandler(backgroundMessageHandler);
    
    // Log in dev mode only, but always execute the setup
    if (__DEV__) {
      console.log('✅ FCM background message handler set (for killed app state)');
    }
  } catch (error) {
    // Always retry on error, even in production
    // Use setTimeout to avoid blocking, but ensure it executes
    setTimeout(() => {
      try {
        const messagingInstance = messaging();
        messagingInstance.setBackgroundMessageHandler(backgroundMessageHandler);
        if (__DEV__) {
          console.log('✅ FCM background message handler set (retry)');
        }
      } catch (retryError) {
        // In production, we still want to know if this fails
        // Use console.error which we keep enabled
        console.error('❌ Failed to set FCM background message handler after retry:', retryError?.message || retryError);
      }
    }, 2000);
    
    // Log initial error
    if (__DEV__) {
      console.warn('⚠️ Failed to set FCM background message handler:', error?.message || error);
    } else {
      // In production, log critical errors
      console.error('⚠️ FCM background handler setup failed:', error?.message || error);
    }
  }
}

// CRITICAL: Call the setup function at the top level, BEFORE AppRegistry
// This ensures the handler is registered before the app component is registered
setupBackgroundMessageHandler();

// Background notification handling:
// 1. When app is killed: setBackgroundMessageHandler above processes FCM messages
// 2. When app is in background: pushBackgroundService FCM listener handles messages
// 3. Both use the same handler logic for consistency

// CRITICAL: Always register the app component, even if initialization errors occurred
// This ensures the app can start and show error messages if needed
try {
  AppRegistry.registerComponent(appName, () => App);
  if (__DEV__) {
    console.log(`✅ App "${appName}" registered successfully`);
  }
} catch (error) {
  // If registration fails, log the error but don't crash
  console.error('❌ Failed to register app component:', error);
  // Try to register with a fallback error component
  try {
    const { View, Text } = require('react-native');
    const FallbackApp = () => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>App Registration Error</Text>
        <Text style={{ color: '#fff', fontSize: 14 }}>{error?.message || 'Unknown error'}</Text>
      </View>
    );
    AppRegistry.registerComponent(appName, () => FallbackApp);
  } catch (fallbackError) {
    console.error('❌ Failed to register fallback app component:', fallbackError);
  }
}

// Headless JS task to keep background JS alive (triggered by KeepAliveService)
AppRegistry.registerHeadlessTask('KeepAliveTask', () => async () => {
  try {
    // Ensure background JS loop/service comes up
    await pushBackgroundService.ensure();
    // Initialize TTS in case it is needed immediately
    try { await backgroundTtsService.initialize(); } catch (e) {}
  } catch (e) {
    // no-op
  }
});

// Initialize Mobile Ads SDK and show App Open Ad at cold start if enabled by server
(async () => {
  try {
    // Add timeout to prevent hanging on slow networks
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Config fetch timeout')), 5000)
    );
    
    const res = await Promise.race([
      api.get('/connect/'),
      timeoutPromise
    ]);
    
    try { 
      setRemoteConfig(res?.data || null); 
    } catch (_) {}
    
    const shouldShowAds = Boolean(res?.data?.showAds);
    if (!shouldShowAds) return;

    mobileAds()
      .initialize()
      .then(() => {
        try {
          appOpenAdManager.preloadAndShowOnLoad();
        } catch (e) {
          if (__DEV__) {
            console.warn('Error preloading app open ad:', e);
          }
        }
      })
      .catch((e) => {
        if (__DEV__) {
          console.warn('Error initializing mobile ads:', e);
        }
      });
  } catch (e) {
    // If config fetch fails, skip ad initialization silently
    if (__DEV__) {
      console.warn('Config fetch failed, skipping ad initialization:', e?.message);
    }
  }
})();

// Ensure notification channels exist as soon as the JS runtime starts
// Use a delayed initialization to ensure React Native is ready
(async () => {
  try {
    // Wait a bit for React Native to fully initialize, especially in background processes
    // This prevents null context errors when accessing native modules
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Retry logic for notification channel configuration
    let retries = 3;
    let configured = false;
    while (retries > 0 && !configured) {
      try {
        await configureNotificationsChannel();
        configured = true;
      } catch (e) {
        retries--;
        if (retries > 0) {
          // Wait a bit longer before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          if (__DEV__) {
            console.warn('⚠️ Failed to configure notification channels after retries, will retry on next app start');
          }
        }
      }
    }
    
    // Stop any currently playing TTS immediately
    try {
      await backgroundTtsService.stopSpeaking();
    } catch (e) {
      // Ignore errors silently
    }
    // Initialize background TTS service
    try {
      await backgroundTtsService.initialize();
    } catch (e) {
      if (__DEV__) {
        console.warn('⚠️ Failed to initialize background TTS service:', e);
      }
    }
    // Stop TTS after initialization to ensure it's not playing
    try {
      await backgroundTtsService.stopSpeaking();
    } catch (e) {
      // Ignore errors silently
    }
    // Initialize background service manager
    try {
      await backgroundServiceManager.initialize();
    } catch (e) {
      if (__DEV__) {
        console.warn('⚠️ Failed to initialize background service manager:', e);
      }
    }
    // Also directly ensure background actions is running
    try { 
      await pushBackgroundService.ensure(); 
    } catch (e) {
      if (__DEV__) {
        console.warn('⚠️ Failed to ensure background service:', e);
      }
    }
  } catch (e) {
    if (__DEV__) {
      console.error('Error initializing background services:', e);
    }
  }
})();
