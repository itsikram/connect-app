import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface LoadingScreenProps {
  message?: string;
  size?: 'small' | 'large';
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  size = 'large' 
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.light,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default LoadingScreen;
