import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useEmotionDetection } from '../hooks/useEmotionDetection';

interface BackgroundEmotionCameraProps {
  profileId: string;
  friendId: string;
  isEnabled: boolean;
  detectionInterval?: number;
}

/**
 * Background Emotion Detection Camera
 * Runs continuously in the background like video call camera
 * Uses a small, hidden view that doesn't interfere with the UI
 */
const BackgroundEmotionCamera: React.FC<BackgroundEmotionCameraProps> = ({
  profileId,
  friendId,
  isEnabled,
  detectionInterval = 1000,
}) => {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  // Log camera device information
  useEffect(() => {
    if (device) {
      console.log('📷 Front camera device configured:', {
        id: device.id,
        name: device.name,
        position: device.position,
        hasFlash: device.hasFlash,
        hasTorch: device.hasTorch,
        minFocusDistance: device.minFocusDistance
      });
    } else {
      console.log('⚠️ Front camera device not available');
    }
  }, [device]);
  const cameraRef = useRef<Camera>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef(false);

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

  // Log detected emotion changes with detailed landmark information
  useEffect(() => {
    if (currentEmotion) {
      console.log('😊 DETECTED EMOTION:', currentEmotion);
      console.log('🎭 Face Landmark Emotion Analysis:', {
        emotion: currentEmotion,
        timestamp: new Date().toISOString(),
        profileId,
        friendId,
        detectionMethod: 'ML Kit Face Landmarks',
        features: [
          'Eye landmarks',
          'Mouth landmarks', 
          'Nose landmarks',
          'Eyebrow landmarks',
          'Face contour'
        ]
      });
      console.log('📍 Landmark-based expression detected using web-style analysis');
    }
  }, [currentEmotion, profileId, friendId]);

  // Request camera permission and manage camera active state
  useEffect(() => {
    const setupCamera = async () => {
      if (!isEnabled) {
        setIsCameraActive(false);
        return;
      }

      console.log('🎭 BackgroundEmotionCamera: Setting up FRONT camera for face detection...');
      
      if (!hasPermission) {
        console.log('🎭 Requesting front camera permission for face detection...');
        const granted = await requestPermission();
        console.log('🎭 Front camera permission granted:', granted);
        
        if (granted) {
          setIsCameraActive(true);
          console.log('🎭 Front camera activated for emotion detection');
        }
      } else {
        console.log('🎭 Front camera permission already granted');
        setIsCameraActive(true);
        console.log('🎭 Front camera activated for emotion detection');
      }
    };

    setupCamera();
  }, [isEnabled, hasPermission, requestPermission]);

  // Capture and process frame for emotion detection
  const captureAndProcessFrame = useCallback(async () => {
    // Prevent multiple simultaneous captures
    if (isCapturingRef.current) {
      return; // Silently skip if already in progress
    }

    try {
      isCapturingRef.current = true;
      
      // Take a photo from the front camera for face detection
      if (cameraRef.current && isCameraActive) {
        console.log('📸 Capturing frame from front camera for emotion detection...');
        const photo = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        
        const imagePath = `file://${photo.path}`;
        console.log('🔍 Processing face landmarks detection on:', imagePath);
        
        // Process the captured image for face detection with landmarks
        await processFaceDetection(imagePath);
        console.log('✅ Face landmarks analysis completed');
      }
    } catch (error) {
      console.error('❌ Error during emotion detection:', error);
    } finally {
      isCapturingRef.current = false;
    }
  }, [processFaceDetection, isCameraActive]);

  // Set up interval-based capture - camera stays always active
  useEffect(() => {
    if (!isCameraActive) {
      // Clean up if camera not active
      if (intervalRef.current) {
        console.log('🎭 Stopping emotion detection (camera not active)');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Only start if not already running - camera stays active regardless of isDetecting
    if (!intervalRef.current) {
      console.log('🎭 Starting continuous emotion detection - capturing every', detectionInterval, 'ms');
      console.log('🎭 Camera will stay always active for face landmark detection');
      
      intervalRef.current = setInterval(() => {
        captureAndProcessFrame();
      }, detectionInterval);
    }

    return () => {
      if (intervalRef.current) {
        console.log('🎭 Cleaning up emotion detection interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCameraActive, detectionInterval]);

  // Don't render if not enabled or no permission or no device
  if (!isEnabled || !hasPermission || !device) {
    console.log('🎭 BackgroundEmotionCamera not rendering:', {
      isEnabled,
      hasPermission,
      hasDevice: !!device
    });
    return null;
  }

  console.log('🎭 BackgroundEmotionCamera rendering camera view');

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isCameraActive} // Camera always on when active
        photo={true}
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
    bottom: 0,
    right: 0,
  },
  camera: {
    width: 1,
    height: 1,
  },
});

export default BackgroundEmotionCamera;

