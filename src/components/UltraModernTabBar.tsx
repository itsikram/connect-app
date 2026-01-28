import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Vibration,
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
  haptic?: boolean;
}

interface UltraModernTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  tabs: TabItem[];
}

const UltraModernTabBar: React.FC<UltraModernTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const animatedValues = useRef(
    tabs.map(() => new Animated.Value(0))
  ).current;
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const rippleAnimations = useRef(
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

    // Animate indicator position
    Animated.spring(indicatorPosition, {
      toValue: state.index * (width / tabs.length),
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  }, [state.index]);

  const handleTabPress = (tab: TabItem, index: number) => {
    // Haptic feedback
    if (tab.haptic !== false && Platform.OS === 'ios') {
      Vibration.vibrate(10);
    }

    // Ripple animation
    Animated.sequence([
      Animated.timing(rippleAnimations[index], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(rippleAnimations[index], {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });

    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(state.routes[index].name);
    }
  };

  const renderTab = (tab: TabItem, index: number) => {
    const isActive = state.index === index;
    const { options } = descriptors[state.routes[index].key];
    const label = options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
      ? options.title
      : tab.label;

    const scale = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.2],
    });

    const translateY = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, -8],
    });

    const iconScale = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });

    const labelOpacity = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const backgroundColor = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', themeColors.primary + '20'],
    });

    const rippleScale = rippleAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1.5],
    });

    const rippleOpacity = rippleAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0],
    });

    return (
      <TouchableOpacity
        key={tab.name}
        style={styles.tabItem}
        onPress={() => handleTabPress(tab, index)}
        activeOpacity={0.9}
      >
        <Animated.View
          style={[
            styles.tabContent,
            {
              transform: [{ scale }, { translateY }],
              backgroundColor,
            },
          ]}
        >
          {/* Ripple effect */}
          <Animated.View
            style={[
              styles.ripple,
              {
                transform: [{ scale: rippleScale }],
                opacity: rippleOpacity,
                backgroundColor: themeColors.primary,
              },
            ]}
          />

          {/* Icon container */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor: isActive ? themeColors.primary + '25' : 'transparent',
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.iconInner,
                  {
                    backgroundColor: isActive ? themeColors.primary + '15' : 'transparent',
                  },
                ]}
              >
                <Icon
                  name={tab.icon}
                  size={28}
                  color={isActive ? themeColors.primary : themeColors.gray[500]}
                />
                
                {/* Badge with pulse animation */}
                {tab.badge && tab.badge > 0 && (
                  <Animated.View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: themeColors.status.error,
                        shadowColor: themeColors.status.error,
                        transform: [{ scale: isActive ? 1.1 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: themeColors.text.primary }]}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </Animated.View>
                )}
              </Animated.View>
            </Animated.View>
          </View>

          {/* Label */}
          <Animated.Text
            style={[
              styles.tabLabel,
              {
                color: isActive ? themeColors.primary : themeColors.gray[500],
                opacity: labelOpacity,
                fontWeight: isActive ? '800' : '600',
                transform: [{ scale: isActive ? 1.05 : 1 }],
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
      {/* Top gradient border */}
      <View style={styles.topGradientContainer}>
        <View
          style={[
            styles.topGradient,
            {
              backgroundColor: themeColors.primary,
              opacity: 0.2,
            },
          ]}
        />
      </View>

      {/* Animated indicator with glow effect */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: themeColors.primary,
            transform: [
              {
                translateX: indicatorPosition,
              },
            ],
            shadowColor: themeColors.primary,
          },
        ]}
      />

      {/* Tabs container */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => renderTab(tab, index))}
      </View>

      {/* Bottom safe area with gradient */}
      <View style={styles.bottomContainer}>
        <View
          style={[
            styles.bottomGradient,
            {
              backgroundColor: themeColors.surface.header,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -12,
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 30,
  },
  topGradientContainer: {
    height: 3,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  topGradient: {
    flex: 1,
    borderRadius: 1.5,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: width / 5, // Assuming 5 tabs
    height: 4,
    borderRadius: 2,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  bottomContainer: {
    height: Platform.OS === 'ios' ? 34 : 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  bottomGradient: {
    flex: 1,
  },
});

export default UltraModernTabBar;
