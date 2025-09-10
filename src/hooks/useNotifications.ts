import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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

  useEffect(() => {
    let isInitialized = false;

    const initialize = async () => {
      if (isInitialized) return;
      
      try {
        // Initialize notifications
        const success = await initializeNotifications();
        if (!success) {
          console.warn('Failed to initialize notifications');
          return;
        }

        // Set up listeners
        const unsubscribeForeground = listenForegroundMessages();
        const unsubscribeEvents = listenNotificationEvents(navigate);
        const unsubscribeTokenRefresh = listenTokenRefresh();

        // Store unsubscribe functions
        unsubscribeRefs.current = [
          unsubscribeForeground,
          unsubscribeEvents,
          unsubscribeTokenRefresh,
        ];

        isInitialized = true;
        console.log('Notification listeners set up successfully');
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    // Initialize when app becomes active
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        initialize();
      } else if (nextAppState === 'background') {
        // Cancel any ongoing call notifications when app goes to background
        cancelIncomingCallNotifications();
      }
    };

    // Set up app state listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initialize immediately
    initialize();

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
  }, [navigate]);

  return {
    cancelIncomingCallNotifications,
  };
};

