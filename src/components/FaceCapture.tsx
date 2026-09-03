import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from 'react-native-paper';

type FaceDetectorModule = typeof import('expo-face-detector');
let faceDetector: FaceDetectorModule | null = null;
try {
  // Expo Go does not include this native module; development builds do.
  faceDetector = require('expo-face-detector') as FaceDetectorModule;
} catch {
  faceDetector = null;
}

const FRAME_COUNT = 60;
const FRAME_INTERVAL_MS = 100;
const MIN_FRAMES_TO_SEND = 20;
const OPEN_CALIBRATION_FRAMES = 8;
const CLOSED_RATIO = 0.72;
const OPEN_RATIO = 0.86;

type FaceCaptureProps = {
  onCapture: (frames: string[]) => Promise<void> | void;
  disabled?: boolean;
};

const FaceCapture = ({ onCapture, disabled = false }: FaceCaptureProps) => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  const startCamera = async () => {
    setStatus('');
    setProgress(0);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setStatus(
          'Camera access is required. Please allow permission and try again.',
        );
      }
    }
  };

  const capture = async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    setProgress(0);
    setStatus(
      faceDetector
        ? 'Look at the camera and blink naturally...'
        : 'Look at the camera and blink naturally. The server will verify liveness...',
    );

    try {
      const frames: string[] = [];
      let openBaseline = 0;
      let closedFrames = 0;
      let blinkDetected = false;
      for (let index = 0; index < FRAME_COUNT; index += 1) {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          skipProcessing: true,
        });
        if (!photo?.base64 || !photo.uri) continue;

        if (faceDetector) {
          const detection = await faceDetector.detectFacesAsync(photo.uri, {
            mode: faceDetector.FaceDetectorMode.accurate,
            detectLandmarks: faceDetector.FaceDetectorLandmarks.all,
            runClassifications: faceDetector.FaceDetectorClassifications.all,
            minDetectionInterval: FRAME_INTERVAL_MS,
          });
          const face = detection.faces.length === 1 ? detection.faces[0] : null;
          const leftOpen = face?.leftEyeOpenProbability;
          const rightOpen = face?.rightEyeOpenProbability;
          if (!face || leftOpen === undefined || rightOpen === undefined) {
            setStatus('Keep exactly one face centered in the live camera.');
            await new Promise(resolve => setTimeout(resolve, FRAME_INTERVAL_MS));
            continue;
          }

          const eyeOpen = (leftOpen + rightOpen) / 2;
          if (index < OPEN_CALIBRATION_FRAMES) {
            openBaseline = Math.max(openBaseline, eyeOpen);
            setStatus(`Hold still, calibrating eyes… ${index + 1}/${OPEN_CALIBRATION_FRAMES}`);
          } else if (openBaseline > 0) {
            if (eyeOpen < openBaseline * CLOSED_RATIO) {
              closedFrames += 1;
              setStatus('Eyes closed detected — open your eyes.');
            } else if (closedFrames >= 1 && eyeOpen >= openBaseline * OPEN_RATIO) {
              blinkDetected = true;
              setStatus('Blink detected. Preparing verification…');
            } else {
              closedFrames = 0;
              setStatus('Blink once naturally while keeping your face centered.');
            }
          }
        } else {
          // Expo Go has no landmark detector; server-side liveness remains required.
          blinkDetected = true;
        }

        frames.push(photo.base64);
        setProgress(Math.min(100, Math.round((frames.length / MIN_FRAMES_TO_SEND) * 100)));
        if (blinkDetected && frames.length >= MIN_FRAMES_TO_SEND) break;
        await new Promise(resolve => setTimeout(resolve, FRAME_INTERVAL_MS));
      }

      if (frames.length < MIN_FRAMES_TO_SEND) {
        setStatus(
          `Could not capture enough camera frames (received ${frames.length}).`,
        );
        return;
      }
      if (faceDetector && !blinkDetected) {
        setStatus('No blink detected. Please blink once while the camera is capturing.');
        return;
      }

      setStatus(`Captured ${frames.length} frames. Verifying...`);
      await onCapture(frames);
    } catch (error) {
      console.error('Face frame capture failed:', error);
      setStatus('Could not capture camera frames. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.help}>
          Center your face, keep good lighting, and blink once naturally during capture.
        </Text>
        <Button mode="outlined" onPress={startCamera} disabled={disabled}>
          Allow camera
        </Button>
        {permission?.canAskAgain === false ? (
          <Text style={styles.error}>
            Camera permission is disabled in device settings.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        mode="picture"
        active={!disabled}
        pictureSize="640x480"
        onCameraReady={() => setCameraReady(true)}
      />
      <Text style={styles.help}>
        {status || 'Center your face and blink once naturally, then capture.'}
      </Text>
      <Text style={styles.securityNote}>
        Use the live front camera. Photos, screen recordings, and video files are not accepted.
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
      <Button
        mode="contained"
        onPress={capture}
        disabled={disabled || capturing || !cameraReady}
      >
        {capturing
          ? `Capturing… ${progress}%`
          : cameraReady
          ? 'Capture'
          : 'Starting camera...'}
      </Button>
      {capturing ? <ActivityIndicator style={styles.spinner} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: 280, gap: 10, marginBottom: 16 },
  camera: {
    width: 280,
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  help: { fontSize: 13, lineHeight: 18 },
  securityNote: { fontSize: 12, lineHeight: 16, color: '#667085' },
  error: { color: '#d32f2f', fontSize: 13 },
  spinner: { marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#D9DEE8', overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563EB' },
});

export default FaceCapture;
