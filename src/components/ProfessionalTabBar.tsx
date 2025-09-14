import React, { useRef, useEffect, useState } from 'react';
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
  color?: string;
}

interface ProfessionalTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  tabs: TabItem[];
}

const ProfessionalTabBar: React.FC<ProfessionalTabBarProps> = ({
  state,
  descriptors,
  navigation,
  tabs,
}) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  
  const animatedValues = useRef(
    tabs.map(() => new Animated.Value(0))
  ).current;
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const rippleAnimations = useRef(
    tabs.map(() => new Animated.Value(0))
  ).current;
  const glowAnimations = useRef(
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

      // Glow animation for active tab
      if (isActive) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnimations[index], {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnimations[index], {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        glowAnimations[index].setValue(0);
      }
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
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // Haptic feedback
    if (tab.haptic !== false && Platform.OS === 'ios') {
      Vibration.vibrate(15);
    }

    // Ripple animation
    Animated.sequence([
      Animated.timing(rippleAnimations[index], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(rippleAnimations[index], {
        toValue: 0,
        duration: 200,
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

    // Reset animation flag
    setTimeout(() => setIsAnimating(false), 400);
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
      outputRange: [1, 1.25],
    });

    const translateY = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, -10],
    });

    const iconScale = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.15],
    });

    const labelOpacity = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const backgroundColor = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', (tab.color || themeColors.primary) + '25'],
    });

    const rippleScale = rippleAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 2],
    });

    const rippleOpacity = rippleAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0],
    });

    const glowOpacity = glowAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.3],
    });

    const glowScale = glowAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.2],
    });

    return (
      <TouchableOpacity
        key={tab.name}
        style={styles.tabItem}
        onPress={() => handleTabPress(tab, index)}
        activeOpacity={0.95}
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
          {/* Glow effect for active tab */}
          {isActive && (
            <Animated.View
              style={[
                styles.glow,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                  backgroundColor: tab.color || themeColors.primary,
                },
              ]}
            />
          )}

          {/* Ripple effect */}
          <Animated.View
            style={[
              styles.ripple,
              {
                transform: [{ scale: rippleScale }],
                opacity: rippleOpacity,
                backgroundColor: tab.color || themeColors.primary,
              },
            ]}
          />

          {/* Icon container */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor: isActive ? (tab.color || themeColors.primary) + '30' : 'transparent',
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.iconInner,
                  {
                    backgroundColor: isActive ? (tab.color || themeColors.primary) + '20' : 'transparent',
                  },
                ]}
              >
                <Icon
                  name={tab.icon}
                  size={24}
                  color={isActive ? (tab.color || themeColors.primary) : themeColors.gray[500]}
                />
                
                {/* Badge with pulse animation */}
                {tab.badge && tab.badge > 0 && (
                  <Animated.View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: themeColors.status.error,
                        shadowColor: themeColors.status.error,
                        transform: [{ scale: isActive ? 1.02 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
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
                color: isActive ? (tab.color || themeColors.primary) : themeColors.gray[500],
                opacity: labelOpacity,
                fontWeight: isActive ? '900' : '600',
                transform: [{ scale: isActive ? 1 : 1 }],
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
      {/* Top gradient border - Removed for cleaner look */}
      {/* <View style={styles.topGradientContainer}>
        <View
          style={[
            styles.topGradient,
            {
              backgroundColor: themeColors.primary,
              opacity: 0.3,
            },
          ]}
        />
      </View> */}

      {/* Animated indicator with glow effect - Removed for cleaner look */}
      {/* <Animated.View
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
      /> */}

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
    bottom: -20,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 25,
  },
  topGradientContainer: {
    height: 3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  topGradient: {
    flex: 1,
    borderRadius: 2,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: width / 5, // Assuming 5 tabs
    height: 5,
    borderRadius: 2.5,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
    minHeight: 45,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 20,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginVertical: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 24,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 2,
  },
  iconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  bottomContainer: {
    height: Platform.OS === 'ios' ? 20 : 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  bottomGradient: {
    flex: 1,
  },
});

export default ProfessionalTabBar;
