import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { DeviceAppsService } from '../services/DeviceAppsService';

import { AppItem } from '../data/appData';

const { width: screenWidth } = Dimensions.get('window');

interface AppGridProps {
  apps?: AppItem[];
  title?: string;
  columns?: number;
  showDeviceApps?: boolean; // New prop to show device apps
}

const AppGrid: React.FC<AppGridProps> = ({ 
  apps = [], 
  title = "Quick Apps", 
  columns = 4,
  showDeviceApps = false
}) => {
  const { colors: themeColors } = useTheme();
  const [deviceApps, setDeviceApps] = useState<AppItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);

  // Load device apps when showDeviceApps is true
  useEffect(() => {
    if (showDeviceApps) {
      loadDeviceApps();
    }
  }, [showDeviceApps]);

  const loadDeviceApps = async () => {
    setIsLoading(true);
    try {
      // Check if the package is available first
      if (!DeviceAppsService.isPackageAvailable()) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      const permission = await DeviceAppsService.hasPermission();
      setHasPermission(permission);
      
      if (permission) {
        const apps = await DeviceAppsService.getDeviceAppsForGrid();
        setDeviceApps(apps);
      }
    } catch (error) {
      console.error('Error loading device apps:', error);
      setHasPermission(false);
      Alert.alert(
        'Permission Required',
        'This app needs permission to access installed apps. Please grant the permission in settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Use device apps if showDeviceApps is true, otherwise use provided apps
  const displayApps = showDeviceApps ? deviceApps : apps;

  // Calculate item dimensions for modern Android-style grid
  const padding = 16;
  const gap = 8;
  const availableWidth = screenWidth - (padding * 2);
  const itemWidth = (availableWidth - (gap * (columns - 1))) / columns;

  const renderAppItem = (app: AppItem) => {
    const handlePress = async () => {
      if (app.isDeviceApp && app.packageName) {
        // Launch device app
        await DeviceAppsService.launchApp(app.packageName);
      } else if (app.onPress) {
        // Handle custom app action
        app.onPress();
      }
    };

    return (
      <TouchableOpacity
        key={app.id}
        style={[
          styles.appItem,
          { 
            width: itemWidth,
            backgroundColor: 'transparent',
          }
        ]}
        onPress={handlePress}
        activeOpacity={0.6}
      >
        <View style={[
          styles.iconContainer,
          { 
            backgroundColor: app.color || themeColors.primary,
            shadowColor: app.color || themeColors.primary,
          }
        ]}>
          {app.logo ? (
            <Image 
              source={{ uri: app.logo }} 
              style={styles.appLogo}
              resizeMode="contain"
            />
          ) : app.icon ? (
            <Icon 
              name={app.icon} 
              size={28} 
              color="#FFFFFF" 
            />
          ) : (
            <Icon 
              name="apps" 
              size={28} 
              color="#FFFFFF" 
            />
          )}
        </View>
        <Text 
          style={[styles.appName, { color: themeColors.text.primary }]}
          numberOfLines={1}
        >
          {app.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // Show loading state
  if (showDeviceApps && isLoading) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          {title}
        </Text>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>
            Loading device apps...
          </Text>
        </View>
      </View>
    );
  }

  // Show permission error
  if (showDeviceApps && !hasPermission) {
    const isPackageAvailable = DeviceAppsService.isPackageAvailable();
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          {title}
        </Text>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={themeColors.text.secondary} />
          <Text style={[styles.errorText, { color: themeColors.text.secondary }]}>
            {isPackageAvailable 
              ? 'Permission required to access device apps' 
              : 'Device apps feature not available. Please rebuild the app.'}
          </Text>
          {isPackageAvailable && (
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
              onPress={loadDeviceApps}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && (
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          {title}
        </Text>
      )}
      <ScrollView 
        horizontal={false}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.grid, { paddingHorizontal: padding, gap: gap }]}>
          {displayApps.map(renderAppItem)}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 16,
    letterSpacing: 0.5,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  appItem: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    // Modern Android-style shadow
    shadowColor: '#000',
  },
  appLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: 0.2,
    maxWidth: 70,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppGrid;
