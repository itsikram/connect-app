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

// Background handler: show a notification when message received in background/quit
messaging().setBackgroundMessageHandler(async remoteMessage => {
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
    data: remoteMessage?.data || {},
  });
});

AppRegistry.registerComponent(appName, () => App);
