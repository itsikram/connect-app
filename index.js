/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, AppState, ErrorUtils, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data || {};
    const isCall = data?.type === 'incoming_call';
    const inForeground = AppState.currentState === 'active';
    if (isCall && inForeground) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }
    const playOsSound = isCall && (Platform.OS === 'ios' || AppState.currentState !== 'active');
    return {
      shouldShowAlert: true,
      shouldPlaySound: playOsSound || !isCall,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: isCall
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background notification task error', error);
    return;
  }

  const payload =
    data?.notification?.request?.content?.data ||
    data?.notification?.data ||
    data?.data ||
    data ||
    {};
  if (payload?.type !== 'incoming_call') return;

  try {
    const { startIncomingCallAlert } = require('./src/lib/incomingCallAlerts');
    const { emitIncomingCallFromPush } = require('./src/lib/callEvents');
    const callerId = String(payload.callerId || payload.from || '');
    const channelName = String(payload.channelName || '');
    if (!callerId && !channelName) return;

    const callPayload = {
      callerId,
      callerName: payload.callerName || 'Someone',
      callerProfilePic: payload.callerProfilePic || '',
      channelName,
      isAudio: payload.isAudio === true || payload.isAudio === 'true',
      ringtoneId: payload.ringtoneId,
    };
    await startIncomingCallAlert(callPayload);
    emitIncomingCallFromPush({
      from: callerId,
      channelName,
      callerName: callPayload.callerName,
      callerProfilePic: callPayload.callerProfilePic,
      isAudio: callPayload.isAudio,
      ringtoneId: callPayload.ringtoneId,
    });
  } catch (taskError) {
    console.warn('Background incoming-call task failed', taskError);
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((error) => {
  console.warn('Failed to register background notification task', error);
});
// react-native-reanimated removed for Expo compatibility

// Global error handler for unhandled errors
// Check if ErrorUtils is available before using it
let originalErrorHandler = null;
if (ErrorUtils && typeof ErrorUtils.getGlobalHandler === 'function') {
  try {
    originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        // Always log errors (even in production) so we can diagnose crashes
        console.error('Global error handler:', {
          message: error?.message || String(error),
          stack: error?.stack,
          isFatal: isFatal,
          name: error?.name
        });
        
        // Prevent app crash by handling the error gracefully
        // The ErrorBoundary will catch React errors
        // Don't call original handler - it will crash the app
        // Instead, let React Native handle it gracefully or show error UI
        
        // Only in extreme cases where we absolutely must crash, call original handler
        // But try to avoid this to prevent automatic crashes
        if (isFatal && originalErrorHandler) {
          // Check if this is a truly unrecoverable error
          const errorMessage = error?.message || String(error) || '';
          const isUnrecoverable = errorMessage.includes('OutOfMemory') || 
                                  errorMessage.includes('Native module') ||
                                  errorMessage.includes('JNI');
          
          if (isUnrecoverable) {
            // Only crash for truly unrecoverable errors
            if (__DEV__) {
              console.error('Fatal unrecoverable error, calling original handler');
            }
            originalErrorHandler(error, isFatal);
          } else {
            // For other fatal errors, log but don't crash
            console.error('Fatal error caught, preventing crash:', error);
          }
        }
      } catch (e) {
        // If error handler itself fails, log but don't crash
        console.error('Error in global error handler:', e);
        // Don't call original handler here - it would cause a crash loop
      }
    });
  } catch (e) {
    // If setting error handler fails, continue anyway
    console.error('Failed to set global error handler:', e);
  }
}

// Handle unhandled promise rejections
if (typeof global !== 'undefined' && !global.HermesInternal) {
  const originalUnhandledRejection = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    try {
      // Always log promise rejections to diagnose issues
      const reason = event?.reason || event;
      console.error('Unhandled promise rejection:', {
        message: reason?.message || String(reason),
        stack: reason?.stack,
        error: reason
      });
      
      // Prevent default crash behavior
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    } catch (e) {
      // Log but don't crash if error handler fails
      console.error('Error in unhandled rejection handler:', e);
      // Don't call original handler - it might crash
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
  const MaterialIcons = require('@expo/vector-icons/MaterialIcons').default;
  if (MaterialIcons && MaterialIcons.loadFont) {
    MaterialIcons.loadFont();
  }
  // FontAwesome5
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FA5 = require('@expo/vector-icons/FontAwesome5').default;
  if (FA5 && FA5.loadFont) {
    FA5.loadFont();
  }
} catch (_) {}
import App from './App';
import { registerRootComponent } from 'expo';

try {
  const notifeeModule = require('@notifee/react-native');
  const notifee = notifeeModule.default;
  const EventType = notifeeModule.EventType;

  const handleNotifeeCallEvent = async ({ type, detail }) => {
    const data = detail?.notification?.data || {};
    if (data.type !== 'incoming_call') return false;
    const { handleIncomingCallNotificationAction } = require('./src/lib/callNotificationActions');
    const actionId = detail?.pressAction?.id;
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS || type === EventType.DISMISSED) {
      const resolvedAction =
        type === EventType.DISMISSED && !actionId ? 'decline_call' : actionId;
      await handleIncomingCallNotificationAction(data, resolvedAction);
      if (actionId === 'decline_call' || actionId === 'accept_call' || type === EventType.DISMISSED) {
        try {
          await notifee.stopForegroundService();
        } catch (_) {}
      }
      return true;
    }
    return false;
  };

  if (notifee?.registerForegroundService) {
    notifee.registerForegroundService(() => {
      return new Promise(() => {
        notifee.onForegroundEvent(async (event) => {
          try {
            await handleNotifeeCallEvent(event);
          } catch (_) {}
        });
      });
    });
  }
  if (notifee?.onBackgroundEvent) {
    notifee.onBackgroundEvent(async (event) => {
      try {
        await handleNotifeeCallEvent(event);
      } catch (_) {}
    });
  }
} catch (_) {}

registerRootComponent(App);
