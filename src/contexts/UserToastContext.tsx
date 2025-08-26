import React, { createContext, useContext, useState, ReactNode } from 'react';
import UserToast, { UserToastProps } from '../components/UserToast';

interface UserToastContextType {
  showUserToast: (userData: {
    userProfilePic?: string;
    fullName: string;
    message: string;
    type?: 'message' | 'friend' | 'notification' | 'custom';
    duration?: number;
    onPress?: () => void;
  }) => void;
  showMessageToast: (userData: {
    userProfilePic?: string;
    fullName: string;
    message: string;
    onPress?: () => void;
  }) => void;
  showFriendRequestToast: (userData: {
    userProfilePic?: string;
    fullName: string;
    message?: string;
    onPress?: () => void;
  }) => void;
  showNotificationToast: (userData: {
    userProfilePic?: string;
    fullName: string;
    message: string;
    onPress?: () => void;
  }) => void;
  hideUserToast: () => void;
}

const UserToastContext = createContext<UserToastContextType | undefined>(undefined);

interface UserToastProviderProps {
  children: ReactNode;
}

export const UserToastProvider: React.FC<UserToastProviderProps> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    userProfilePic?: string;
    fullName: string;
    message: string;
    type: 'message' | 'friend' | 'notification' | 'custom';
    duration: number;
    onPress?: () => void;
  }>({
    visible: false,
    userProfilePic: undefined,
    fullName: '',
    message: '',
    type: 'message',
    duration: 4000,
    onPress: undefined,
  });

  const showUserToast = (userData: {
    userProfilePic?: string;
    fullName: string;
    message: string;
    type?: 'message' | 'friend' | 'notification' | 'custom';
    duration?: number;
    onPress?: () => void;
  }) => {
    setToastConfig({
      visible: true,
      userProfilePic: userData.userProfilePic,
      fullName: userData.fullName,
      message: userData.message,
      type: userData.type || 'message',
      duration: userData.duration || 4000,
      onPress: userData.onPress,
    });
  };

  const showMessageToast = (userData: {
    userProfilePic?: string;
    fullName: string;
    message: string;
    onPress?: () => void;
  }) => {
    showUserToast({
      ...userData,
      type: 'message',
      duration: 5000, // Messages stay longer
    });
  };

  const showFriendRequestToast = (userData: {
    userProfilePic?: string;
    fullName: string;
    message?: string;
    onPress?: () => void;
  }) => {
    showUserToast({
      ...userData,
      message: userData.message || `${userData.fullName} sent you a friend request`,
      type: 'friend',
      duration: 6000, // Friend requests stay longer
    });
  };

  const showNotificationToast = (userData: {
    userProfilePic?: string;
    fullName: string;
    message: string;
    onPress?: () => void;
  }) => {
    showUserToast({
      ...userData,
      type: 'notification',
      duration: 4000,
    });
  };

  const hideUserToast = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  const handleToastHide = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  return (
    <UserToastContext.Provider
      value={{
        showUserToast,
        showMessageToast,
        showFriendRequestToast,
        showNotificationToast,
        hideUserToast,
      }}
    >
      {children}
      <UserToast
        visible={toastConfig.visible}
        userProfilePic={toastConfig.userProfilePic}
        fullName={toastConfig.fullName}
        message={toastConfig.message}
        type={toastConfig.type}
        duration={toastConfig.duration}
        onHide={handleToastHide}
        onPress={toastConfig.onPress}
        position="top"
        showCloseButton={true}
      />
    </UserToastContext.Provider>
  );
};

export const useUserToast = (): UserToastContextType => {
  const context = useContext(UserToastContext);
  if (!context) {
    throw new Error('useUserToast must be used within a UserToastProvider');
  }
  return context;
};
