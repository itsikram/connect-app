import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonBlockProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}

export const useSkeletonColors = () => {
    const { colors: themeColors, isDarkMode } = useTheme();
    const base = themeColors?.surface?.secondary || themeColors?.gray?.[200] || (isDarkMode ? '#242526' : '#F1F3F4');
    const highlight = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.72)';
    const edge = isDarkMode ? 'rgba(0, 212, 255, 0.08)' : 'rgba(0, 120, 160, 0.06)';
    return { baseColor: base, highlightColor: highlight, edgeColor: edge };
};

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
    const { baseColor, highlightColor, edgeColor } = useSkeletonColors();
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [pulse]);

    const shimmerX = pulse.interpolate({ inputRange: [0, 1], outputRange: [-180, 180] });
    const overlayOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.75] });

    return (
        <View style={[{ width, height, borderRadius, overflow: 'hidden', backgroundColor: baseColor }, style]}
        >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: edgeColor }} />
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '45%',
                    backgroundColor: highlightColor,
                    opacity: overlayOpacity,
                    transform: [{ translateX: shimmerX }],
                }}
            />
        </View>
    );
};

export const SkeletonRow: React.FC<{ spacing?: number; style?: ViewStyle } & React.PropsWithChildren> = ({ spacing = 8, style, children }) => {
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}
        >
            {React.Children.map(children, (child, idx) => (
                <View style={{ marginRight: idx < React.Children.count(children) - 1 ? spacing : 0 }}>{child}</View>
            ))}
        </View>
    );
};

export const SkeletonColumn: React.FC<{ spacing?: number; style?: ViewStyle } & React.PropsWithChildren> = ({ spacing = 8, style, children }) => {
    return (
        <View style={[{ flexDirection: 'column' }, style]}
        >
            {React.Children.map(children, (child, idx) => (
                <View style={{ marginBottom: idx < React.Children.count(children) - 1 ? spacing : 0 }}>{child}</View>
            ))}
        </View>
    );
};
