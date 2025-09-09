import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonBlockProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export const useSkeletonColors = () => {
    const { colors: themeColors, isDarkMode } = useTheme();
    const base = themeColors.surface.secondary;
    // Subtle highlight based on theme
    const highlight = isDarkMode ? themeColors.surface.primary : themeColors.background.primary;
    return { baseColor: base, highlightColor: highlight };
};

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
    const { baseColor } = useSkeletonColors();
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

    const overlayOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

    return (
        <View style={[{ width, height, borderRadius, overflow: 'hidden', backgroundColor: baseColor }, style]}
        >
            <Animated.View
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', opacity: overlayOpacity }}
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


