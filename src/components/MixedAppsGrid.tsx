import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import AppGrid from './AppGrid';
import { sampleApps, AppItem } from '../data/appData';
import { DeviceAppsService } from '../services/DeviceAppsService';

interface MixedAppsGridProps {
  title?: string;
  columns?: number;
  showCustomApps?: boolean;
  showDeviceApps?: boolean;
  maxDeviceApps?: number; // Limit number of device apps to show
}

/**
 * A component that can show both custom apps and device apps in a single grid
 */
const MixedAppsGrid: React.FC<MixedAppsGridProps> = ({
  title = "Apps",
  columns = 4,
  showCustomApps = true,
  showDeviceApps = true,
  maxDeviceApps = 20 // Limit to prevent overwhelming the UI
}) => {
  const { colors: themeColors } = useTheme();
  const [deviceApps, setDeviceApps] = useState<AppItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'custom' | 'device'>('all');

  useEffect(() => {
    if (showDeviceApps) {
      loadDeviceApps();
    }
  }, [showDeviceApps]);

  const loadDeviceApps = async () => {
    setIsLoading(true);
    try {
      const apps = await DeviceAppsService.getDeviceAppsForGrid();
      // Limit the number of device apps to prevent UI overload
      setDeviceApps(apps.slice(0, maxDeviceApps));
    } catch (error) {
      console.error('Error loading device apps:', error);
      setDeviceApps([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayApps = (): AppItem[] => {
    const dedupeById = (items: AppItem[]): AppItem[] => {
      const seen: Record<string, boolean> = {};
      const unique: AppItem[] = [];
      for (const item of items) {
        if (!item?.id) {
          continue;
        }
        if (!seen[item.id]) {
          seen[item.id] = true;
          unique.push(item);
        }
      }
      return unique;
    };

    switch (activeTab) {
      case 'custom':
        return dedupeById(showCustomApps ? sampleApps : []);
      case 'device':
        return dedupeById(showDeviceApps ? deviceApps : []);
      case 'all':
      default: {
        const customApps = showCustomApps ? sampleApps : [];
        const deviceAppsLimited = showDeviceApps ? deviceApps : [];
        return dedupeById([...customApps, ...deviceAppsLimited]);
      }
    }
  };

  const renderTabButton = (tab: 'all' | 'custom' | 'device', label: string) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          {
            backgroundColor: isActive ? themeColors.primary : themeColors.surface.primary,
          }
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <Text
          style={[
            styles.tabButtonText,
            {
              color: isActive ? '#FFFFFF' : themeColors.text.primary,
            }
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {showCustomApps && showDeviceApps && (
          <>
            {renderTabButton('all', 'All Apps')}
            {renderTabButton('custom', 'Quick Apps')}
            {renderTabButton('device', 'Installed')}
          </>
        )}
      </View>

      {/* Apps Grid */}
      <AppGrid
        apps={getDisplayApps()}
        title={title}
        columns={columns}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MixedAppsGrid;
