import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

interface FloatingBackButtonProps {
  style?: ViewStyle;
  onPress?: () => void;
}

const FloatingBackButton: React.FC<FloatingBackButtonProps> = ({ style, onPress }) => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface.primary,
          shadowColor: themeColors.text.primary,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 1000,
  },
});

export default FloatingBackButton;
