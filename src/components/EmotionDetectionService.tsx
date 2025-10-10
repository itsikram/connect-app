import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useEmotionDetection } from '../hooks/useEmotionDetection';
import { launchCamera, CameraOptions, ImagePickerResponse } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { useSocket } from '../contexts/SocketContext';

interface EmotionDetectionServiceProps {
  profileId: string;
  friendId: string;
  isEnabled: boolean;
  detectionInterval?: number;
  room?: string; // Room identifier for context
}

/**
 * Enhanced Emotion Detection Service
 * Uses periodic camera snapshots for emotion detection with exact web app logic
 * Optimized for performance with intelligent frame skipping and adaptive detection
 */
const EmotionDetectionService: React.FC<EmotionDetectionServiceProps> = ({
  profileId,
  friendId,
  isEnabled,
  detectionInterval = 900, // Faster interval like web version
  room,
}) => {
  const {
    currentEmotion,
    isDetecting,
    processFaceDetection,
  } = useEmotionDetection({
    profileId,
    friendId,
    isEnabled,
    detectionInterval,
  });

  const { emit } = useSocket();
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef(false);
  const frameSkipCounterRef = useRef(0);
  const lastActivityTimeRef = useRef(Date.now());
  const adaptiveIntervalRef = useRef(detectionInterval);

  /**
   * Capture a photo for emotion detection with enhanced error handling
   */
  const captureForDetection = useCallback(async () => {
    if (isCapturingRef.current || !isEnabled) return;
    
    try {
      isCapturingRef.current = true;
      
      // Adaptive frame skipping for performance (same logic as web)
      const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;
      
      if (timeSinceLastActivity > 10000) { // No change for 10 seconds
        frameSkipCounterRef.current++;
        if (frameSkipCounterRef.current % 2 !== 0) {
          isCapturingRef.current = false;
          return; // Skip every other frame
        }
      } else if (timeSinceLastActivity > 5000) { // No change for 5 seconds
        frameSkipCounterRef.current++;
        if (frameSkipCounterRef.current % 3 === 0) {
          isCapturingRef.current = false;
          return; // Skip every third frame
        }
      } else {
        frameSkipCounterRef.current = 0; // Reset when active
      }
      
      const options: CameraOptions = {
        mediaType: 'photo',
        cameraType: 'front',
        saveToPhotos: false,
        quality: 0.4, // Balanced quality for accuracy/performance
        includeBase64: false,
        maxWidth: 640,
        maxHeight: 480,
      };

      // Capture photo for emotion detection
      console.log('🎭 Launching camera for emotion detection...');
      launchCamera(options, async (response: ImagePickerResponse) => {
        try {
          console.log('🎭 Camera response received:', response);
          
          if (response.assets && response.assets[0]) {
            const imagePath = response.assets[0].uri;
            console.log('🎭 Image captured at:', imagePath);
            
            if (imagePath) {
              // Process the captured image for emotion detection
              await processFaceDetection(imagePath);
              
              // Update activity time for adaptive frame skipping
              lastActivityTimeRef.current = Date.now();
              
              console.log('🎭 Emotion detection frame processed successfully');
            }
          } else if (response.didCancel) {
            console.log('🎭 Camera capture cancelled by user');
          } else if (response.errorMessage) {
            console.log('🎭 Camera capture error:', response.errorMessage);
          }
        } catch (error) {
          console.error('Error processing captured image:', error);
        } finally {
          isCapturingRef.current = false;
        }
      });
      
    } catch (error) {
      console.error('Error capturing for emotion detection:', error);
      isCapturingRef.current = false;
    }
  }, [isEnabled, processFaceDetection]);

  /**
   * Start periodic capture for emotion detection with adaptive intervals
   */
  useEffect(() => {
    if (isEnabled && !intervalRef.current) {
      console.log('🎭 Starting enhanced emotion detection service...');
      console.log('🎭 Detection interval:', adaptiveIntervalRef.current, 'ms');
      console.log('🎭 Profile ID:', profileId, 'Friend ID:', friendId);
      
      // Start periodic capture with adaptive interval
      intervalRef.current = setInterval(() => {
        console.log('🎭 Triggering emotion detection capture...');
        captureForDetection();
      }, adaptiveIntervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        console.log('🎭 Stopping enhanced emotion detection service...');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, captureForDetection]);

  /**
   * Listen for emotion changes and emit to server
   */
  useEffect(() => {
    if (currentEmotion && room) {
      // Additional server emission if needed (main emission is handled in hook)
      console.log('🎭 Current emotion:', currentEmotion);
    }
  }, [currentEmotion, room]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // This component doesn't render anything visible
  return null;
};

export default EmotionDetectionService;

