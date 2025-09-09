import React, { useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type TopNavigationProgressRef = {
  trigger: () => void;
};

const TopNavigationProgress = React.forwardRef<TopNavigationProgressRef>((_, ref) => {
  const { colors: themeColors } = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current; // 0..1 (percentage)
  const opacityAnim = useRef(new Animated.Value(0)).current; // 0..1
  const isAnimating = useRef(false);

  const barColor = themeColors.primary;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      zIndex: 9999,
      overflow: 'hidden',
      pointerEvents: 'none',
    },
    bar: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: barColor,
    },
  }), [barColor]);

  const trigger = () => {
    if (isAnimating.current) {
      // If already animating, restart to give feedback for a new navigation
      widthAnim.stopAnimation();
      opacityAnim.stopAnimation();
    }
    isAnimating.current = true;

    widthAnim.setValue(0);
    opacityAnim.setValue(0);

    const toSeventy = Animated.timing(widthAnim, {
      toValue: 0.7,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    const toNinety = Animated.timing(widthAnim, {
      toValue: 0.9,
      duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    const toHundred = Animated.timing(widthAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    const fadeIn = Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: false,
    });
    const fadeOut = Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 200,
      delay: 60,
      useNativeDriver: false,
    });

    Animated.sequence([
      Animated.parallel([fadeIn, toSeventy]),
      toNinety,
      Animated.parallel([toHundred, fadeOut]),
    ]).start(() => {
      isAnimating.current = false;
      widthAnim.setValue(0);
    });
  };

  useImperativeHandle(ref, () => ({ trigger }), [trigger]);

  const widthInterpolate = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}
    >
      <Animated.View style={[styles.bar, { width: widthInterpolate }]} />
    </Animated.View>
  );
});

export default TopNavigationProgress;


