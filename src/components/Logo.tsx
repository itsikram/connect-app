import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium' }) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return { width: 50, height: 50 };
      case 'large':
        return { width: 80, height: 80 };
      default:
        return { width: 60, height: 60 };
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/image/logo.png')}
        style={[styles.logo, getSize()]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    marginBottom: 16,
  },
});

export default Logo; 