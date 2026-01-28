import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface AnimatedTabIconProps {
  iconSource: React.FC<any>;
  size?: number;
  isActive?: boolean;
  animatedValue?: Animated.Value;
}

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = ({ 
  iconSource, 
  size = 28, // Increased from 24
  isActive = false,
  animatedValue = new Animated.Value(0)
}) => {
  const { colors: themeColors } = useTheme();
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  // Pulse animation for active state - reduced intensity
  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.03, // Further reduced to minimize pixelation
            duration: 1500, // Slower for smoother animation
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isActive, pulseAnimation]);
  
  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05], // Further reduced from 1.08
  });

  const rotate = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1deg'], // Further reduced from 2deg
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1], // Increased base opacity for better visibility
  });

  const iconColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [themeColors.gray[500], themeColors.primary],
  });

  const IconComponent = iconSource;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ scale: Animated.multiply(scale, pulseAnimation) }, { rotate }],
          opacity,
        }
      ]}
    >
      <View style={styles.iconWrapper}>
        <IconComponent 
          width={size * 1.5} // Increased from 1.2 to 1.5 for higher resolution
          height={size * 1.5} // Increased from 1.2 to 1.5 for higher resolution
          fill={iconColor}
        />
      </View>
      
      {/* Active state glow effect */}
      {isActive && (
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: themeColors.primary,
              opacity: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15], // Further reduced glow intensity
              }),
              transform: [
                {
                  scale: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1.05], // Further reduced glow scale
                  }),
                }
              ],
            }
          ]}
        />
      )}
      
      {/* Ripple effect for active state */}
      {isActive && (
        <Animated.View
          style={[
            styles.ripple,
            {
              borderColor: themeColors.primary,
              opacity: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3], // Further reduced ripple opacity
              }),
              transform: [
                {
                  scale: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2], // Further reduced ripple scale
                  }),
                }
              ],
            }
          ]}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36, // Increased from 30 to accommodate larger icons
    height: 36, // Increased from 30 to accommodate larger icons
    zIndex: 2,
    // Ensure crisp rendering
    transform: [{ translateX: 0 }, { translateY: 0 }], // Force pixel alignment
  },
  glow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 16,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3, // Reduced shadow
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1,
  },
  ripple: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 20,
    borderWidth: 2,
    zIndex: 0,
  },
});

export default AnimatedTabIcon;
