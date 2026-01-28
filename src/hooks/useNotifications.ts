import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  initializeNotifications,
  getNotificationToken,
  saveNotificationToken,
  configureNotificationsChannel,
} from '../lib/pushExpo';

interface UseNotificationsProps {
  navigate: (screen: string, params?: any) => void;
}

export const useNotifications = ({ navigate }: UseNotificationsProps) => {
  const unsubscribeRefs = useRef<Array<() => void>>([]);
  const isInitializedRef = useRef<boolean>(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  // Memoize the navigate function to prevent unnecessary re-renders
  const memoizedNavigate = useCallback(navigate, []);

  // Cancel incoming call notifications
  const cancelIncomingCallNotifications = useCallback(async () => {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current || initializationPromiseRef.current) {
      return;
    }

    const initialize = async () => {
      if (isInitializedRef.current) return;
      
      try {
        // Initialize notifications
        await initializeNotifications();

        // Configure notification channels
        await configureNotificationsChannel();

        // Get and save notification token
        const token = await getNotificationToken();
        if (token) {
          await saveNotificationToken(token);
        }

        // Set up notification listeners
        const unsubscribeForeground = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (data && (data as any).type === 'incoming_call') {
            memoizedNavigate('Message', {
              screen: 'IncomingCall',
              params: {
                callerId: (data as any).callerId,
                callerName: (data as any).callerName,
                callerProfilePic: (data as any).callerProfilePic,
                channelName: (data as any).channelName,
                isAudio: String((data as any).isAudio) === 'true',
                autoAccept: response.actionIdentifier === 'accept_call',
              },
            });
          }
        });

        // Store unsubscribe functions
        unsubscribeRefs.current = [
          () => unsubscribeForeground.remove(),
        ];

        isInitializedRef.current = true;
        console.log('Expo notification listeners set up successfully');

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
  }, [memoizedNavigate, cancelIncomingCallNotifications]);

  return {
    cancelIncomingCallNotifications,
  };
};

