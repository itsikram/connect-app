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
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FAIcon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../contexts/ThemeContext';
import AnimatedTabIcon from './AnimatedIcons/AnimatedTabIcon';
import HomeIconComponent from './AnimatedIcons/HomeIconComponent';
import FriendsIconComponent from './AnimatedIcons/FriendsIconComponent';
import VideosIconComponent from './AnimatedIcons/VideosIconComponent';
import MessageIconComponent from './AnimatedIcons/MessageIconComponent';
import MenuIconComponent from './AnimatedIcons/MenuIconComponent';

const { width } = Dimensions.get('window');

interface TabItem {
  name: string;
  icon: string; // Material icon name by default
  label: string;
  component: any;
  badge?: number;
  haptic?: boolean;
  color?: string;
  iconSet?: 'material' | 'fa5'; // choose icon set
  faStyle?: 'solid' | 'regular'; // for FontAwesome5 (fas/fal-like)
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
  const insets = useSafeAreaInsets();
  const [isAnimating, setIsAnimating] = useState(false);
  const UNIFORM_TAB_SCALE = 1.25;
  const UNIFORM_TRANSLATE_Y = -10;
  const UNIFORM_ICON_SCALE = 1.15;
  
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

  // Icon mapping for animated SVG icons
  const getAnimatedIcon = (tabName: string) => {
    switch (tabName) {
      case 'Home':
        return HomeIconComponent;
      case 'Friends':
        return FriendsIconComponent;
      case 'Videos':
        return VideosIconComponent;
      case 'Message':
        return MessageIconComponent;
      case 'Menu':
        return MenuIconComponent;
      default:
        return null;
    }
  };

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
      Vibration.vibrate(0.5);
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

    if (!event.defaultPrevented) {
      // Map of tab names to their main screens
      const mainScreens: { [key: string]: string } = {
        'Home': 'HomeMain',
        'Friends': 'FriendsMain',
        'Videos': 'VideosMain',
        'Message': 'MessageList',
        'Menu': 'MenuHome',
      };

      const mainScreen = mainScreens[tab.name];
      if (mainScreen) {
        // Always navigate to the main screen of the tab
        navigation.navigate(tab.name, { screen: mainScreen });
      } else if (state.index !== index) {
        // Fallback to default navigation for tabs without main screen mapping
        navigation.navigate(state.routes[index].name);
      }
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

    const scale = UNIFORM_TAB_SCALE;

    const translateY = UNIFORM_TRANSLATE_Y;

    const iconScale = UNIFORM_ICON_SCALE;

    const labelOpacity = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const backgroundColor = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', themeColors.primary + '18'],
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
          {/* Icon container - rendered above background effects */}
          <View style={styles.iconContainer}>
            {getAnimatedIcon(tab.name) ? (
              <AnimatedTabIcon
                iconSource={getAnimatedIcon(tab.name)}
                size={24}
                isActive={isActive}
                animatedValue={animatedValues[index]}
              />
            ) : (
              <Animated.View
                style={[
                  styles.iconWrapper,
                  {
                    backgroundColor: isActive ? themeColors.primary + '30' : 'transparent',
                    transform: [{ scale: iconScale }],
                  },
                ]}
              >
                {tab.iconSet === 'fa5' ? (
                  <FAIcon
                    name={tab.icon}
                    size={20}
                    color={isActive ? themeColors.primary : themeColors.text.secondary}
                    solid={tab.faStyle === 'solid'}
                  />
                ) : (
                  <MaterialIcon
                    name={tab.icon}
                    size={24}
                    color={isActive ? themeColors.primary : themeColors.text.secondary}
                  />
                )}
              </Animated.View>
            )}
          </View>

          {/* Glow effect for active tab - rendered behind icon */}
          {isActive && (
            <Animated.View
              style={[
                styles.glow,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                  backgroundColor: themeColors.primary,
                },
              ]}
            />
          )}

          {/* Ripple effect - rendered behind icon */}
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
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: themeColors.surface.header }]}
      edges={[ 'left', 'right']}
    >
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? -30 : 30,
    left: 0,
    right: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
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
    paddingBottom: 0,
    justifyContent: 'center',

  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingBottom: 5,
    position: 'relative',
    minHeight: 55,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 20,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    paddingBottom: 0,
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
    marginBottom: 0,
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
});

export default ProfessionalTabBar;
