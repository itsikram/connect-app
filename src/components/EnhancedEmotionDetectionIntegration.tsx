import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import { useSocket } from '../contexts/SocketContext';
import EmotionDetectionService from './EmotionDetectionService';
import { useEmotionDetection } from '../hooks/useEmotionDetection';

interface EnhancedEmotionDetectionIntegrationProps {
  connectId: string;
  room?: string;
}

/**
 * Enhanced Emotion Detection Integration Component
 * Orchestrates emotion detection with exact web app logic and behavior
 * Handles settings, permissions, state management, and real-time updates
 */
const EnhancedEmotionDetectionIntegration: React.FC<EnhancedEmotionDetectionIntegrationProps> = ({
  connectId,
  room,
}) => {
  const settings = useSelector((state: any) => state.setting);
  const profile = useSelector((state: any) => state.profile);
  const { emit, on } = useSocket();

  const [isEnabled, setIsEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [connectEmotion, setConnectEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const emotionDetectionRef = useRef<any>(null);
  const lastEmotionRequestRef = useRef<number>(0);

  // Check if emotion sharing is enabled in settings (exact same logic as web)
  useEffect(() => {
    setIsEnabled(settings.isShareEmotion === true);
  }, [settings.isShareEmotion]);

  // Request camera permissions with enhanced error handling
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        // Note: In a real app, you'd request camera permissions here
        // For React Native, you'd use react-native-permissions
        // For now, we'll assume permissions are granted
        
        // Check if we're in a video call context (like web version)
        if (room) {
          console.log('🎭 Emotion detection enabled for room:', room);
        }
        
        setHasPermissions(true);
      } catch (error) {
        console.error('Failed to request camera permissions:', error);
        setHasPermissions(false);
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access to use emotion detection features.',
          [{ text: 'OK' }]
        );
      }
    };

    if (isEnabled && room) {
      requestPermissions();
    } else if (!isEnabled) {
      setHasPermissions(false);
    }
  }, [isEnabled, room]);

  // Enhanced emotion change listener with same logic as web version
  useEffect(() => {
    const handleEmotionChange = (data: any) => {
      console.log('🎭 Received emotion change:', data);
      
      if (data && data.emotion) {
        // Update connect's emotion if it's from the current connect
        if (data.profileId === connectId) {
          setConnectEmotion(data.emotion);
        }
        
        // Handle emotion data with confidence and quality info
        if (data.confidence && data.quality) {
          console.log('📊 Emotion data:', {
            emotion: data.emotion,
            confidence: data.confidence,
            quality: data.quality,
            emoji: data.emoji
          });
        }
      }
    };

    on('emotion_change', handleEmotionChange);

    return () => {
      // Cleanup is handled by socket context
    };
  }, [on, connectId]);

  // Request last emotion from connect (same as web version)
  useEffect(() => {
    if (connectId && profile._id) {
      const now = Date.now();
      // Throttle emotion requests to avoid spam
      if (now - lastEmotionRequestRef.current > 5000) {
        emit('last_emotion', { connectId, profileId: profile._id });
        lastEmotionRequestRef.current = now;
        console.log('📡 Requesting last emotion from connect:', connectId);
      }
    }
  }, [connectId, profile._id, emit]);

  // Handle emotion detection state changes
  const handleEmotionDetectionChange = useCallback((emotion: string | null) => {
    setCurrentEmotion(emotion);
    if (emotion) {
      console.log('🎯 Current emotion updated:', emotion);
    }
  }, []);

  const handleDetectionStateChange = useCallback((detecting: boolean) => {
    setIsDetecting(detecting);
    console.log('🎭 Detection state changed:', detecting ? 'Started' : 'Stopped');
  }, []);

  // Enhanced error handling
  const handleEmotionError = useCallback((error: any) => {
    console.error('🚨 Emotion detection error:', error);
    
    // Show user-friendly error message
    Alert.alert(
      'Emotion Detection Error',
      'There was an issue with emotion detection. Please try again.',
      [{ text: 'OK' }]
    );
  }, []);

  // Stop emotion detection when leaving room (like web version)
  useEffect(() => {
    const handleStopEmotionCamera = () => {
      console.log('🛑 Stopping emotion camera (global event)');
      setIsEnabled(false);
    };

    // Listen for global stop event (like web version)
    if (Platform.OS === 'web') {
      window.addEventListener('stopEmotionCamera', handleStopEmotionCamera);
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('stopEmotionCamera', handleStopEmotionCamera);
      }
    };
  }, []);

  // Don't render anything if emotion sharing is disabled or no room
  if (!isEnabled || !room) {
    return null;
  }

  if (!hasPermissions) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera permission required for emotion detection
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Enhanced Emotion Detection Service */}
      <EmotionDetectionService
        profileId={profile._id}
        connectId={connectId}
        isEnabled={isEnabled}
        room={room}
        detectionInterval={900} // Same as web version
      />

      {/* Emotion Status Display */}
      {isDetecting && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>🎭 Detecting emotions...</Text>
        </View>
      )}

      {/* Current Emotion Display */}
      {currentEmotion && (
        <View style={styles.emotionDisplay}>
          <Text style={styles.emotionText}>Your emotion: {currentEmotion}</Text>
        </View>
      )}

      {/* Connect's Emotion Display */}
      {connectEmotion && (
        <View style={styles.emotionDisplay}>
          <Text style={styles.emotionText}>Connect's emotion: {connectEmotion}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none', // Allow touches to pass through
  },
  permissionContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 8,
    pointerEvents: 'auto',
  },
  permissionText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
  },
  statusContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
    pointerEvents: 'none',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
  },
  emotionDisplay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
    pointerEvents: 'none',
  },
  emotionText: {
    color: 'white',
    fontSize: 12,
  },
});

export default EnhancedEmotionDetectionIntegration;

