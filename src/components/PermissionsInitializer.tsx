import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { requestAllPermissionsWithAlerts, PermissionStatus } from '../lib/permissions';
import { requestBatteryOptimizationExemption } from '../lib/push';

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
      if (hasRequestedRef.current) {
        return;
      }

      if (!user) {
        console.log('👤 No user logged in, skipping permission requests');
        return;
      }

      try {
        hasRequestedRef.current = true;

        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 1000);
        });

        const status = await requestAllPermissionsWithAlerts();

        if (Platform.OS === 'android') {
          console.log('🔋 Requesting battery optimization exemption for reliable calls...');
          await requestBatteryOptimizationExemption();
        }

        console.log('✅ Permission request completed:', status);

        if (onPermissionsChecked) {
          onPermissionsChecked(status);
        }

        setIsReady(true);
      } catch (error) {
        console.error('❌ Error requesting permissions:', error);
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

