import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MenuOption {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

interface FloatingMenuProps {
  visible: boolean;
  onClose: () => void;
  options: MenuOption[];
  buttonPosition: { x: number; y: number };
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  visible,
  onClose,
  options,
  buttonPosition,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const menuItemsAnim = useRef(options.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      // Show menu with scale animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Stagger menu items animation
      const staggerDelay = 50;
      options.forEach((_, index) => {
        setTimeout(() => {
          Animated.spring(menuItemsAnim[index], {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }, index * staggerDelay);
      });
    } else {
      // Hide menu
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        ...menuItemsAnim.map(anim =>
          Animated.timing(anim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          })
        ),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim, menuItemsAnim, options]);

  if (!visible) return null;

  const menuRadius = 120;
  const itemRadius = 30;
  const centerX = buttonPosition.x;
  const centerY = buttonPosition.y;

  const getItemPosition = (index: number) => {
    const angle = (index * (2 * Math.PI)) / options.length - Math.PI / 2;
    const x = centerX + menuRadius * Math.cos(angle) - itemRadius;
    const y = centerY + menuRadius * Math.sin(angle) - itemRadius;
    return { x, y };
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.menuContainer,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {options.map((option, index) => {
          const position = getItemPosition(index);
          return (
            <Animated.View
              key={option.id}
              style={[
                styles.menuItem,
                {
                  left: position.x,
                  top: position.y,
                  transform: [
                    {
                      scale: menuItemsAnim[index],
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.menuItemButton,
                  { backgroundColor: option.color || '#2196F3' },
                ]}
                onPress={() => {
                  option.onPress();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Icon name={option.icon} size={20} color="white" />
              </TouchableOpacity>
              <Text style={styles.menuItemLabel}>{option.label}</Text>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuItem: {
    position: 'absolute',
    alignItems: 'center',
  },
  menuItemButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  menuItemLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default FloatingMenu;
