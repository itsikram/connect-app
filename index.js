/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import 'react-native-reanimated';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import notifee from '@notifee/react-native';
import { displayIncomingCallNotification, configureNotificationsChannel } from './src/lib/push';
import mobileAds from 'react-native-google-mobile-ads';
import { appOpenAdManager } from './src/lib/ads';
import { backgroundTtsService } from './src/lib/backgroundTtsService';
import { backgroundServiceManager } from './src/lib/backgroundServiceManager';
import { pushBackgroundService } from './src/lib/pushBackgroundService';

// Suppress Firebase deprecation warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('This method is deprecated')) {
    return; // Suppress Firebase deprecation warnings
  }
  originalWarn.apply(console, args);
};

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
messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    console.log('📱 Background message received:', remoteMessage?.messageId);
    
    await configureNotificationsChannel();
    // Ensure background actions service is running to keep JS alive
    try { await pushBackgroundService.ensure(); } catch (e) {}
    // Ensure TTS is initialized in headless/background context
    try { await backgroundTtsService.initialize(); } catch (e) { console.error('❌ TTS init in BG failed:', e); }
    const data = remoteMessage?.data || {};
    
    // Speak message directly via FCM when app is killed
    if (data.type === 'speak_message' || data.type === 'speak-message') {
      const message = data.message || data.text || data.body || '';
      if (message && message.trim().length > 0) {
        try {
          const priority = data.priority === 'high' ? 'high' : (data.priority === 'low' ? 'low' : 'normal');
          const interrupt = String(data.interrupt ?? 'true') !== 'false';
          await backgroundTtsService.speakMessage(message, { priority, interrupt });
          console.log('🔊 Spoke message from background FCM');
        } catch (ttsError) {
          console.error('❌ Error speaking FCM speak_message:', ttsError);
        }
      }
      return;
    }
    
    // Handle incoming call notifications with highest priority
    if (data.type === 'incoming_call') {
      console.log('📞 Processing incoming call in background:', {
        callerName: data.callerName,
        isAudio: data.isAudio,
        callerId: data.callerId || data.from,
      });
      
      // Speak incoming call notification
      try {
        await backgroundTtsService.speakIncomingCall(
          data.callerName || 'Unknown Caller',
          String(data.isAudio) === 'true'
        );
      } catch (ttsError) {
        console.error('❌ Error speaking incoming call:', ttsError);
      }
      
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
      
      // Speak new message notification
      try {
        await backgroundTtsService.speakNewMessage(
          data.senderName || 'Someone',
          data.message || 'New message received'
        );
      } catch (ttsError) {
        console.error('❌ Error speaking new message:', ttsError);
      }
    }
    
    // Handle other notification types
    const title = remoteMessage?.notification?.title || 'Message';
    const body = remoteMessage?.notification?.body || '';
    
    // Speak general notifications
    if (data.type === 'notification' || data.type === 'general') {
      try {
        await backgroundTtsService.speakNotification(title, body, { priority: 'normal' });
      } catch (ttsError) {
        console.error('❌ Error speaking notification:', ttsError);
      }
    }
    
    // await notifee.displayNotification({
    //   title,
    //   body,
    //   android: {
    //     channelId: 'default',
    //     smallIcon: 'ic_launcher',
    //     pressAction: { id: 'default' },
    //   },
    //   data,
    // });
    
    console.log('✅ Background notification displayed:', title);
  } catch (e) {
    console.error('❌ Error in background message handler:', e);
  }
});

AppRegistry.registerComponent(appName, () => App);

// Initialize Mobile Ads SDK and show App Open Ad at cold start
// mobileAds()
//   .initialize()
//   .then(() => {
//     try {
//       appOpenAdManager.preloadAndShowOnLoad();
//     } catch (e) {}
//   });

// Ensure notification channels exist as soon as the JS runtime starts
(async () => {
  try { 
    await configureNotificationsChannel(); 
    // Initialize background TTS service
    await backgroundTtsService.initialize();
    // Initialize background service manager
    await backgroundServiceManager.initialize();
    // Also directly ensure background actions is running
    try { await pushBackgroundService.ensure(); } catch (e) {}
  } catch (e) {
    console.error('Error initializing background services:', e);
  }
})();
