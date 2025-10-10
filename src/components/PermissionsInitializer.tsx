import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestAllPermissionsWithAlerts, PermissionStatus } from '../lib/permissions';
import { requestBatteryOptimizationExemption } from '../lib/push';

const PERMISSIONS_REQUESTED_KEY = 'permissions_requested';

interface PermissionsInitializerProps {
  /**
   * User object - permissions will only be requested if user is logged in
   */
  user: any;
  /**
   * Callback when permissions are requested/checked
   */
  onPermissionsChecked?: (status: PermissionStatus) => void;
}

/**
 * Component that handles requesting required permissions when the app opens
 * Only requests permissions once per app installation and only when user is logged in
 */
const PermissionsInitializer: React.FC<PermissionsInitializerProps> = ({ 
  user, 
  onPermissionsChecked 
}) => {
  const hasRequestedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const requestPermissions = async () => {
      // Don't request if already requested in this session
      if (hasRequestedRef.current) {
        return;
      }

      // Only request permissions if user is logged in
      if (!user) {
        console.log('👤 No user logged in, skipping permission requests');
        return;
      }

      try {
        // Check if permissions have been requested before
        const hasRequested = await AsyncStorage.getItem(PERMISSIONS_REQUESTED_KEY);
        
        if (hasRequested === 'true') {
          console.log('✅ Permissions already requested in a previous session');
          hasRequestedRef.current = true;
          setIsReady(true);
          return;
        }

        console.log('🚀 First time app launch or permissions not yet requested');
        console.log('📱 Requesting app permissions...');

        // Mark as requested before showing dialogs to prevent duplicates
        hasRequestedRef.current = true;

        // Add a small delay to ensure UI is fully loaded
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), 1000);
        });

        // Request all permissions with user-friendly alerts
        const status = await requestAllPermissionsWithAlerts();

        // Request battery optimization exemption for reliable call notifications (Android only)
        if (Platform.OS === 'android') {
          console.log('🔋 Requesting battery optimization exemption for reliable calls...');
          await requestBatteryOptimizationExemption();
        }

        // Mark as requested for future app launches
        await AsyncStorage.setItem(PERMISSIONS_REQUESTED_KEY, 'true');

        console.log('✅ Permission request completed:', status);
        
        // Notify parent component
        if (onPermissionsChecked) {
          onPermissionsChecked(status);
        }

        setIsReady(true);
      } catch (error) {
        console.error('❌ Error requesting permissions:', error);
        hasRequestedRef.current = true;
        setIsReady(true);
      }
    };

    requestPermissions();
  }, [user, onPermissionsChecked]);

  // This component doesn't render anything
  return null;
};

/**
 * Hook to manually trigger permission requests
 */
export const usePermissions = () => {
  const requestPermissions = async () => {
    console.log('📱 Manually requesting permissions...');
    return await requestAllPermissionsWithAlerts();
  };

  return { requestPermissions };
};

export default PermissionsInitializer;

