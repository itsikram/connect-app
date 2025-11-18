import { Platform, AppState } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
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
      // Check if app is in foreground - if so, skip notification
      const appState = AppState.currentState;
      if (appState === 'active') {
        console.log('📞 App is in foreground - skipping incoming call notification (app will handle via socket)');
        return;
      }

      console.log('📞 CallNotificationService: Displaying incoming call notification for:', payload.callerName);

      // Cancel any existing call notification
      await this.cancelIncomingCallNotification();

      // Create notification ID
      this.notificationId = `incoming_call_${payload.callerId}_${Date.now()}`;

      // Configure notification channel for calls
      await this.configureCallNotificationChannel();

      // Request permissions
      if (Platform.OS === 'android') {
        await notifee.requestPermission({
          alert: true,
          badge: true,
          sound: true,
        });
      }

      // Try to use native bridge first for better reliability
      if (Platform.OS === 'android') {
        try {
          const success = await openIncomingCallScreen({
            callerId: payload.callerId,
            callerName: payload.callerName,
            callerProfilePic: payload.callerProfilePic,
            channelName: payload.channelName,
            isAudio: payload.isAudio,
            autoAccept: false,
          });
          
          if (success) {
            console.log('✅ Successfully opened incoming call screen via native bridge');
            this.isServiceRunning = true;
            return;
          }
        } catch (error) {
          console.warn('Native bridge failed, falling back to notification:', error);
        }
      }

      // Fallback to notification-based approach
      await notifee.displayNotification({
        id: this.notificationId,
        title: payload.isAudio ? '📞 Incoming Audio Call' : '📹 Incoming Video Call',
        body: `Call from ${payload.callerName}`,
        android: {
          channelId: 'incoming_calls',
          category: AndroidCategory.CALL,
          colorized: true,
          color: '#4CAF50',
          // Full screen action to bring app to foreground
          fullScreenAction: {
            id: 'incoming_call_fullscreen',
            launchActivity: 'default',
          },
          // Maximum priority settings
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          smallIcon: 'ic_launcher',
          largeIcon: payload.callerProfilePic || undefined,
          // Default press action
          pressAction: {
            id: 'open_incoming_call',
            launchActivity: 'default',
          },
          // Action buttons
          actions: [
            {
              title: '✅ Accept',
              pressAction: {
                id: 'accept_call',
                launchActivity: 'default',
              },
            },
            {
              title: '❌ Reject',
              pressAction: {
                id: 'reject_call',
                launchActivity: 'default',
              },
            },
          ],
          // Critical settings for incoming calls
          autoCancel: false,
          ongoing: true,
          showTimestamp: true,
          timeoutAfter: 45000, // Auto-dismiss after 45 seconds
          showChronometer: true,
          chronometerDirection: 'down',
          // Enhanced visibility settings - SOUND DISABLED
          sound: undefined, // No sound
          vibrationPattern: undefined, // No vibration
        },
        data: {
          type: 'incoming_call',
          callerId: payload.callerId,
          callerName: payload.callerName,
          callerProfilePic: payload.callerProfilePic || '',
          channelName: payload.channelName,
          isAudio: String(payload.isAudio),
          notificationId: this.notificationId,
        },
      });

      this.isServiceRunning = true;
      console.log('✅ CallNotificationService: Incoming call notification displayed successfully');

    } catch (error) {
      console.error('❌ CallNotificationService: Error displaying incoming call notification:', error);
    }
  }

  // Configure dedicated notification channel for incoming calls
  private async configureCallNotificationChannel(): Promise<void> {
    try {
      await notifee.createChannel({
        id: 'incoming_calls',
        name: 'Incoming Calls',
        description: 'Full-screen incoming call notifications',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: undefined, // No sound
        vibrationPattern: undefined, // No vibration
        bypassDnd: true, // Bypass Do Not Disturb
      });
    } catch (error) {
      console.error('Error configuring call notification channel:', error);
    }
  }

  // Cancel incoming call notification
  async cancelIncomingCallNotification(): Promise<void> {
    try {
      if (this.notificationId) {
        await notifee.cancelNotification(this.notificationId);
        this.notificationId = null;
      }
      
      // Also cancel any other incoming call notifications
      const notifications = await notifee.getDisplayedNotifications();
      for (const notification of notifications) {
        if (notification.notification?.data?.type === 'incoming_call' && notification.id) {
          await notifee.cancelNotification(notification.id);
        }
      }
      
      this.isServiceRunning = false;
      console.log('✅ CallNotificationService: Incoming call notification cancelled');
    } catch (error) {
      console.error('❌ CallNotificationService: Error cancelling notification:', error);
    }
  }

  // Check if service is running
  isRunning(): boolean {
    return this.isServiceRunning;
  }

  // Get current notification ID
  getCurrentNotificationId(): string | null {
    return this.notificationId;
  }
}

// Export singleton instance
export const callNotificationService = CallNotificationService.getInstance();
