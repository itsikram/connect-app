import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { AppItem } from '../data/appData';

interface AppGridProps {
  apps?: AppItem[];
  title?: string;
  columns?: number;
  emptyLabel?: string;
}

const AppGrid: React.FC<AppGridProps> = ({
  apps = [],
  title,
  columns = 4,
  emptyLabel = 'No apps found',
}) => {
  const { colors: themeColors } = useTheme();
  const columnWidth = `${100 / columns}%` as `${number}%`;

  if (apps.length === 0) {
    if (!title && !emptyLabel) return null;
    return (
      <View style={styles.container}>
        {title ? (
          <Text style={[styles.title, { color: themeColors.text.primary }]}>{title}</Text>
        ) : null}
        <Text style={[styles.empty, { color: themeColors.text.tertiary }]}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title ? (
        <Text style={[styles.title, { color: themeColors.text.primary }]}>{title}</Text>
      ) : null}
      <View style={styles.grid}>
        {apps.map((app) => (
          <TouchableOpacity
            key={app.id}
            style={[styles.appItem, { width: columnWidth }]}
            onPress={app.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={app.name}
            disabled={!app.onPress}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: app.color || themeColors.primary,
                  shadowColor: app.color || themeColors.primary,
                },
              ]}
            >
              {app.logo ? (
                <Image source={{ uri: app.logo }} style={styles.appLogo} resizeMode="contain" />
              ) : (
                <Icon name={app.icon || 'apps'} size={24} color="#FFFFFF" />
              )}
            </View>
            <Text
              style={[styles.appName, { color: themeColors.text.primary }]}
              numberOfLines={2}
            >
              {app.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  empty: {
    fontSize: 13,
    paddingVertical: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  appItem: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 10,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    elevation: 3,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  appLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  appName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.1,
    maxWidth: '100%',
  },
});

export default AppGrid;
