/**
 * EmotionDetectionCamera - Placeholder component for Expo compatibility
 * 
 * This component requires react-native-vision-camera which is not compatible with Expo.
 * Use EmotionDetectionService.tsx instead for Expo compatibility.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EmotionDetectionCameraProps {
  profileId: string;
  friendId: string;
  isEnabled: boolean;
  detectionInterval?: number;
}

const EmotionDetectionCamera: React.FC<EmotionDetectionCameraProps> = ({
  profileId,
  friendId,
  isEnabled,
  detectionInterval = 1000,
}) => {
  // This component is disabled for Expo compatibility
  // To enable, install react-native-vision-camera and use the original implementation
  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Emotion Detection Camera
        </Text>
        <Text style={styles.placeholderSubtext}>
          Requires react-native-vision-camera
        </Text>
        <Text style={styles.placeholderSubtext}>
          Use EmotionDetectionService instead
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default EmotionDetectionCamera;
