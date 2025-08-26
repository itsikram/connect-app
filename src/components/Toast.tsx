import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
  position?: 'top' | 'bottom';
  showIcon?: boolean;
  showCloseButton?: boolean;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
  position = 'top',
  showIcon = true,
  showCloseButton = false,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  const getToastConfig = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.success,
          icon: 'check-circle',
          iconColor: colors.white,
        };
      case 'error':
        return {
          backgroundColor: colors.error,
          icon: 'error',
          iconColor: colors.white,
        };
      case 'warning':
        return {
          backgroundColor: colors.warning,
          icon: 'warning',
          iconColor: colors.white,
        };
      case 'info':
      default:
        return {
          backgroundColor: colors.info,
          icon: 'info',
          iconColor: colors.white,
        };
    }
  };

  const showToast = () => {
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
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  useEffect(() => {
    if (visible) {
      showToast();
      
      if (duration > 0) {
        const timer = setTimeout(() => {
          hideToast();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      hideToast();
    }
  }, [visible, duration]);

  if (!visible) return null;

  const config = getToastConfig(type);
  const statusBarHeight = StatusBar.currentHeight || 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          transform: [
            {
              translateY: position === 'top' 
                ? translateY.interpolate({
                    inputRange: [-100, 0],
                    outputRange: [-100, statusBarHeight + 10],
                  })
                : translateY.interpolate({
                    inputRange: [0, 100],
                    outputRange: [0, 100],
                  }),
            },
            { scale },
          ],
          opacity,
          top: position === 'top' ? 0 : undefined,
          bottom: position === 'bottom' ? 0 : undefined,
        },
      ]}
    >
      <View style={styles.content}>
        {showIcon && (
          <Icon
            name={config.icon as any}
            size={24}
            color={config.iconColor}
            style={styles.icon}
          />
        )}
        
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        
        {showCloseButton && (
          <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
            <Icon name="close" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
});

export default Toast;
