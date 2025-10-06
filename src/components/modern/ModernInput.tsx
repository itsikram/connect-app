import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ModernInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
}

const ModernInput = forwardRef<TextInput, ModernInputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  variant = 'default',
  size = 'medium',
  fullWidth = true,
  containerStyle,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: fullWidth ? '100%' : undefined,
      marginBottom: spacing.sm,
    };

    return { ...baseStyle, ...containerStyle };
  };

  const getInputContainerStyle = (): ViewStyle => {
    const sizeStyles = {
      small: {
        height: 40,
        paddingHorizontal: spacing.sm,
      },
      medium: {
        height: 48,
        paddingHorizontal: spacing.md,
      },
      large: {
        height: 56,
        paddingHorizontal: spacing.lg,
      },
    };

    const variantStyles = {
      default: {
        backgroundColor: colors.surface.secondary,
        borderWidth: 1,
        borderColor: isFocused ? colors.primary : colors.border.primary,
        borderRadius: borderRadius.md,
      },
      filled: {
        backgroundColor: colors.surface.elevated,
        borderWidth: 1,
        borderColor: isFocused ? colors.primary : 'transparent',
        borderRadius: borderRadius.md,
      },
      outlined: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: isFocused ? colors.primary : colors.border.primary,
        borderRadius: borderRadius.md,
      },
    };

    return {
      flexDirection: 'row',
      alignItems: 'center',
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(isFocused ? shadows.small : {}),
    };
  };

  const getInputStyle = (): TextStyle => {
    const sizeStyles = {
      small: typography.bodySmall,
      medium: typography.body,
      large: {
        ...typography.body,
        fontSize: 18,
      },
    };

    return {
      ...sizeStyles[size],
      color: colors.text.primary,
      flex: 1,
      paddingVertical: 0,
      fontFamily: 'Inter-Regular',
    };
  };

  const getLabelStyle = (): TextStyle => {
    return {
      ...typography.label,
      color: isFocused ? colors.primary : colors.text.secondary,
      marginBottom: spacing.xs,
      fontFamily: 'Inter-Medium',
    };
  };

  const getHelperTextStyle = (): TextStyle => {
    return {
      ...typography.caption,
      color: error ? colors.status.error : colors.text.tertiary,
      marginTop: spacing.xs,
      fontFamily: 'Inter-Regular',
    };
  };

  return (
    <View style={getContainerStyle()}>
      {label && (
        <Text style={[getLabelStyle(), labelStyle]}>{label}</Text>
      )}
      
      <View style={getInputContainerStyle()}>
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={20}
            color={isFocused ? colors.primary : colors.text.secondary}
            style={{ marginRight: spacing.sm }}
          />
        )}
        
        <TextInput
          ref={ref}
          style={[getInputStyle(), inputStyle]}
          placeholderTextColor={colors.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={{ padding: spacing.xs }}
          >
            <Icon
              name={rightIcon}
              size={20}
              color={isFocused ? colors.primary : colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {(error || helperText) && (
        <Text style={getHelperTextStyle()}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
});

ModernInput.displayName = 'ModernInput';

export default ModernInput;
