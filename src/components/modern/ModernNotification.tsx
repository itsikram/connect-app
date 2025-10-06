import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

interface ModernNotificationProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: () => void;
  onPress?: () => void;
  style?: ViewStyle;
}

const ModernNotification: React.FC<ModernNotificationProps> = ({
  type = 'info',
  title,
  message,
  duration = 4000,
  onClose,
  onPress,
  style,
}) => {
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle',
          iconColor: colors.status.success,
          gradientColors: [colors.status.success, '#00A843'],
        };
      case 'error':
        return {
          icon: 'error',
          iconColor: colors.status.error,
          gradientColors: [colors.status.error, '#CC0000'],
        };
      case 'warning':
        return {
          icon: 'warning',
          iconColor: colors.status.warning,
          gradientColors: [colors.status.warning, '#E67C00'],
        };
      case 'info':
      default:
        return {
          icon: 'info',
          iconColor: colors.status.info,
          gradientColors: [colors.status.info, '#0056B3'],
        };
    }
  };

  const typeStyles = getTypeStyles();

  const getNotificationStyle = (): ViewStyle => {
    return {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.md,
      borderLeftWidth: 4,
      borderLeftColor: typeStyles.iconColor,
      ...shadows.large,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      overflow: 'hidden',
    };
  };

  const NotificationContent = () => (
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <Icon
          name={typeStyles.icon}
          size={24}
          color={typeStyles.iconColor}
        />
      </View>
      
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {title}
        </Text>
        {message && (
          <Text style={[styles.message, { color: colors.text.secondary }]}>
            {message}
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        onPress={handleClose}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon
          name="close"
          size={20}
          color={colors.text.secondary}
        />
      </TouchableOpacity>
    </View>
  );

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={[
        getNotificationStyle(),
        {
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
    >
      {type === 'info' ? (
        <Component onPress={onPress} activeOpacity={0.8}>
          <NotificationContent />
        </Component>
      ) : (
        <LinearGradient
          colors={[typeStyles.gradientColors[0] + '20', typeStyles.gradientColors[1] + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: borderRadius.md }}
        >
          <Component onPress={onPress} activeOpacity={0.8}>
            <NotificationContent />
          </Component>
        </LinearGradient>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  closeButton: {
    padding: 4,
    marginTop: -4,
  },
});

export default ModernNotification;
