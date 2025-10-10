/**
 * EmotionDetectionCamera - Advanced camera component for automated emotion detection
 * 
 * IMPORTANT: This component requires additional dependencies:
 * - npm install react-native-vision-camera
 * - npm install react-native-worklets-core
 * - npm install react-native-fs
 * 
 * If you don't want to install these dependencies, use EmotionDetectionService.tsx instead.
 * 
 * This file is provided as a reference implementation for production use.
 * Comment out or delete this file if not using vision-camera.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { checkCameraPermission } from '../lib/permissions';


import { useEmotionDetection } from '../hooks/useEmotionDetection';

interface EmotionDetectionCameraProps {
  profileId: string;
  friendId: string;
  isEnabled: boolean;
  detectionInterval?: number;
}

/**
 * Hidden camera component for emotion detection
 * Captures frames periodically and processes them for emotion detection
 * Similar to the hidden video element in the web version
 */
/**
 * IMPORTANT: This component is a reference implementation only.
 * 
 * To use this component:
 * 1. Install required packages:
 *    npm install react-native-vision-camera react-native-worklets-core react-native-fs
 * 2. Uncomment the imports at the top of this file
 * 3. Uncomment the implementation below
 * 4. Update the component to return the camera view instead of null
 * 
 * For now, this returns null to avoid build errors.
 * Use EmotionDetectionService.tsx for a simpler implementation without camera dependencies.
 */
const EmotionDetectionCamera: React.FC<EmotionDetectionCameraProps> = ({
  profileId,
  friendId,
  isEnabled,
  detectionInterval = 1000,
}) => {
  // Hook initialization
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

  // Log when component is rendered
  useEffect(() => {
    if (isEnabled) {
      console.log('🎭 EmotionDetectionCamera: Starting vision-camera based detection');
    }
  }, [isEnabled]);

  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'front');
  const cameraRef = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const lastProcessTimeRef = useRef<number>(0);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        console.log('🎭 Requesting camera permission for emotion detection...');
        
        // First try vision-camera's permission request
        let visionCameraPermission = false;
        try {
          const status = await Camera.requestCameraPermission();
          console.log('🎭 Vision-camera permission status:', status);
          visionCameraPermission = status === 'granted';
        } catch (error) {
          console.log('🎭 Vision-camera permission request failed, trying fallback:', error);
        }
        
        // If vision-camera permission fails, check our existing permission system
        if (!visionCameraPermission) {
          console.log('🎭 Checking existing camera permission system...');
          const existingPermission = await checkCameraPermission();
          console.log('🎭 Existing camera permission status:', existingPermission);
          visionCameraPermission = existingPermission;
        }
        
        setHasPermission(visionCameraPermission);
        
        if (visionCameraPermission) {
          console.log('✅ Camera permission granted for emotion detection');
        } else {
          console.log('⚠️ Camera permission not granted for emotion detection');
          // Retry after a delay in case permissions are still being processed
          setTimeout(() => {
            console.log('🎭 Retrying camera permission check...');
            checkCameraPermission().then(permission => {
              console.log('🎭 Retry permission result:', permission);
              setHasPermission(permission);
            });
          }, 2000);
        }
      } catch (error) {
        console.error('Error requesting camera permission:', error);
        setHasPermission(false);
      }
    };

    if (isEnabled) {
      requestPermission();
    }
  }, [isEnabled]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    const now = Date.now();
    if (now - lastProcessTimeRef.current < detectionInterval) {
      return;
    }
    
    try {
      runOnJS(updateLastProcessTime)(now);
      runOnJS(processFrame)(frame);
    } catch (error) {
      console.error('Error in frame processor:', error);
    }
  }, [detectionInterval]);

  const updateLastProcessTime = (time: number) => {
    lastProcessTimeRef.current = time;
  };

  const processFrame = async (frame: any) => {
    try {
      console.log('Processing frame for emotion detection...');
      
      // For now, skip actual frame processing until we have proper image capture
      // The vision-camera frame processing is complex and requires additional setup
      // This is a placeholder for future implementation
      console.log('🎭 Frame received, emotion detection placeholder');
      
      // TODO: Implement proper frame-to-image conversion for face detection
      // For now, we'll use a simpler approach or skip processing
      
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  };

  if (!isEnabled || !hasPermission || !device) {
    console.log('🎭 EmotionDetectionCamera not rendering:', {
      isEnabled,
      hasPermission,
      hasDevice: !!device
    });
    return null;
  }

  console.log('🎭 EmotionDetectionCamera rendering with camera active');

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isEnabled && isDetecting}
        frameProcessor={frameProcessor}
      />
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
  camera: {
    width: 320,
    height: 240,
  },
});

export default EmotionDetectionCamera;

