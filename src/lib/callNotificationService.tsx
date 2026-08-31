/**
 * CallNotificationService - Service to handle incoming call notifications
 * Made compatible with Expo Go by making Notifee optional
 */

import { AppState, Platform } from 'react-native';
import {
  getIncomingCallChannelId,
  getRingtoneSoundName,
  getStoredRingtoneId,
  MAX_RINGTONE_ID,
  normalizeRingtoneId,
} from './ringtoneAssets';

let notifee: any = null;
let AndroidImportance: any = null;
let AndroidVisibility: any = null;
let AndroidCategory: any = null;
let AndroidForegroundServiceType: any = null;

try {
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default;
  AndroidImportance = notifeeModule.AndroidImportance;
  AndroidVisibility = notifeeModule.AndroidVisibility;
  AndroidCategory = notifeeModule.AndroidCategory;
  AndroidForegroundServiceType = notifeeModule.AndroidForegroundServiceType;
} catch (error) {
  console.log('Notifee not available in callNotificationService - using fallback');
}

export class CallNotificationService {
  private static instance: CallNotificationService;
  private isServiceRunning = false;
  private notificationId: string | null = null;
  private startedForegroundService = false;

  static getInstance(): CallNotificationService {
    if (!CallNotificationService.instance) {
      CallNotificationService.instance = new CallNotificationService();
    }
    return CallNotificationService.instance;
  }

  async displayIncomingCallNotification(payload: {
    callerName: string;
    callerProfilePic?: string;
    channelName: string;
    isAudio: boolean;
    callerId: string;
    ringtoneId?: string;
  }): Promise<void> {
    if (!notifee || Platform.OS !== 'android') {
      return;
    }

    try {
      const nextId = `incoming_call_${payload.channelName || payload.callerId}`;
      if (this.notificationId === nextId && this.isServiceRunning) {
        return;
      }

      await this.cancelIncomingCallNotification();

      this.notificationId = nextId;

      const ringtoneId = normalizeRingtoneId(payload.ringtoneId || (await getStoredRingtoneId()));
      const channelId = getIncomingCallChannelId(ringtoneId);
      const soundName = getRingtoneSoundName(ringtoneId);
      const inForeground = AppState.currentState === 'active';

      await this.configureCallNotificationChannel(ringtoneId);

      try {
        await notifee.requestPermission();
      } catch (_) {}

      const mediaPlaybackType =
        AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
      const foregroundServiceTypes = mediaPlaybackType != null ? [mediaPlaybackType] : [];

      await notifee.displayNotification({
        id: this.notificationId,
        title: payload.isAudio ? 'Incoming audio call' : 'Incoming video call',
        body: `${payload.callerName || 'Someone'} is calling`,
        android: {
          channelId,
          importance: AndroidImportance?.MAX ?? AndroidImportance?.HIGH,
          visibility: AndroidVisibility?.PUBLIC,
          category: AndroidCategory?.CALL,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          fullScreenAction: {
            id: 'incoming_call_fullscreen',
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
              title: 'Decline',
          pressAction: {
            id: 'decline_call',
          },
            },
          ],
          sound: inForeground ? undefined : soundName,
          loopSound: !inForeground,
          asForegroundService: !inForeground,
          lightUpScreen: true,
          autoCancel: false,
          ongoing: true,
          vibrationPattern: [0, 400, 200, 400, 200, 400],
          ...(foregroundServiceTypes.length
            ? { foregroundServiceTypes }
            : {}),
        },
        data: {
          type: 'incoming_call',
          callerId: payload.callerId,
          callerName: payload.callerName || '',
          callerProfilePic: payload.callerProfilePic || '',
          channelName: payload.channelName,
          isAudio: payload.isAudio ? 'true' : 'false',
          ringtoneId,
        },
      });

      this.startedForegroundService = !inForeground;
      this.isServiceRunning = true;
    } catch (error) {
      console.error('❌ Error displaying incoming call notification:', error);
      this.isServiceRunning = false;
      this.startedForegroundService = false;
      throw error;
    }
  }

  private async configureCallNotificationChannel(ringtoneId?: string): Promise<void> {
    if (!notifee) return;

    try {
      const selectedId = normalizeRingtoneId(ringtoneId || (await getStoredRingtoneId()));
      for (let i = 1; i <= MAX_RINGTONE_ID; i += 1) {
        const id = String(i);
        await notifee.createChannel({
          id: getIncomingCallChannelId(id),
          name: 'Incoming Calls',
          description: 'Full-screen incoming call notifications',
          importance: AndroidImportance.MAX ?? AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: getRingtoneSoundName(id),
          vibration: true,
          vibrationPattern: [0, 400, 200, 400, 200, 400],
          bypassDnd: true,
          lights: true,
          lightColor: '#E53935',
        });
      }
      await notifee.createChannel({
        id: 'incoming_calls',
        name: 'Incoming Calls',
        description: 'Full-screen incoming call notifications',
          importance: AndroidImportance.MAX ?? AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: getRingtoneSoundName(selectedId),
        vibration: true,
        vibrationPattern: [0, 400, 200, 400, 200, 400],
        bypassDnd: true,
        lights: true,
        lightColor: '#E53935',
      });
    } catch (error) {
      console.error('Error configuring call notification channel:', error);
    }
  }

  async cancelIncomingCallNotification(): Promise<void> {
    try {
      if (this.startedForegroundService && notifee?.stopForegroundService) {
        try {
          await notifee.stopForegroundService();
        } catch (_) {}
        this.startedForegroundService = false;
      }

      if (this.notificationId && notifee) {
        await notifee.cancelNotification(this.notificationId);
        this.notificationId = null;
      }

      if (notifee) {
        const notifications = await notifee.getDisplayedNotifications();
        for (const notification of notifications) {
          if (notification.notification?.data?.type === 'incoming_call' && notification.id) {
            await notifee.cancelNotification(notification.id);
          }
        }
      }

      this.isServiceRunning = false;
    } catch (error) {
      console.error('Error cancelling incoming call notification:', error);
    }
  }

  isNotificationServiceRunning(): boolean {
    return this.isServiceRunning;
  }

  getCurrentNotificationId(): string | null {
    return this.notificationId;
  }
}

export const callNotificationService = CallNotificationService.getInstance();
export default CallNotificationService;
