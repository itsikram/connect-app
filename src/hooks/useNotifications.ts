import { useEffect, useRef, useCallback } from 'react';
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

