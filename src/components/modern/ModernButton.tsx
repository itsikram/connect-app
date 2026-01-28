import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
// LinearGradient replaced with View for Expo compatibility
// import LinearGradient from 'react-native-linear-gradient';

interface ModernButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'filled' | 'soft' | 'glass' | 'modern';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const ModernButton: React.FC<ModernButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}) => {
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: borderRadius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.medium,
    };

    // Size styles
    const sizeStyles = {
      small: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 48,
      },
      large: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        minHeight: 56,
      },
    };

    // Variant styles
    const variantStyles = {
      primary: {
        backgroundColor: colors.primary,
      },
      secondary: {
        backgroundColor: colors.surface.primary,
        borderWidth: 1,
        borderColor: colors.border.primary,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      danger: {
        backgroundColor: colors.status.error,
      },
      filled: {
        backgroundColor: colors.surface.secondary,
        borderWidth: 1,
        borderColor: colors.border.primary,
      },
      soft: {
        backgroundColor: `${colors.primary}15`, // 15% opacity
        borderWidth: 1,
        borderColor: `${colors.primary}30`, // 30% opacity
      },
      glass: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
      modern: {
        backgroundColor: colors.surface.elevated,
        borderWidth: 1,
        borderColor: `${colors.primary}20`,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      width: fullWidth ? '100%' : undefined,
      opacity: disabled || loading ? 0.6 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    const sizeTextStyles = {
      small: typography.bodySmall,
      medium: typography.button,
      large: {
        ...typography.button,
        fontSize: 18,
      },
    };

    const variantTextStyles = {
      primary: { color: '#FFFFFF' },
      secondary: { color: colors.text.primary },
      outline: { color: colors.primary },
      ghost: { color: colors.primary },
      danger: { color: '#FFFFFF' },
      filled: { color: colors.text.primary },
      soft: { color: colors.primary },
      glass: { color: colors.text.primary },
      modern: { color: colors.text.primary },
    };

    return {
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
      fontWeight: '500' as const,
      textAlign: 'center' as const,
    };
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary}
        />
      );
    }

    return (
      <View style={styles.content}>
        {icon && iconPosition === 'left' && (
          <View style={[styles.icon, { marginRight: spacing.xs }]}>
            {icon}
          </View>
        )}
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <View style={[styles.icon, { marginLeft: spacing.xs }]}>
            {icon}
          </View>
        )}
      </View>
    );
  };

  if (variant === 'primary' || variant === 'danger' || variant === 'modern') {
    const backgroundColor = variant === 'primary' 
      ? colors.primary
      : variant === 'danger'
      ? colors.status.error
      : colors.surface.elevated;
      
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[getButtonStyle(), { backgroundColor }, style]}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ModernButton;
