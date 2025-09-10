import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface TabItem {
  name: string;
  icon: string;
  label: string;
  component: any;
  badge?: number;
}

interface ModernTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  tabs: TabItem[];
}

const ModernTabBar: React.FC<ModernTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const animatedValues = useRef(
    tabs.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Animate the active tab
    tabs.forEach((_, index) => {
      const isActive = state.index === index;
      Animated.spring(animatedValues[index], {
        toValue: isActive ? 1 : 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    });
  }, [state.index]);

  const renderTab = (tab: TabItem, index: number) => {
    const isActive = state.index === index;
    const { options } = descriptors[state.routes[index].key];
    const label = options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
      ? options.title
      : tab.label;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[index].key,
        canPreventDefault: true,
      });

      if (!isActive && !event.defaultPrevented) {
        navigation.navigate(state.routes[index].name);
      }
    };

    const scale = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });

    const translateY = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, -4],
    });

    const iconOpacity = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    });

    const labelOpacity = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <TouchableOpacity
        key={tab.name}
        style={styles.tabItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.tabContent,
            {
              transform: [{ scale }, { translateY }],
            },
          ]}
        >
          {/* Active indicator background */}
          {isActive && (
            <Animated.View
              style={[
                styles.activeIndicator,
                {
                  backgroundColor: themeColors.primary + '20',
                  opacity: animatedValues[index],
                },
              ]}
            />
          )}

          {/* Icon container */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.iconWrapper,
                isActive && {
                  backgroundColor: themeColors.primary + '15',
                },
              ]}
            >
              <Icon
                name={tab.icon}
                size={24}
                color={isActive ? themeColors.primary : themeColors.gray[500]}
              />
              
              {/* Badge */}
              {tab.badge && tab.badge > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: themeColors.status.error,
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: themeColors.white }]}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Label */}
          <Animated.Text
            style={[
              styles.tabLabel,
              {
                color: isActive ? themeColors.primary : themeColors.gray[500],
                opacity: labelOpacity,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface.header }]}>
      {/* Top border with gradient effect */}
      <View
        style={[
          styles.topBorder,
          {
            backgroundColor: themeColors.border.primary,
            opacity: 0.3,
          },
        ]}
      />

      {/* Tabs container */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => renderTab(tab, index))}
      </View>

      {/* Bottom safe area */}
      <View
        style={[
          styles.bottomSafeArea,
          { backgroundColor: themeColors.surface.header },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  topBorder: {
    height: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    left: -16,
    right: -16,
    bottom: -8,
    borderRadius: 20,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  bottomSafeArea: {
    height: Platform.OS === 'ios' ? 34 : 0,
  },
});

export default ModernTabBar;
