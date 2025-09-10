import React, { useState, useRef } from 'react';
import { TouchableOpacity, ViewStyle, StyleSheet, GestureResponderEvent, Image, View, PanResponder, Dimensions, Text } from 'react-native';
import FloatingMenu from './FloatingMenu';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
  const [dragPosition, setDragPosition] = useState({ x: 20, y: 100 }); // Default position (left, top) for debugging
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
    // Only handle press if not dragging
    if (isDragging) return;
    
    if (showMenu && menuOptions.length > 0) {
      // Use current drag position for menu placement
      setButtonPosition({
        x: dragPosition.x + 28, // Center of button (56/2)
        y: dragPosition.y + 28,
      });
      setMenuVisible(true);
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

  // Debug logging
  console.log('FloatingButton render - dragPosition:', dragPosition, 'isDragging:', isDragging);

  return (
    <View>
      <View
        {...panResponder.panHandlers}
        style={[
          styles.container,
          {
            left: dragPosition.x,
            top: dragPosition.y,
            opacity: isDragging ? 0.8 : 1,
            transform: [{ scale: isDragging ? 1.1 : 1 }],
            zIndex: 9999, // Ensure it's on top
          },
          style,
        ]}
      >
        <TouchableOpacity
          ref={buttonRef}
          activeOpacity={0.85}
          onPress={handlePress}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={label || 'Floating button'}
        >
          {icon ? icon : (
            <Image
              source={require('../assets/image/logo.png')}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </View>
      
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
    width: 56,
    height: 56,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF0000', // Bright red for debugging
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});



