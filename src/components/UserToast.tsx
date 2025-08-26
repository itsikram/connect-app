import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme/colors';

export interface UserToastProps {
  visible: boolean;
  userProfilePic?: string;
  fullName: string;
  message: string;
  type?: 'message' | 'friend' | 'notification' | 'custom';
  duration?: number;
  onHide?: () => void;
  onPress?: () => void;
  position?: 'top' | 'bottom';
  showCloseButton?: boolean;
}

const UserToast: React.FC<UserToastProps> = ({
  visible,
  userProfilePic,
  fullName,
  message,
  type = 'message',
  duration = 4000,
  onHide,
  onPress,
  position = 'top',
  showCloseButton = true,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  const getToastConfig = (type: string) => {
    switch (type) {
      case 'message':
        return {
          backgroundColor: colors.primary,
          icon: 'message',
          iconColor: colors.white,
          borderColor: colors.primaryLight,
        };
      case 'friend':
        return {
          backgroundColor: colors.secondary,
          icon: 'person-add',
          iconColor: colors.white,
          borderColor: colors.secondaryLight,
        };
      case 'notification':
        return {
          backgroundColor: colors.info,
          icon: 'notifications',
          iconColor: colors.white,
          borderColor: colors.info,
        };
      case 'custom':
      default:
        return {
          backgroundColor: colors.gray[800],
          icon: 'info',
          iconColor: colors.white,
          borderColor: colors.gray[700],
        };
    }
  };

  const showToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
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
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
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
  

  const ToastContent = () => (
    <View style={styles.content}>
      <View style={styles.userInfo}>
        <View style={styles.profilePicContainer}>
          {userProfilePic ? (
            <Image
              source={{ uri: userProfilePic }}
              style={styles.profilePic}
            />
          ) : (
            <View style={[styles.profilePic, styles.defaultProfilePic]}>
              <Icon name="person" size={24} color={colors.gray[400]} />
            </View>
          )}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.fullName} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        </View>
        
        <View style={styles.iconContainer}>
          <Icon
            name={config.icon as any}
            size={20}
            color={config.iconColor}
          />
        </View>
      </View>
      
      {showCloseButton && (
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Icon name="close" size={18} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          transform: [
            {
              translateY: position === 'top' 
                ? translateY.interpolate({
                    inputRange: [-100, 0],
                    outputRange: [-100, 0],
                  })
                : translateY.interpolate({
                    inputRange: [0, 50],
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
      {onPress ? (
        <TouchableOpacity onPress={onPress} style={styles.touchableContainer}>
          <ToastContent />
        </TouchableOpacity>
      ) : (
        <ToastContent />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  touchableContainer: {
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 65,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicContainer: {
    marginRight: 12,
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[200],
  },
  defaultProfilePic: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[300],
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  fullName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  message: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    opacity: 0.95,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default UserToast;
