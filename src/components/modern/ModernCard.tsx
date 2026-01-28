import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
// LinearGradient replaced with View for Expo compatibility
// import LinearGradient from 'react-native-linear-gradient';

interface ModernCardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  padding?: 'none' | 'small' | 'medium' | 'large';
  margin?: 'none' | 'small' | 'medium' | 'large';
  borderRadius?: 'small' | 'medium' | 'large' | 'xl';
  shadow?: 'none' | 'small' | 'medium' | 'large';
  gradient?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const ModernCard: React.FC<ModernCardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  margin = 'small',
  borderRadius = 'medium',
  shadow = 'medium',
  gradient = false,
  onPress,
  style,
  ...touchableProps
}) => {
  const { colors, borderRadius: themeBorderRadius, spacing, shadows, isDarkMode } = useTheme();

  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: colors.surface.primary,
      borderWidth: 1,
      borderColor: colors.border.primary,
    };

    // Padding styles
    const paddingStyles = {
      none: {},
      small: { padding: spacing.sm },
      medium: { padding: spacing.md },
      large: { padding: spacing.lg },
    };

    // Margin styles
    const marginStyles = {
      none: {},
      small: { margin: spacing.sm },
      medium: { margin: spacing.md },
      large: { margin: spacing.lg },
    };

    // Border radius styles
    const borderRadiusStyles = {
      small: { borderRadius: themeBorderRadius.sm },
      medium: { borderRadius: themeBorderRadius.md },
      large: { borderRadius: themeBorderRadius.lg },
      xl: { borderRadius: themeBorderRadius.xl },
    };

    // Shadow styles
    const shadowStyles = {
      none: shadows.none,
      small: shadows.small,
      medium: shadows.medium,
      large: shadows.large,
    };

    // Variant styles
    const variantStyles = {
      default: {
        backgroundColor: colors.surface.primary,
        borderColor: colors.border.primary,
      },
      elevated: {
        backgroundColor: colors.surface.elevated,
        borderColor: colors.border.secondary,
      },
      outlined: {
        backgroundColor: 'transparent',
        borderColor: colors.border.primary,
        borderWidth: 2,
      },
      glass: {
        backgroundColor: 'transparent',
        borderColor: isDarkMode ? colors.border.muted : colors.border.subtle,
        borderWidth: 1,
      },
    };

    return {
      ...baseStyle,
      ...paddingStyles[padding],
      ...marginStyles[margin],
      ...borderRadiusStyles[borderRadius],
      ...shadowStyles[shadow],
      ...variantStyles[variant],
    };
  };

  const CardComponent = onPress ? TouchableOpacity : View;
  const cardProps = onPress ? { activeOpacity: 0.95, ...touchableProps } : {};

  if (gradient) {
    return (
      <View style={[getCardStyle(), { backgroundColor: colors.surface.primary }, style]}>
        <CardComponent {...cardProps}>
          {children}
        </CardComponent>
      </View>
    );
  }

  return (
    <CardComponent
      style={[getCardStyle(), style]}
      onPress={onPress}
      {...cardProps}
    >
      {children}
    </CardComponent>
  );
};

export default ModernCard;
