import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './Logo';

interface LoadingScreenProps {
  message?: string;
  size?: 'small' | 'large';
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  size = 'large' 
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { colors: themeColors, isDarkMode } = useTheme();

  useEffect(() => {
    const startRotation = () => {
      rotateAnim.setValue(0);
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    };

    startRotation();
  }, [rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <Animated.View style={[styles.logoContainer, { transform: [{ rotate: spin }] }]}>
        <Logo size="large" />
      </Animated.View>
      {/* <Text style={[styles.message, { color: themeColors.text.secondary }]}>{message}</Text> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default LoadingScreen;
