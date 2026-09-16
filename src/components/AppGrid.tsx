import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { AppItem } from '../data/appData';

interface AppGridProps {
  apps?: AppItem[];
  title?: string;
  columns?: number;
  emptyLabel?: string;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const AppGrid: React.FC<AppGridProps> = ({
  apps = [],
  title,
  columns = 4,
  emptyLabel = 'No apps found',
  onReorder,
}) => {
  const { colors: themeColors } = useTheme();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0, index: 0 });
  const dragActive = useRef(false);
  const longPressReady = useRef(false);
  const columnWidth = `${100 / columns}%` as `${number}%`;

  const createDragResponder = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Boolean(onReorder) &&
        longPressReady.current &&
        Math.hypot(gestureState.dx, gestureState.dy) > 8,
      onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
        Boolean(onReorder) &&
        longPressReady.current &&
        Math.hypot(gestureState.dx, gestureState.dy) > 8,
      onPanResponderGrant: (event) => {
        dragStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, index };
        dragActive.current = false;
      },
      onPanResponderMove: (event) => {
        const dx = event.nativeEvent.pageX - dragStart.current.x;
        const dy = event.nativeEvent.pageY - dragStart.current.y;
        if (!dragActive.current && Math.hypot(dx, dy) < 10) return;
        dragActive.current = true;
        setDraggedIndex(index);
      },
      onPanResponderRelease: (event) => {
        if (dragActive.current && onReorder) {
          const dx = event.nativeEvent.pageX - dragStart.current.x;
          const dy = event.nativeEvent.pageY - dragStart.current.y;
          const columnMove = Math.round(dx / 84);
          const rowMove = Math.round(dy / 82);
          const toIndex = Math.max(
            0,
            Math.min(apps.length - 1, index + rowMove * columns + columnMove),
          );
          if (toIndex !== index) onReorder(index, toIndex);
        }
        dragActive.current = false;
        longPressReady.current = false;
        setDraggedIndex(null);
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminate: () => {
        dragActive.current = false;
        longPressReady.current = false;
        setDraggedIndex(null);
      },
    });

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
        {apps.map((app, index) => {
          const dragResponder = createDragResponder(index);
          return (
            <View
              key={app.id}
              style={[
                styles.appItem,
                { width: columnWidth },
                draggedIndex === index && styles.draggedItem,
              ]}
              {...dragResponder.panHandlers}
            >
              <TouchableOpacity
                style={styles.appTouchable}
                onPress={app.onPress}
                onLongPress={() => {
                  longPressReady.current = true;
                }}
                onPressOut={() => {
                  if (!dragActive.current) longPressReady.current = false;
                }}
                delayLongPress={450}
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
            </View>
          );
        })}
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
  appTouchable: {
    width: '100%',
    alignItems: 'center',
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
  draggedItem: {
    opacity: 0.55,
    transform: [{ scale: 1.05 }],
  },
});

export default AppGrid;
