/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import 'react-native-reanimated';
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
import messaging from '@react-native-firebase/messaging';
import { getApp, initializeApp } from '@react-native-firebase/app';
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
// This check ensures Firebase is ready before we use it
let firebaseInitialized = false;
try {
  // Try to get the default app first (it may already be initialized)
  getApp();
  firebaseInitialized = true;
  console.log('✅ Firebase app already initialized');
} catch (error) {
  // Firebase should auto-initialize from google-services.json on Android
  // If it's not initialized, log the error but don't fail
  console.warn('⚠️ Firebase app not initialized yet:', error.message);
  // Firebase will be initialized when the native code loads
  // We'll check again when we actually need to use it
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

// Background handler: show a notification when message received in background/quit
// Ensure Firebase is initialized before setting the handler
// Note: On Android, Firebase auto-initializes from google-services.json
// The background handler will check Firebase initialization when it runs
try {
  // Check if Firebase is initialized before setting the handler
  getApp();
  console.log('✅ Firebase initialized before setting background message handler');
  firebaseInitialized = true;
} catch (error) {
  console.warn('⚠️ Firebase not initialized before setting background message handler:', error.message);
  // Firebase should auto-initialize from google-services.json on Android
  // The handler will check again when it runs
}

// Set the background message handler
// This must be called at the top level, not inside a function
try {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    // Ensure Firebase is initialized in the background handler
    try {
      getApp();
    } catch (firebaseError) {
      console.error('❌ Firebase not initialized in background handler:', firebaseError);
      // Return early if Firebase is not initialized
      return;
    }
    
    console.log('📱 Background message received:', remoteMessage?.messageId);
    
    await configureNotificationsChannel();
    // Ensure background actions service is running to keep JS alive
    try { await pushBackgroundService.ensure(); } catch (e) {}
    // Ensure TTS is initialized in headless/background context
    try { await backgroundTtsService.initialize(); } catch (e) { console.error('❌ TTS init in BG failed:', e); }
    const data = remoteMessage?.data || {};
    
    // Stop any currently playing TTS
    try {
      await backgroundTtsService.stopSpeaking();
    } catch (e) {
      // Ignore errors when stopping
    }
    
    // Speak message directly via FCM when app is killed - DISABLED
    if (data.type === 'speak_message' || data.type === 'speak-message') {
      // TTS disabled - no longer speaking messages
      console.log('🔇 TTS disabled - skipping speak_message');
      return;
    }
    
    // Handle incoming call notifications with highest priority
    if (data.type === 'incoming_call') {
      console.log('📞 Processing incoming call in background:', {
        callerName: data.callerName,
        isAudio: data.isAudio,
        callerId: data.callerId || data.from,
      });
      
      // TTS disabled - no longer speaking incoming calls
      // try {
      //   await backgroundTtsService.speakIncomingCall(
      //     data.callerName || 'Unknown Caller',
      //     String(data.isAudio) === 'true'
      //   );
      // } catch (ttsError) {
      //   console.error('❌ Error speaking incoming call:', ttsError);
      // }
      
      // Import and use the call notification service
      try {
        const { callNotificationService } = require('./src/lib/callNotificationService');
        await callNotificationService.displayIncomingCallNotification({
          callerName: data.callerName || 'Unknown Caller',
          callerProfilePic: data.callerProfilePic || '',
          channelName: data.channelName || '',
          isAudio: String(data.isAudio) === 'true',
          callerId: data.callerId || data.from || '',
        });
        
        console.log('✅ Incoming call notification displayed from background');
      } catch (error) {
        console.error('❌ Error displaying incoming call notification from background:', error);
        // Fallback to original method
        await displayIncomingCallNotification({
          callerName: data.callerName || 'Unknown Caller',
          callerProfilePic: data.callerProfilePic || '',
          channelName: data.channelName || '',
          isAudio: String(data.isAudio) === 'true',
          callerId: data.callerId || data.from || '',
        });
      }
      
      return;
    }
    
    // Handle new message notifications
    if (data.type === 'new_message') {
      console.log('💬 Processing new message in background:', {
        senderName: data.senderName,
        message: data.message?.substring(0, 50) + '...',
      });
      
      // TTS disabled - no longer speaking new messages
      // try {
      //   await backgroundTtsService.speakNewMessage(
      //     data.senderName || 'Someone',
      //     data.message || 'New message received'
      //   );
      // } catch (ttsError) {
      //   console.error('❌ Error speaking new message:', ttsError);
      // }
    }
    
    // Handle chat messages (when app is closed)
    if (data.type === 'chat') {
      console.log('💬 Processing chat message in background:', {
        senderName: data.senderName,
        message: data.message?.substring(0, 50) + '...',
      });
      
      // Extract title and body for chat messages
      const chatTitle = remoteMessage?.notification?.title || data.senderName || data.title || 'New Message';
      const chatBody = remoteMessage?.notification?.body || data.message || data.body || 'You have a new message';
      
      // TTS disabled - no longer speaking chat messages
      // try {
      //   await backgroundTtsService.speakNewMessage(
      //     data.senderName || chatTitle,
      //     chatBody
      //   );
      // } catch (ttsError) {
      //   console.error('❌ Error speaking chat message:', ttsError);
      // }
      
      // Display notification with proper body
      try {
        await configureNotificationsChannel();
        await notifee.displayNotification({
          title: chatTitle,
          body: chatBody,
          android: {
            channelId: 'default',
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default' },
            sound: undefined, // No sound
          },
          data,
        });
        console.log('✅ Chat notification displayed:', chatTitle, chatBody);
        return; // Return early to avoid duplicate notification
      } catch (notifyErr) {
        console.error('❌ Error displaying chat notification:', notifyErr);
      }
    }
    
    // Handle other notification types
    const title = remoteMessage?.notification?.title || data.title || data.senderName || 'Message';
    const body = remoteMessage?.notification?.body || data.body || data.message || '';

    // TTS disabled - no longer speaking general notifications
    // if (data.type === 'notification' || data.type === 'general' || (!data.type && (title || body))) {
    //   try {
    //     await backgroundTtsService.speakNotification(title, body, { priority: 'normal' });
    //   } catch (ttsError) {
    //     console.error('❌ Error speaking notification:', ttsError);
    //   }
    // }

    // Always display a visible notification for background messages so users see it even when app is quit
    try {
      await configureNotificationsChannel();
      await notifee.displayNotification({
        title,
        body,
        android: {
          channelId: 'default',
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default' },
          sound: undefined, // No sound
        },
        data,
      });
      console.log('✅ Background notification displayed:', title);
    } catch (notifyErr) {
      console.error('❌ Error displaying background notification:', notifyErr);
    }
  } catch (e) {
    console.error('❌ Error in background message handler:', e);
  }
  });
} catch (error) {
  console.error('❌ Failed to set background message handler:', error);
  // If Firebase is not initialized, the handler will fail
  // This is expected if Firebase hasn't been initialized yet
}

