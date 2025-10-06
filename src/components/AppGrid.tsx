import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

import { AppItem } from '../data/appData';

const { width: screenWidth } = Dimensions.get('window');

interface AppGridProps {
  apps?: AppItem[];
  title?: string;
  columns?: number;
}

const AppGrid: React.FC<AppGridProps> = ({ 
  apps = [], 
  title = "Quick Apps", 
  columns = 4
}) => {
  const { colors: themeColors } = useTheme();


  // Calculate item dimensions for modern Android-style grid
  const padding = 16;
  const gap = 8;
  const availableWidth = screenWidth - (padding * 2);
  const itemWidth = (availableWidth - (gap * (columns - 1))) / columns;

  const renderAppItem = (app: AppItem) => {
    const handlePress = () => {
      if (app.onPress) {
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
          {apps.map(renderAppItem)}
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
});

export default AppGrid;
