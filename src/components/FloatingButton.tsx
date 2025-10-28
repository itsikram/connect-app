import React, { useState, useRef } from 'react';
import { TouchableOpacity, ViewStyle, StyleSheet, GestureResponderEvent, Image, View, PanResponder, Dimensions } from 'react-native';
import FloatingMenu from './FloatingMenu';

type MenuOption = {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
};

type Props = {
  onPress?: (e: GestureResponderEvent) => void;
  style?: ViewStyle;
  icon?: React.ReactNode;
  label?: string;
  menuOptions?: MenuOption[];
  showMenu?: boolean;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function FloatingButton({ 
  onPress, 
  style, 
  icon, 
  label, 
  menuOptions = [],
  showMenu = true 
}: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState({ x: screenWidth - 72, y: screenHeight - 146 }); // Default position (right, bottom)
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<React.ElementRef<typeof TouchableOpacity> | null>(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        const newX = dragPosition.x + gestureState.dx;
        const newY = dragPosition.y + gestureState.dy;
        
        // Keep button within screen bounds
        const buttonSize = 56;
        const clampedX = Math.max(0, Math.min(screenWidth - buttonSize, newX));
        const clampedY = Math.max(0, Math.min(screenHeight - buttonSize - 100, newY)); // 100px margin from bottom for safe area
        
        setDragPosition({ x: clampedX, y: clampedY });
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        
        // Snap to edges
        const buttonSize = 56;
        const centerX = screenWidth / 2;
        const finalX = dragPosition.x < centerX ? 16 : screenWidth - buttonSize - 16;
        
        setDragPosition({ x: finalX, y: dragPosition.y });
      },
    })
  ).current;

  const handlePress = (e: GestureResponderEvent) => {
    if (showMenu && menuOptions.length > 0) {
      // Measure button position for menu placement
      buttonRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setButtonPosition({
          x: pageX + width / 2,
          y: pageY + height / 2,
        });
        setMenuVisible(true);
      });
    }
    
    // Always call onPress if provided, regardless of menu state
    if (onPress) {
      onPress(e);
    }
  };

  const defaultMenuOptions: MenuOption[] = [
    {
      id: 'home',
      icon: 'home',
      label: 'Home',
      onPress: () => console.log('Home pressed'),
      color: '#4CAF50',
    },
    {
      id: 'message',
      icon: 'message',
      label: 'Messages',
      onPress: () => console.log('Messages pressed'),
      color: '#2196F3',
    },
    {
      id: 'camera',
      icon: 'camera-alt',
      label: 'Camera',
      onPress: () => console.log('Camera pressed'),
      color: '#FF9800',
    },
    {
      id: 'profile',
      icon: 'person',
      label: 'Profile',
      onPress: () => console.log('Profile pressed'),
      color: '#9C27B0',
    },
  ];

  const options = menuOptions.length > 0 ? menuOptions : defaultMenuOptions;

  return (
    <View>
      <TouchableOpacity
        ref={buttonRef}
        activeOpacity={0.85}
        onPress={handlePress}
        style={[styles.container, style]}
        accessibilityRole="button"
        accessibilityLabel={label || 'Floating button'}
      >
        {icon ? icon : (
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>
      
      <FloatingMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={options}
        buttonPosition={buttonPosition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#29B1A9',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});



