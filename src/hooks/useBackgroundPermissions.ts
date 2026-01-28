import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import { backgroundServiceManager } from '../lib/backgroundServiceManager';
import { backgroundTaskManager } from '../lib/backgroundTaskManager';
import { requestIncomingCallPermissions } from '../lib/push';

interface BackgroundPermissions {
  notifications: boolean;
  batteryOptimization: boolean;
  autoStart: boolean;
  backgroundTask: boolean;
  overall: boolean;
}

export const useBackgroundPermissions = () => {
  const [permissions, setPermissions] = useState<BackgroundPermissions>({
    notifications: false,
    batteryOptimization: false,
    autoStart: false,
    backgroundTask: false,
    overall: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const checkPermissions = useCallback(async () => {
    try {
      setCheckingStatus(true);
      
      // Check notification permissions
      const notifPermissions = await requestIncomingCallPermissions();
      
      // Check background service status
      const serviceStatus = backgroundServiceManager.getServiceStatus();
      
      // Check background task status
      const taskStatus = await backgroundTaskManager.checkStatus();
      
      const newPermissions: BackgroundPermissions = {
        notifications: notifPermissions,
        batteryOptimization: serviceStatus.batteryOptimizationExempt,
        autoStart: serviceStatus.autoStartEnabled,
        backgroundTask: taskStatus.isRegistered,
        overall: notifPermissions && 
                serviceStatus.batteryOptimizationExempt && 
                serviceStatus.autoStartEnabled && 
                taskStatus.isRegistered,
      };
      
      setPermissions(newPermissions);
      return newPermissions;
    } catch (error) {
      console.error('Error checking background permissions:', error);
      return permissions;
    } finally {
      setCheckingStatus(false);
      setIsLoading(false);
    }
  }, [permissions]);

  const requestAllPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Request notification permissions
      const notifGranted = await requestIncomingCallPermissions();
      
      // Request battery optimization exemption
      const batteryGranted = await backgroundServiceManager.requestBatteryOptimizationExemption();
      
      // Request auto-start permission (Android only)
      const autoStartGranted = Platform.OS === 'ios' ? 
        true : 
        await backgroundServiceManager.requestAutoStartPermission();
      
      // Initialize background task
      const taskGranted = await backgroundTaskManager.initialize();
      
      const newPermissions: BackgroundPermissions = {
        notifications: notifGranted,
        batteryOptimization: batteryGranted,
        autoStart: autoStartGranted,
        backgroundTask: taskGranted,
        overall: notifGranted && batteryGranted && autoStartGranted && taskGranted,
      };
      
      setPermissions(newPermissions);
      
      // Show result to user
      if (newPermissions.overall) {
        Alert.alert(
          '✅ Background Permissions Granted',
          'The app can now receive notifications and incoming calls even when closed or in the background.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          '⚠️ Some Permissions Missing',
          'For the best experience, please grant all background permissions. You can change these in device settings.',
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'Settings', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
      }
      
      return newPermissions;
    } catch (error) {
      console.error('Error requesting background permissions:', error);
      return permissions;
    } finally {
      setIsLoading(false);
    }
  }, [permissions]);

  const initializeBackgroundServices = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Initialize background service manager
      await backgroundServiceManager.initialize();
      
      // Initialize background task manager
      await backgroundTaskManager.initialize();
      
      // Check initial permissions
      await checkPermissions();
    } catch (error) {
      console.error('Error initializing background services:', error);
    } finally {
      setIsLoading(false);
    }
  }, [checkPermissions]);

  const showPermissionGuide = useCallback(() => {
    const platform = Platform.OS;
    const title = '📱 Background Permissions Guide';
    const message = platform === 'ios' 
      ? `iOS Permissions Required:
        
• Notifications: Allow notifications to receive calls and messages
• Background App Refresh: Enable for reliable background operation
• Cellular Data: Allow for background connectivity

These ensure you receive calls when the app is closed.`
      : `Android Permissions Required:
        
• Notifications: Allow notifications to receive calls and messages  
• Battery Optimization: Disable to prevent app from being killed
• Auto-Start: Enable to restart app after device reboot
• Background Data: Allow for background connectivity

These ensure you receive calls when the app is closed or device is restarted.`;

    Alert.alert(
      title,
      message,
      [
        { text: 'Got it', style: 'default' },
        { 
          text: 'Request All', 
          onPress: requestAllPermissions 
        }
      ]
    );
  }, [requestAllPermissions]);

  useEffect(() => {
    initializeBackgroundServices();
  }, [initializeBackgroundServices]);

  return {
    permissions,
    isLoading,
    checkingStatus,
    checkPermissions,
    requestAllPermissions,
    initializeBackgroundServices,
    showPermissionGuide,
  };
};
