import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
// LinearGradient replaced with View for Expo compatibility
// import LinearGradient from 'react-native-linear-gradient';

interface ModernLoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  variant?: 'default' | 'gradient' | 'pulse' | 'dots';
  style?: ViewStyle;
}

const ModernLoading: React.FC<ModernLoadingProps> = ({
  size = 'large',
  color,
  text,
  variant = 'default',
  style,
}) => {
  const { colors, typography, spacing } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant === 'pulse') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }

    if (variant === 'gradient') {
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();
      return () => rotateAnimation.stop();
    }
  }, [variant]);

  const getLoadingColor = () => {
    if (color) return color;
    return colors.primary;
  };

  const renderDefault = () => (
    <ActivityIndicator
      size={size}
      color={getLoadingColor()}
    />
  );

  const renderGradient = () => {
    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.View style={{ transform: [{ rotate }] }}>
        <View
          style={[
            styles.gradientLoader,
            {
              width: size === 'large' ? 40 : 24,
              height: size === 'large' ? 40 : 24,
              borderRadius: size === 'large' ? 20 : 12,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </Animated.View>
    );
  };

  const renderPulse = () => (
    <Animated.View
      style={[
        styles.pulseLoader,
        {
          width: size === 'large' ? 40 : 24,
          height: size === 'large' ? 40 : 24,
          borderRadius: size === 'large' ? 20 : 12,
          backgroundColor: getLoadingColor(),
          transform: [{ scale: pulseAnim }],
        },
      ]}
    />
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: getLoadingColor(),
              width: size === 'large' ? 8 : 6,
              height: size === 'large' ? 8 : 6,
              borderRadius: size === 'large' ? 4 : 3,
              opacity: pulseAnim.interpolate({
                inputRange: [1, 1.2],
                outputRange: [0.3, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [1, 1.2],
                    outputRange: [1, 1.5],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'gradient':
        return renderGradient();
      case 'pulse':
        return renderPulse();
      case 'dots':
        return renderDots();
      default:
        return renderDefault();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {renderLoader()}
      {text && (
        <Text
          style={[
            styles.text,
            {
              color: colors.text.secondary,
              fontSize: size === 'large' ? 16 : 14,
              marginTop: spacing.sm,
            },
            typography.body,
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  gradientLoader: {
    borderWidth: 3,
    borderColor: 'transparent',
  },
  pulseLoader: {
    opacity: 0.8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    marginHorizontal: 4,
  },
  text: {
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
});

export default ModernLoading;

