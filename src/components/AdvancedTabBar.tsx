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

interface AdvancedTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  tabs: TabItem[];
}

const AdvancedTabBar: React.FC<AdvancedTabBarProps> = ({
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
      outputRange: [1, 1.15],
    });

    const translateY = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, -6],
    });

    const iconColor = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [themeColors.gray[500], themeColors.primary],
    });

    const labelOpacity = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const backgroundColor = animatedValues[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', themeColors.primary + '15'],
    });

    return (
      <TouchableOpacity
        key={tab.name}
        style={styles.tabItem}
        onPress={onPress}
        activeOpacity={0.8}
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
          {/* Icon container */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor: isActive ? themeColors.primary + '20' : 'transparent',
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.iconInner,
                  {
                    backgroundColor: isActive ? themeColors.primary + '10' : 'transparent',
                  },
                ]}
              >
                <Icon
                  name={tab.icon}
                  size={26}
                  color={isActive ? themeColors.primary : themeColors.gray[500]}
                />
                
                {/* Badge */}
                {tab.badge && tab.badge > 0 && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: themeColors.status.error,
                        shadowColor: themeColors.status.error,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: themeColors.white }]}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </View>
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
                fontWeight: isActive ? '700' : '500',
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
              opacity: 0.1,
            },
          ]}
        />
      </View>

      {/* Animated indicator */}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 25,
  },
  topGradientContainer: {
    height: 2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  topGradient: {
    flex: 1,
    borderRadius: 1,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: width / 5, // Assuming 5 tabs
    height: 3,
    borderRadius: 1.5,
    shadowColor: '#29b1a9',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
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
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: '#FF3B30',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  bottomContainer: {
    height: Platform.OS === 'ios' ? 34 : 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  bottomGradient: {
    flex: 1,
  },
});

export default AdvancedTabBar;