AppRegistry.registerComponent(appName, () => App);

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
    const res = await api.get('/connect/');
    try { setRemoteConfig(res?.data || null); } catch (_) {}
    const shouldShowAds = Boolean(res?.data?.showAds);
    if (!shouldShowAds) return;

    mobileAds()
      .initialize()
      .then(() => {
        try {
          appOpenAdManager.preloadAndShowOnLoad();
        } catch (e) {}
      });
  } catch (e) {
    // If config fetch fails, skip ad initialization silently
  }
})();

// Ensure notification channels exist as soon as the JS runtime starts
(async () => {
  try { 
    await configureNotificationsChannel(); 
    // Stop any currently playing TTS immediately
    try {
      await backgroundTtsService.stopSpeaking();
    } catch (e) {
      // Ignore errors
    }
    // Initialize background TTS service
    await backgroundTtsService.initialize();
    // Stop TTS after initialization to ensure it's not playing
    try {
      await backgroundTtsService.stopSpeaking();
    } catch (e) {
      // Ignore errors
    }
    // Initialize background service manager
    await backgroundServiceManager.initialize();
    // Also directly ensure background actions is running
    try { await pushBackgroundService.ensure(); } catch (e) {}
  } catch (e) {
    console.error('Error initializing background services:', e);
  }
})();
