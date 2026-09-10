import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { Button } from 'react-native-paper';

const DEFAULT_FRAME_COUNT = 20;
const MIN_FRAMES_TO_SEND = 15;
const DEFAULT_CAPTURE_INTERVAL_MS = 100;
const CAPTURE_PROMPT_BN = 'আপনার মুখ ফ্রেমের মাঝখানে রাখুন এবং চোখ পিটপিট করুন।';

type FaceCaptureProps = {
  onCapture: (frames: string[]) => Promise<void> | void;
  disabled?: boolean;
  frameCount?: number;
  captureIntervalMs?: number;
};

const FaceCapture = ({
  onCapture,
  disabled = false,
  frameCount = DEFAULT_FRAME_COUNT,
  captureIntervalMs = DEFAULT_CAPTURE_INTERVAL_MS,
}: FaceCaptureProps) => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => () => {
    Speech.stop();
  }, []);

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
    setStatus(CAPTURE_PROMPT_BN);
    Speech.stop();
    Speech.speak(CAPTURE_PROMPT_BN, {
      language: 'bn-BD',
      rate: 0.9,
    });

    try {
      const frames: string[] = [];
      for (let index = 0; index < frameCount; index += 1) {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          skipProcessing: true,
          shutterSound: false,
        });
        if (!photo?.base64 || !photo.uri) continue;

        frames.push(photo.base64);
        setProgress(Math.min(100, Math.round((frames.length / MIN_FRAMES_TO_SEND) * 100)));
        if (frames.length < MIN_FRAMES_TO_SEND) {
          await new Promise(resolve => setTimeout(resolve, captureIntervalMs));
        }
      }

      if (frames.length < MIN_FRAMES_TO_SEND) {
        setStatus(
          `Could not capture enough camera frames (received ${frames.length}).`,
        );
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
        flash="on"
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
