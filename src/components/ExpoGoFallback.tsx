import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ExpoGoFallbackProps {
  featureName: string;
  onGoBack?: () => void;
}

const ExpoGoFallback: React.FC<ExpoGoFallbackProps> = ({ featureName, onGoBack }) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          {featureName}
        </Text>
        <Text style={[styles.message, { color: themeColors.text.secondary }]}>
          This feature requires native modules that are not available in Expo Go.
        </Text>
        <Text style={[styles.subMessage, { color: themeColors.text.secondary }]}>
          Please create a development build to access this functionality.
        </Text>
        
        {onGoBack && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: themeColors.primary }]}
            onPress={onGoBack}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  subMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    opacity: 0.8,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpoGoFallback;
