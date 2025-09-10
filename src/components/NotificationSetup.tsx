import React, { useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationSetupProps {
  navigation: any;
}

const NotificationSetup: React.FC<NotificationSetupProps> = ({ navigation }) => {
  const { cancelIncomingCallNotifications } = useNotifications({
    navigate: (screen: string, params?: any) => {
      try {
        navigation.navigate(screen, params);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    },
  });

  // This component doesn't render anything, it just sets up notifications
  return null;
};

export default NotificationSetup;

