import React from 'react';
import { View, StyleSheet } from 'react-native';
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

const styles = StyleSheet.create({
  faceWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
