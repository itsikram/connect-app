/**
 * CallNotificationService - Service to handle incoming call notifications
 * Made compatible with Expo Go by making Notifee optional
 */

import { Platform, AppState } from 'react-native';
// Notifee imports made optional for Expo Go compatibility
let notifee: any = null;
let AndroidImportance: any = null;
let AndroidVisibility: any = null;
let AndroidCategory: any = null;
let EventType: any = null;

try {
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default;
  AndroidImportance = notifeeModule.AndroidImportance;
  AndroidVisibility = notifeeModule.AndroidVisibility;
  AndroidCategory = notifeeModule.AndroidCategory;
  EventType = notifeeModule.EventType;
} catch (error) {
  console.log('Notifee not available in callNotificationService - using fallback');
}

import { openIncomingCallScreen, bringAppToForeground } from './CallNotificationBridge';

// Service to handle incoming call notifications with better reliability
export class CallNotificationService {
  private static instance: CallNotificationService;
  private isServiceRunning = false;
  private notificationId: string | null = null;

  static getInstance(): CallNotificationService {
    if (!CallNotificationService.instance) {
      CallNotificationService.instance = new CallNotificationService();
    }
    return CallNotificationService.instance;
  }

  // Display incoming call notification with enhanced settings
  async displayIncomingCallNotification(payload: {
    callerName: string;
    callerProfilePic?: string;
    channelName: string;
    isAudio: boolean;
    callerId: string;
  }): Promise<void> {
    try {
      // Cancel any existing call notification
      await this.cancelIncomingCallNotification();

      // Create notification ID
      this.notificationId = `incoming_call_${payload.callerId}_${Date.now()}`;

      // Configure notification channel for calls
      if (notifee) {
        await this.configureCallNotificationChannel();
      }

      // Request permissions
      if (Platform.OS === 'android' && notifee) {
        await notifee.requestPermission({
          alert: true,
          badge: true,
          sound: true,
        });
      }

      // Try to use native bridge first for better reliability
      if (Platform.OS === 'android') {
        try {
          await openIncomingCallScreen({
            callerId: payload.callerId,
            callerName: payload.callerName,
            callerProfilePic: payload.callerProfilePic,
            channelName: payload.channelName,
            isAudio: payload.isAudio,
          });
          console.log('✅ Successfully opened incoming call screen via native bridge');
          this.isServiceRunning = true;
          return;
        } catch (error) {
          console.warn('Native bridge failed, falling back to notification:', error);
        }
      }

      // Fallback to notification-based approach
      if (notifee) {
        await notifee.displayNotification({
          id: this.notificationId,
          title: payload.isAudio ? '📞 Incoming Audio Call' : '📹 Incoming Video Call',
          body: `Call from ${payload.callerName}`,
          android: {
            channelId: 'incoming_calls',
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            category: AndroidCategory.CALL,
            pressAction: {
              id: 'accept_call',
            },
            actions: [
              {
                title: 'Accept',
                pressAction: {
                  id: 'accept_call',
                },
              },
              {
                title: 'Decline',
                pressAction: {
                  id: 'decline_call',
                  launchActivity: 'default',
                },
              },
            ],
            sound: 'default',
            autoCancel: false,
            ongoing: true,
          },
          data: {
            type: 'incoming_call',
            callerId: payload.callerId,
            callerName: payload.callerName,
            channelName: payload.channelName,
            isAudio: payload.isAudio,
          },
        });
      }
      
      this.isServiceRunning = true;
      console.log('✅ Call notification displayed successfully');
    } catch (error) {
      console.error('❌ Error displaying incoming call notification:', error);
      this.isServiceRunning = false;
    }
  }

  // Configure dedicated notification channel for incoming calls
  private async configureCallNotificationChannel(): Promise<void> {
    if (!notifee) return;
    
    try {
      await notifee.createChannel({
        id: 'incoming_calls',
        name: 'Incoming Calls',
        description: 'Full-screen incoming call notifications',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
      });
    } catch (error) {
      console.error('Error configuring call notification channel:', error);
    }
  }

  // Cancel incoming call notification
  async cancelIncomingCallNotification(): Promise<void> {
    try {
      if (this.notificationId && notifee) {
        await notifee.cancelNotification(this.notificationId);
        this.notificationId = null;
      }
      
      // Also cancel any other incoming call notifications
      if (notifee) {
        const notifications = await notifee.getDisplayedNotifications();
        for (const notification of notifications) {
          if (notification.notification?.data?.type === 'incoming_call' && notification.id) {
            await notifee.cancelNotification(notification.id);
          }
        }
      }
      
      this.isServiceRunning = false;
      console.log('✅ Call notification cancelled');
    } catch (error) {
      console.error('Error cancelling incoming call notification:', error);
    }
  }

  // Check if service is currently running
  isNotificationServiceRunning(): boolean {
    return this.isServiceRunning;
  }

  // Get current notification ID
  getCurrentNotificationId(): string | null {
    return this.notificationId;
  }
}

export default CallNotificationService;
