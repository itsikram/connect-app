import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { THEME } from './constants';

export const DICE_PIP_POSITIONS: Record<number, number[][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

interface DiceSVGProps {
  value: number;
  size?: number;
  strokeColor?: string;
}

export const DiceSVG: React.FC<DiceSVGProps> = ({
  value,
  size = 80,
  strokeColor = THEME.accent,
}) => {
  const pts = value && DICE_PIP_POSITIONS[value] ? DICE_PIP_POSITIONS[value] : [];
  const gradId = `diceGrad-${String(strokeColor).replace('#', '')}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#ffffff" />
          <Stop offset="100%" stopColor="#e8ecf0" />
        </LinearGradient>
      </Defs>
      <Rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="16"
        ry="16"
        fill={`url(#${gradId})`}
        stroke={strokeColor}
        strokeWidth="4"
      />
      {pts.map(([x, y], idx) => (
        <Circle key={idx} cx={x} cy={y} r={7} fill="#1a2330" />
      ))}
    </Svg>
  );
};

interface DiceFacePipsProps {
  value: number;
  size: number;
  strokeColor: string;
}

export const DiceFace: React.FC<DiceFacePipsProps> = ({ value, size, strokeColor }) => (
  <View style={[styles.faceWrap, { width: size, height: size }]}>
    <DiceSVG value={value} size={size} strokeColor={strokeColor} />
  </View>
);

interface Dice3DProps {
  value: number;
  size?: number;
  strokeColor?: string;
  rolling?: boolean;
  durationMs?: number;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  value = 1,
  size = 80,
  strokeColor = THEME.accent,
  rolling = false,
  durationMs = 950,
}) => {
  const rotate = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.55)).current;
  const rollingRef = useRef(false);

  useEffect(() => {
    if (!rolling || rollingRef.current) return;
    rollingRef.current = true;

    const turns = 4 + Math.floor(Math.random() * 3);
    const direction = Math.random() > 0.5 ? 1 : -1;
    rotate.setValue(0);
    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(1);
    shadowScale.setValue(1);
    shadowOpacity.setValue(0.55);
    Animated.parallel([
      Animated.timing(rotate, {
        toValue: direction * turns,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateX, { toValue: 10, duration: durationMs * 0.12, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -26, duration: durationMs * 0.12, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.08, duration: durationMs * 0.12, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: -14, duration: durationMs * 0.16, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -6, duration: durationMs * 0.16, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.96, duration: durationMs * 0.16, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: 12, duration: durationMs * 0.16, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -22, duration: durationMs * 0.16, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.1, duration: durationMs * 0.16, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: -8, duration: durationMs * 0.14, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -2, duration: durationMs * 0.14, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.98, duration: durationMs * 0.14, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: 6, duration: durationMs * 0.16, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -14, duration: durationMs * 0.16, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.05, duration: durationMs * 0.16, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: -3, duration: durationMs * 0.14, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -3, duration: durationMs * 0.14, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.01, duration: durationMs * 0.14, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: 0, duration: durationMs * 0.12, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: durationMs * 0.12, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: durationMs * 0.12, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.timing(shadowScale, { toValue: 0.62, duration: durationMs * 0.18, useNativeDriver: true }),
        Animated.timing(shadowScale, { toValue: 1.05, duration: durationMs * 0.14, useNativeDriver: true }),
        Animated.timing(shadowScale, { toValue: 0.62, duration: durationMs * 0.2, useNativeDriver: true }),
        Animated.timing(shadowScale, { toValue: 1.05, duration: durationMs * 0.14, useNativeDriver: true }),
        Animated.timing(shadowScale, { toValue: 1, duration: durationMs * 0.34, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(shadowOpacity, { toValue: 0.28, duration: durationMs * 0.18, useNativeDriver: true }),
        Animated.timing(shadowOpacity, { toValue: 0.6, duration: durationMs * 0.14, useNativeDriver: true }),
        Animated.timing(shadowOpacity, { toValue: 0.28, duration: durationMs * 0.2, useNativeDriver: true }),
        Animated.timing(shadowOpacity, { toValue: 0.6, duration: durationMs * 0.14, useNativeDriver: true }),
        Animated.timing(shadowOpacity, { toValue: 0.55, duration: durationMs * 0.34, useNativeDriver: true }),
      ]),
    ]).start(() => {
      rollingRef.current = false;
    });
  }, [durationMs, rotate, rolling, scale, shadowOpacity, shadowScale, translateX, translateY]);

  const faceSize = size * 0.78;
  const faceStyle = {
    position: 'absolute' as const,
    width: faceSize,
    height: faceSize,
    left: (size - faceSize) / 2,
    top: (size - faceSize) / 2,
  };
  return (
    <Animated.View
      style={[
        styles.cube,
        {
          width: size,
          height: size,
          transform: [
            { translateX },
            { translateY },
            { scale },
            { rotate: rotate.interpolate({ inputRange: [-2160, 2160], outputRange: ['-2160deg', '2160deg'] }) },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.shadow,
          { transform: [{ scaleX: shadowScale }], opacity: shadowOpacity },
        ]}
      />
      <View style={faceStyle}>
        <DiceSVG value={value} size={faceSize} strokeColor={strokeColor} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  faceWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cube: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    bottom: '2%',
    height: '14%',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
});
