import React, { useCallback } from 'react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationSetupProps {
  navigation: any;
}

const NotificationSetup: React.FC<NotificationSetupProps> = ({ navigation }) => {
  // Memoize the navigate function to prevent unnecessary re-renders
  const navigate = useCallback((screen: string, params?: any) => {
    try {
      navigation.navigate(screen, params);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigation]);

  const { cancelIncomingCallNotifications } = useNotifications({
    navigate,
  });

  // This component doesn't render anything, it just sets up notifications
  return null;
};

export default NotificationSetup;

