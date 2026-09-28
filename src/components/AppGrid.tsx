import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
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
  /** 'icon' renders a launcher-style icon grid; 'card' renders two-column shortcut cards. */
  variant?: 'icon' | 'card';
}

const AppGrid: React.FC<AppGridProps> = ({
  apps = [],
  title,
  columns = 4,
  emptyLabel = 'No apps found',
  onReorder,
  variant = 'icon',
}) => {
  const { colors: themeColors } = useTheme();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0, index: 0 });
  const dragActive = useRef(false);
  const longPressReady = useRef(false);
  const isCard = variant === 'card';
  const gridColumns = isCard ? 2 : columns;
  const columnWidth = `${100 / gridColumns}%` as `${number}%`;

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
          const columnMove = Math.round(dx / (isCard ? 170 : 84));
          const rowMove = Math.round(dy / (isCard ? 100 : 82));
          const toIndex = Math.max(
            0,
            Math.min(apps.length - 1, index + rowMove * gridColumns + columnMove),
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
      <View style={[styles.grid, isCard && styles.cardGrid]}>
        {apps.map((app, index) => {
          const dragResponder = createDragResponder(index);
          const longPressHandlers = {
            onLongPress: () => {
              longPressReady.current = true;
            },
            onPressOut: () => {
              if (!dragActive.current) longPressReady.current = false;
            },
            delayLongPress: 450,
          };
          if (isCard) {
            return (
              <View
                key={app.id}
                style={[styles.cardWrapper, draggedIndex === index && styles.draggedItem]}
                {...dragResponder.panHandlers}
              >
                <Pressable
                  onPress={app.onPress}
                  {...longPressHandlers}
                  accessibilityRole="button"
                  accessibilityLabel={app.name}
                  disabled={!app.onPress}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: themeColors.surface.primary,
                      borderColor: themeColors.border.primary,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: app.color || themeColors.primary }]}>
                    {app.logo ? (
                      <Image source={{ uri: app.logo }} style={styles.cardLogo} resizeMode="contain" />
                    ) : (
                      <Icon name={app.icon || 'apps'} size={20} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={[styles.cardLabel, { color: themeColors.text.primary }]} numberOfLines={1}>
                    {app.name}
                  </Text>
                  {app.hint ? (
                    <Text style={[styles.cardHint, { color: themeColors.text.tertiary }]} numberOfLines={1}>
                      {app.hint}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            );
          }
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
                {...longPressHandlers}
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
  cardGrid: {
    gap: 10,
  },
  cardWrapper: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '47%',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardHint: {
    marginTop: 2,
    fontSize: 12,
  },
  draggedItem: {
    opacity: 0.55,
    transform: [{ scale: 1.05 }],
  },
});

export default AppGrid;
