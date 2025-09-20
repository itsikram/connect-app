import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import AppGrid from './AppGrid';
import { DeviceAppsService } from '../services/DeviceAppsService';
import { fallbackApps } from '../data/fallbackApps';

interface DeviceAppsGridProps {
  title?: string;
  columns?: number;
  showFallback?: boolean; // Whether to show fallback apps when device apps are not available
}

/**
 * A specialized AppGrid component that automatically loads and displays
 * all installed apps on the device, with fallback to common apps
 */
const DeviceAppsGrid: React.FC<DeviceAppsGridProps> = ({
  title = "Installed Apps",
  columns = 4,
  showFallback = true
}) => {
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // Check if device apps are available
    if (!DeviceAppsService.isPackageAvailable() && showFallback) {
      setUseFallback(true);
    }
  }, [showFallback]);

  // If using fallback, show common apps instead
  if (useFallback) {
    return (
      <View style={styles.container}>
        <AppGrid
          apps={fallbackApps}
          title={title + " (Common Apps)"}
          columns={columns}
        />
      </View>
    );
  }

  // Otherwise, try to load device apps
  return (
    <View style={styles.container}>
      <AppGrid
        title={title}
        columns={columns}
        showDeviceApps={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default DeviceAppsGrid;
