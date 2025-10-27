import React, { useCallback } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { navigate as globalNavigate } from '../lib/navigationService';

const NotificationSetup: React.FC = () => {
  // Memoize the navigate function to prevent unnecessary re-renders
  const navigate = useCallback((screen: string, params?: any) => {
    try {
      globalNavigate(screen, params);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, []);

  const { cancelIncomingCallNotifications } = useNotifications({
    navigate,
  });

  // This component doesn't render anything, it just sets up notifications
  return null;
};

export default NotificationSetup;

