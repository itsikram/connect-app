import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import AppGrid from './AppGrid';
import DeviceAppsGrid from './DeviceAppsGrid';
import { sampleApps } from '../data/appData';

/**
 * Example component demonstrating different ways to use AppGrid
 * This shows both custom apps and device apps
 */
const AppGridExample: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Example 1: Custom apps grid */}
      <AppGrid
        apps={sampleApps}
        title="Quick Apps"
        columns={4}
      />
      
      {/* Example 2: Device apps grid */}
      <DeviceAppsGrid
        title="Installed Apps"
        columns={4}
      />
      
      {/* Example 3: Mixed apps - you can combine both */}
      <AppGrid
        apps={[
          ...sampleApps.slice(0, 4), // First 4 custom apps
        ]}
        title="Favorites"
        columns={3}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default AppGridExample;
