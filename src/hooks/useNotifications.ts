import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { 
  initializeNotifications, 
  listenForegroundMessages, 
  listenNotificationEvents, 
  listenTokenRefresh,
  cancelIncomingCallNotifications 
} from '../lib/push';

interface UseNotificationsProps {
  navigate: (screen: string, params?: any) => void;
}

export const useNotifications = ({ navigate }: UseNotificationsProps) => {
  const unsubscribeRefs = useRef<Array<() => void>>([]);
  const isInitializedRef = useRef<boolean>(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  // Memoize the navigate function to prevent unnecessary re-renders
  const memoizedNavigate = useCallback(navigate, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current || initializationPromiseRef.current) {
      return;
    }

    const initialize = async () => {
      if (isInitializedRef.current) return;
      
      try {
        // Initialize notifications
        const success = await initializeNotifications();
        if (!success) {
          console.warn('Failed to initialize notifications');
          return;
        }

        // Set up listeners
        const unsubscribeForeground = listenForegroundMessages();
        const unsubscribeEvents = listenNotificationEvents(memoizedNavigate);
        const unsubscribeTokenRefresh = listenTokenRefresh();

        // Store unsubscribe functions
        unsubscribeRefs.current = [
          unsubscribeForeground,
          unsubscribeEvents,
          unsubscribeTokenRefresh,
        ];

        isInitializedRef.current = true;
        console.log('Notification listeners set up successfully');

        // Handle cold start (app opened by tapping a call notification)
        try {
          // 1) Notifee initial notification (actions and presses)
          const initial = await notifee.getInitialNotification();
          if (initial?.notification?.data && (initial.notification.data as any).type === 'incoming_call') {
            const data = initial.notification.data as any;
            const actionId = initial.pressAction?.id;
            memoizedNavigate('Message', {
              screen: 'IncomingCall',
              params: {
                callerId: data.callerId,
                callerName: data.callerName,
                callerProfilePic: data.callerProfilePic,
                channelName: data.channelName,
                isAudio: String(data.isAudio) === 'true',
                autoAccept: actionId === 'accept_call',
              },
            });
          }

          // 2) FCM initial notification (if app launched from system tray)
          const initialMsg = await messaging().getInitialNotification();
          const initialData = (initialMsg?.data || {}) as Record<string, string>;
          if (initialData.type === 'incoming_call') {
            memoizedNavigate('Message', {
              screen: 'IncomingCall',
              params: {
                callerId: initialData.callerId || initialData.from || '',
                callerName: initialData.callerName || 'Unknown',
                callerProfilePic: initialData.callerProfilePic || '',
                channelName: initialData.channelName || '',
                isAudio: String(initialData.isAudio) === 'true',
              },
            });
          }
        } catch (e) {
          console.error('Error handling initial notification:', e);
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      } finally {
        initializationPromiseRef.current = null;
      }
    };

    // Initialize when app becomes active
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !isInitializedRef.current) {
        if (!initializationPromiseRef.current) {
          initializationPromiseRef.current = initialize();
        }
      } else if (nextAppState === 'background') {
        // Cancel any ongoing call notifications when app goes to background
        cancelIncomingCallNotifications();
      }
    };

    // Set up app state listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initialize immediately if not already initialized
    if (!initializationPromiseRef.current) {
      initializationPromiseRef.current = initialize();
    }

    // Cleanup function
    return () => {
      subscription?.remove();
      unsubscribeRefs.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from notification listener:', error);
        }
      });
      unsubscribeRefs.current = [];
    };
  }, []); // Remove navigate dependency to prevent infinite loop

  return {
    cancelIncomingCallNotifications,
  };
};

