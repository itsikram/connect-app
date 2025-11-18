import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import FaceDetection, { type Face } from '@react-native-ml-kit/face-detection';

export default function FaceLandmarksScreen() {
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    console.debug('[FaceLandmarksScreen] Device update', {
      hasDevice: !!device,
      deviceId: device?.id ?? null,
      position: device?.position ?? null,
    });
  }, [device]);

  const runDetection = useCallback(async () => {
    if (!cameraRef.current || !device || isProcessing) {
      return;
    }
    setIsProcessing(true);
    try {
      console.debug('[FaceLandmarksScreen] Snapshot start');
      const photo: any = await cameraRef.current.takeSnapshot({ quality: 8 });
      const uri = `file://${photo.path}`;
      console.debug('[FaceLandmarksScreen] Detect start', { uri, width: photo.width, height: photo.height });

      const faces: Face[] = await FaceDetection.detect(uri, {
        performanceMode: 'fast',
        landmarkMode: 'all',
        contourMode: 'all',
        classificationMode: 'all',
      });

      console.debug('[FaceLandmarksScreen] Detect result', {
        count: faces.length,
        firstFace: faces[0] ?? null,
      });
    } catch (e) {
      console.warn('[FaceLandmarksScreen] Detect error', e);
    } finally {
      setIsProcessing(false);
    }
  }, [device, isProcessing]);

  useEffect(() => {
    if (!device) return;

    console.debug('[FaceLandmarksScreen] Starting detection loop');
    const id = setInterval(() => {
      runDetection();
    }, 1500);

    return () => {
      console.debug('[FaceLandmarksScreen] Stopping detection loop');
      clearInterval(id);
    };
  }, [device, runDetection]);

  if (!device) return null;

  return (
    <Camera
      ref={cameraRef}
      style={{ flex: 1 }}
      device={device}
      isActive={true}
      photo={true}
    />
  );
}
