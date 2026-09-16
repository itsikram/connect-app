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

const DICE_LAND_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

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
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const rotationRef = useRef({ x: 0, y: 0 });
  const rollingRef = useRef(false);

  useEffect(() => {
    if (!rolling || rollingRef.current) return;
    rollingRef.current = true;

    const land = DICE_LAND_ROTATION[value] || DICE_LAND_ROTATION[1];
    const directionX = Math.random() > 0.5 ? 1 : -1;
    const directionY = Math.random() > 0.5 ? 1 : -1;
    const targetX = rotationRef.current.x + directionX * 360 * (4 + Math.floor(Math.random() * 3));
    const targetY = rotationRef.current.y + directionY * 360 * (3 + Math.floor(Math.random() * 3));
    const alignX = ((land.x - targetX) % 360 + 360) % 360;
    const alignY = ((land.y - targetY) % 360 + 360) % 360;
    const nextRotation = { x: targetX + alignX, y: targetY + alignY };
    rotationRef.current = nextRotation;

    rotateX.setValue(rotationRef.current.x - directionX * 360);
    rotateY.setValue(rotationRef.current.y - directionY * 360);
    bounce.setValue(0);
    Animated.parallel([
      Animated.timing(rotateX, {
        toValue: nextRotation.x,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rotateY, {
        toValue: nextRotation.y,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: durationMs * 0.45, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: durationMs * 0.55, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      rollingRef.current = false;
    });
  }, [bounce, durationMs, rotateX, rotateY, rolling, value]);

  const faceSize = size * 0.78;
  const half = faceSize / 2;
  const faceStyle = {
    position: 'absolute' as const,
    width: faceSize,
    height: faceSize,
    left: (size - faceSize) / 2,
    top: (size - faceSize) / 2,
  };
  const faces = [
    { value: 1, transform: [{ rotateY: '0deg' as const }, { translateZ: half }] },
    { value: 2, transform: [{ rotateX: '90deg' as const }, { translateZ: half }] },
    { value: 3, transform: [{ rotateY: '90deg' as const }, { translateZ: half }] },
    { value: 4, transform: [{ rotateY: '-90deg' as const }, { translateZ: half }] },
    { value: 5, transform: [{ rotateX: '-90deg' as const }, { translateZ: half }] },
    { value: 6, transform: [{ rotateY: '180deg' as const }, { translateZ: half }] },
  ];

  return (
    <Animated.View
      style={[
        styles.cube,
        {
          width: size,
          height: size,
          transform: [
            { perspective: size * 6 },
            { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.18] }) },
            { rotateX: rotateX.interpolate({ inputRange: [-7200, 7200], outputRange: ['-7200deg', '7200deg'] }) },
            { rotateY: rotateY.interpolate({ inputRange: [-7200, 7200], outputRange: ['-7200deg', '7200deg'] }) },
          ],
        },
      ]}
    >
      <View style={styles.shadow} />
      {faces.map((face) => (
        // React Native supports translateZ at runtime for 3D transforms, but
        // its installed style typings do not declare the transform key.
        // @ts-expect-error translateZ is required to position cube faces.
        <View key={face.value} style={[faceStyle, { transform: face.transform }]}>
          <DiceSVG value={face.value} size={faceSize} strokeColor={strokeColor} />
        </View>
      ))}
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
