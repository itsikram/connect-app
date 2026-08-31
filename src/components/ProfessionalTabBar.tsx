import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FAIcon from 'react-native-vector-icons/FontAwesome5';
import { TAB_BAR_BOTTOM_OFFSET } from './tabBarLayout';
import { useTheme } from '../contexts/ThemeContext';

interface TabItem {
  name: string;
  icon: string;
  label: string;
  component: any;
  badge?: number;
  haptic?: boolean;
  color?: string;
  iconSet?: 'material' | 'fa5';
  faStyle?: 'solid' | 'regular';
}

interface ProfessionalTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  tabs: TabItem[];
}

const ICON_SIZE = 22;

const ProfessionalTabBar: React.FC<ProfessionalTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const activeAnims = useRef(tabs.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    tabs.forEach((_, index) => {
      Animated.timing(activeAnims[index], {
        toValue: state.index === index ? 1 : 0,
        duration: 180,
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
      Friends: 'FriendsMain',
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

    const iconColor = isActive ? themeColors.primary : themeColors.text.tertiary;
    const useSolid = isActive || tab.faStyle === 'solid';
    const badgeCount = Number(tab.badge) || 0;

    const pillOpacity = activeAnims[index];

    return (
      <Pressable
        key={tab.name}
        style={styles.tabItem}
        onPress={() => handleTabPress(tab, index)}
        android_ripple={{ color: themeColors.primary + '22', borderless: true, radius: 36 }}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={String(label)}
      >
        <View style={styles.tabInner}>
          <View style={styles.iconHit}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activePill,
                {
                  backgroundColor: themeColors.primary + '22',
                  opacity: pillOpacity,
                },
              ]}
            />
            {tab.iconSet === 'fa5' ? (
              <FAIcon
                name={tab.icon}
                size={ICON_SIZE}
                color={iconColor}
                solid={useSolid}
              />
            ) : (
              <MaterialIcon
                name={tab.icon}
                size={ICON_SIZE + 2}
                color={iconColor}
              />
            )}
            {badgeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: themeColors.status.error }]}>
                <Text style={styles.badgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.tabLabel,
              {
                color: iconColor,
                fontWeight: isActive ? '700' : '500',
              },
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface.header,
          borderTopColor: themeColors.border.primary,
          paddingBottom: Math.max(insets.bottom, 8),
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
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconHit: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#1E1F20',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

export default ProfessionalTabBar;
