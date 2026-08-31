import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface AnimatedTabIconProps {
  iconSource: React.FC<{ size?: number; color?: string }>;
  size?: number;
  isActive?: boolean;
  animatedValue?: unknown;
}

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = ({
  iconSource: IconComponent,
  size = 22,
  isActive = false,
}) => {
  const { colors: themeColors } = useTheme();
  const color = isActive ? themeColors.primary : themeColors.text.tertiary;

  return (
    <View style={styles.container}>
      <IconComponent size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedTabIcon;
