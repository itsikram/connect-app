/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import '@react-native-firebase/app';
import notifee from '@notifee/react-native';
import { displayIncomingCallNotification, configureNotificationsChannel } from './src/lib/push';
import mobileAds from 'react-native-google-mobile-ads';
import { appOpenAdManager } from './src/lib/ads';

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
    await configureNotificationsChannel();
    const data = remoteMessage?.data || {};
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
    const title = remoteMessage?.notification?.title || 'Message';
    const body = remoteMessage?.notification?.body || '';
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
  } catch (e) {}
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
  try { await configureNotificationsChannel(); } catch (e) {}
})();
