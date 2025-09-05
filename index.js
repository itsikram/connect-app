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
