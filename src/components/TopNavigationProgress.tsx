import React, { useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export type TopNavigationProgressRef = {
  trigger: () => void;
};

const BAR_HEIGHT = 2;

const TopNavigationProgress = React.forwardRef<TopNavigationProgressRef>((_, ref) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const widthAnim = useRef(new Animated.Value(0)).current; // 0..1 (percentage)
  const opacityAnim = useRef(new Animated.Value(0)).current; // 0..1
  const isAnimating = useRef(false);

  const barColor = themeColors.primary;
  // Sit on the Facebook Header's top edge (below status bar / notch), like a top border.
  const topOffset = insets.top;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      top: topOffset,
      left: 0,
      right: 0,
      height: BAR_HEIGHT,
      zIndex: 9999,
      elevation: 9999,
      overflow: 'visible',
      pointerEvents: 'none',
    },
    bar: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: BAR_HEIGHT,
      backgroundColor: barColor,
    },
    peg: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 80,
      height: BAR_HEIGHT,
      backgroundColor: barColor,
      ...Platform.select({
        ios: {
          shadowColor: barColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 6,
        },
        android: {
          elevation: 8,
        },
        default: {},
      }),
    },
  }), [barColor, topOffset]);

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
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.bar, { width: widthInterpolate }]}>
        <Animated.View style={styles.peg} />
      </Animated.View>
    </Animated.View>
  );
});

export default TopNavigationProgress;


