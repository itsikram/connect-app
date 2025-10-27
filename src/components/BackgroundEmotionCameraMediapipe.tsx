import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import useEmotionDetectionMediapipe from '../hooks/useEmotionDetectionMediapipe';

interface BackgroundEmotionCameraMediapipeProps {
  profileId: string;
  friendId: string;
  isEnabled: boolean;
  detectionInterval?: number;
}

const BackgroundEmotionCameraMediapipe: React.FC<BackgroundEmotionCameraMediapipeProps> = ({
  profileId,
  friendId,
  isEnabled,
  detectionInterval = 1000,
}) => {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef(false);

  const { currentEmotion, processImagePath } = useEmotionDetectionMediapipe({
    profileId,
    friendId,
    isEnabled,
    detectionInterval,
    sessionId: 'rn-mediapipe'
  });

  useEffect(() => {
    if (!isEnabled) {
      setIsCameraActive(false);
      return;
    }
    const setup = async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (granted) setIsCameraActive(true);
      } else {
        setIsCameraActive(true);
      }
    };
    setup();
  }, [isEnabled, hasPermission, requestPermission]);

  const captureAndProcess = useCallback(async () => {
    if (isCapturingRef.current || !cameraRef.current || !isCameraActive) return;
    isCapturingRef.current = true;
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
      const imagePath = `file://${photo.path}`;
      await processImagePath(imagePath);
    } catch (e) {
      console.warn('capture error', e);
    } finally {
      isCapturingRef.current = false;
    }
  }, [isCameraActive, processImagePath]);

  useEffect(() => {
    if (!isCameraActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        captureAndProcess();
      }, detectionInterval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCameraActive, detectionInterval, captureAndProcess]);

  if (!isEnabled || !hasPermission || !device) return null;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isCameraActive}
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

export default BackgroundEmotionCameraMediapipe;


