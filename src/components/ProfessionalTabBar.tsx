import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { TAB_BAR_BOTTOM_OFFSET } from './tabBarLayout';
import { PRO_TAB_ICONS, ProTabIconName } from './tabBarIcons';
import { useTheme } from '../contexts/ThemeContext';

interface TabItem {
  name: string;
  icon: string;
  label: string;
  component: any;
  badge?: number;
  haptic?: boolean;
  color?: string;
  iconSet?: 'material' | 'fapro';
}

interface ProfessionalTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  tabs: TabItem[];
}

// Mirrors web/src/partials/MobileBottomNav/MobileBottomNav.css so the app
// and the mobile web bar look identical.
const BAR_HEIGHT = 60;
const ICON_SIZE = 19; // font-size: 19px -> glyph em box height
const PALETTE = {
  dark: {
    background: 'rgba(18, 19, 21, 0.92)',
    border: 'rgba(255, 255, 255, 0.08)',
    inactive: '#9aa0a6',
    active: '#00d4ff',
    ring: '#121315',
  },
  light: {
    background: 'rgba(255, 255, 255, 0.94)',
    border: 'rgba(0, 0, 0, 0.08)',
    inactive: '#65676b',
    active: '#0099cc',
    ring: '#FFFFFF',
  },
};
const ACTIVE_PILL = 'rgba(0, 212, 255, 0.14)';
const BADGE_BG = '#ff4444';

const ProTabIcon = ({
  name,
  active,
  color,
}: {
  name: ProTabIconName;
  active: boolean;
  color: string;
}) => {
  const glyph = PRO_TAB_ICONS[name][active ? 'solid' : 'light'];
  return (
    <Svg
      width={(ICON_SIZE * glyph.width) / glyph.height}
      height={ICON_SIZE}
      viewBox={`0 0 ${glyph.width} ${glyph.height}`}
    >
      <Path d={glyph.d} fill={color} />
    </Svg>
  );
};

const ProfessionalTabBar: React.FC<ProfessionalTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { isDarkMode } = useTheme();
  const palette = isDarkMode ? PALETTE.dark : PALETTE.light;
  const insets = useSafeAreaInsets();
  const activeAnims = useRef(tabs.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    tabs.forEach((_, index) => {
      Animated.timing(activeAnims[index], {
        toValue: state.index === index ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [state.index, tabs, activeAnims]);

  const handleTabPress = (tab: TabItem, index: number) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });

    if (event.defaultPrevented) return;

    const mainScreens: { [key: string]: string } = {
      Home: 'HomeMain',
      Connects: 'ConnectsMain',
      Videos: 'VideosMain',
      Message: 'MessageList',
      Menu: 'MenuHome',
    };

    const mainScreen = mainScreens[tab.name];
    if (mainScreen) {
      navigation.navigate(tab.name, { screen: mainScreen });
    } else if (state.index !== index) {
      navigation.navigate(state.routes[index].name);
    }
  };

  const renderTab = (tab: TabItem, index: number) => {
    const isActive = state.index === index;
    const { options } = descriptors[state.routes[index].key] || {};
    const label =
      options?.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options?.title !== undefined
        ? options.title
        : tab.label;

    const color = isActive ? palette.active : palette.inactive;
    const badgeCount = Number(tab.badge) || 0;

    return (
      <Pressable
        key={tab.name}
        style={styles.tabItem}
        onPress={() => handleTabPress(tab, index)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={
          badgeCount > 0 ? `${label}, ${badgeCount} new` : String(label)
        }
      >
        <View style={styles.iconWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              { backgroundColor: ACTIVE_PILL, opacity: activeAnims[index] },
            ]}
          />
          {tab.iconSet === 'material' ? (
            <MaterialIcon name={tab.icon} size={ICON_SIZE + 2} color={color} />
          ) : (
            <ProTabIcon
              name={tab.icon as ProTabIconName}
              active={isActive}
              color={color}
            />
          )}
          {badgeCount > 0 && (
            <View style={[styles.badge, { borderColor: palette.ring }]}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={[styles.tabLabel, { color }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return descriptors[state.routes[state.index].key]?.options?.tabBarStyle
    ?.display === 'none' ? null : (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          borderTopColor: palette.border,
          // On Android the app shell already reserves the navigation bar
          // (insets.bottom is 0 here). The +20 offsets the container's
          // negative `bottom`.
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => renderTab(tab, index))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: TAB_BAR_BOTTOM_OFFSET - 50,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 44,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
  },
  badge: {
    // 18px badge + 2px ring (web draws the ring with box-shadow).
    position: 'absolute',
    top: -6,
    right: 0,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    paddingHorizontal: 5,
    backgroundColor: BADGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    textAlign: 'center',
  },
  tabLabel: {
    maxWidth: '100%',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.11,
    lineHeight: 12,
  },
});

export default ProfessionalTabBar;
