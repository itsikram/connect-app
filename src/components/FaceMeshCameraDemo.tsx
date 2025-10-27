import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PermissionsAndroid, Platform, Text } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor, VisionCameraProxy } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import useFaceMeshTfjs, { FaceMeshPrediction } from '../hooks/useFaceMeshTfjs';
import { createEmotionDetector } from '../lib/mediapipeExpressions';

interface FaceMeshCameraDemoProps {
  detectionIntervalMs?: number; // set <= 0 for continuous updates
  onPredictions?: (preds: FaceMeshPrediction[]) => void;
}

const FaceMeshCameraDemo: React.FC<FaceMeshCameraDemoProps> = ({ detectionIntervalMs = 100, onPredictions }) => {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);

  const { isReady, lastError, estimateFromImagePath } = useFaceMeshTfjs({ backend: 'cpu', maxFaces: 1, refineLandmarks: true, targetMaxSide: 192 });
  const detectorRef = useRef(createEmotionDetector());
  const [label, setLabel] = useState<string>('');
  const [status, setStatus] = useState<string>('Idle');
  const [clarityScore, setClarityScore] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [numLandmarks, setNumLandmarks] = useState<number>(0);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [overlayPoints, setOverlayPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null);
  const [viewSize, setViewSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const tickingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRafTsRef = useRef<number | null>(null);
  const fpsSmoothedRef = useRef<number>(0);
  const framesSinceLastFpsSetRef = useRef<number>(0);
  const [fps, setFps] = useState<number | null>(null);
  const faceMeshPlugin: any = (VisionCameraProxy as any)?.getFrameProcessorPlugin?.('faceMesh');
  const isPluginAvailable = Boolean(faceMeshPlugin);

  useEffect(() => {
    const ensurePermissions = async () => {
      if (!hasPermission) {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        }
        await requestPermission();
      }
    };
    ensurePermissions();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    setIsActive(Boolean(device && hasPermission));
  }, [device, hasPermission]);

  const scalePoint = useCallback((px: number, py: number) => {
    if (!photoSize || !viewSize.width || !viewSize.height) return { x: 0, y: 0 };
    const scaleX = viewSize.width / photoSize.width;
    const scaleY = viewSize.height / photoSize.height;
    // Front camera preview is mirrored; flip X for overlay to align with preview
    const x = viewSize.width - px * scaleX;
    const y = py * scaleY;
    return { x, y };
  }, [photoSize, viewSize]);

  const runDetectionOnce = useCallback(async () => {
    if (tickingRef.current || !isReady || !cameraRef.current) return;
    tickingRef.current = true;
    const t0 = Date.now();
    try {
      setStatus('Capturing');
      // Use snapshot for faster, shutterless capture suitable for continuous processing
      const photo = await cameraRef.current.takeSnapshot({ quality: 10 });
      const fileUri = `file://${photo.path}`;
      setStatus('Estimating');
      const preds = await estimateFromImagePath(fileUri);
      if (preds && preds.length > 0) {
        const first = preds[0];
        const w = (photo as any).width ?? 640;
        const h = (photo as any).height ?? 480;
        setPhotoSize({ width: w, height: h });
        const pts = (first.points || []).map(p => scalePoint(p[0], p[1]));
        setOverlayPoints(pts);
        setNumLandmarks((first.points || []).length);
        // Run same expression logic as web (landmarks normalized 0..1)
        setStatus('Processing');
        const landmarks = (first.points || []).map(([x, y, z]) => ({ x: x / w, y: y / h, z: (z || 0) })) as any;
        const out = detectorRef.current.process(landmarks, w, h);
        setLabel(out.analysis.customExpression);
        setClarityScore(out.clarityScore ?? null);
        setMetrics(out.analysis?.debug || null);
        if (onPredictions) onPredictions(preds);
        setStatus('OK');
      } else {
        setOverlayPoints([]);
        setLabel('');
        setNumLandmarks(0);
        setMetrics(null);
        setClarityScore(null);
        setStatus('No face');
      }
    } catch (e) {
      console.warn('FaceMesh capture/detect error', e);
      setStatus('Error');
    } finally {
      setLastDurationMs(Date.now() - t0);
      tickingRef.current = false;
    }
  }, [isReady, estimateFromImagePath, scalePoint, onPredictions]);

  const handleLandmarksFromFP = useCallback((landmarks: Array<{x:number;y:number;z:number}>, w: number, h: number) => {
    // landmarks expected normalized 0..1 from plugin
    try {
      setStatus('Processing');
      const pts = landmarks.map(p => ({ x: viewSize.width - p.x * viewSize.width, y: p.y * viewSize.height }));
      setOverlayPoints(pts);
      setNumLandmarks(landmarks.length);
      const out = detectorRef.current.process(landmarks as any, w, h);
      setLabel(out.analysis.customExpression);
      setClarityScore(out.clarityScore ?? null);
      setMetrics(out.analysis?.debug || null);
      setStatus('OK');
    } catch (e) {
      console.warn('FaceMesh FP process error', e);
      setStatus('Error');
    }
  }, [detectorRef, viewSize]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // Guard: plugin must exist
    // @ts-ignore - plugin is resolved dynamically by VisionCamera
    if (faceMeshPlugin == null) { return; }
    // @ts-ignore - call native frame processor plugin
    const res = faceMeshPlugin(frame);
    if (res && res.landmarks && res.landmarks.length) {
      runOnJS(handleLandmarksFromFP)(res.landmarks, frame.width, frame.height);
    }
  }, [handleLandmarksFromFP]);

  useEffect(() => {
    // Cleanup helpers
    const stopTimers = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastRafTsRef.current = null;
    };

    if (!isActive) {
      stopTimers();
      return;
    }

    if (!isPluginAvailable && detectionIntervalMs && detectionIntervalMs > 0) {
      // Interval-based mode (legacy)
      timerRef.current = setInterval(() => {
        runDetectionOnce();
      }, detectionIntervalMs);
      return () => stopTimers();
    }

    // Continuous mode using requestAnimationFrame (fallback when plugin not available)
    const loop = (ts: number) => {
      // Compute and smooth FPS
      if (lastRafTsRef.current != null) {
        const dt = Math.max(1, ts - lastRafTsRef.current);
        const instFps = 1000 / dt;
        fpsSmoothedRef.current = fpsSmoothedRef.current === 0 ? instFps : fpsSmoothedRef.current * 0.9 + instFps * 0.1;
        framesSinceLastFpsSetRef.current = (framesSinceLastFpsSetRef.current + 1) % 10;
        if (framesSinceLastFpsSetRef.current === 0) {
          setFps(Number(fpsSmoothedRef.current.toFixed(1)));
        }
      }
      lastRafTsRef.current = ts;

      // Limit to ~8-12 Hz to avoid blocking UI, while giving near real-time updates
      const shouldRun = !tickingRef.current && (!lastDurationMs || lastDurationMs >= 0);
      if (shouldRun) runDetectionOnce();
      rafRef.current = requestAnimationFrame(loop);
    };
    if (!isPluginAvailable) {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => stopTimers();
  }, [isActive, detectionIntervalMs, runDetectionOnce, isPluginAvailable]);

  const overlay = useMemo(() => {
    if (!overlayPoints.length) return null;
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={viewSize.width} height={viewSize.height}>
        {overlayPoints.map((pt, idx) => (
          <Circle key={idx} cx={pt.x} cy={pt.y} r={1.6} fill="#00E0FF" />
        ))}
      </Svg>
    );
  }, [overlayPoints, viewSize]);

  if (!device || !hasPermission) {
    return (
      <View style={styles.fallback}>
        <Text>Camera not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={e => setViewSize(e.nativeEvent.layout)}>
      <Camera ref={cameraRef} style={styles.camera} device={device} isActive={isActive} photo={!isPluginAvailable}
        frameProcessor={isPluginAvailable ? frameProcessor : undefined}
      >
      </Camera>
      {overlay}
      {label ? (<View style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View>) : null}
      {!isReady && (
        <View style={styles.banner}><Text style={styles.bannerText}>Loading FaceMesh...</Text></View>
      )}
      {lastError && (
        <View style={styles.bannerError}><Text style={styles.bannerText}>FaceMesh error: {lastError}</Text></View>
      )}
      <View style={styles.debugPanel} pointerEvents="none">
        <Text style={styles.debugText}>Status: {status}</Text>
        <Text style={styles.debugText}>Ready: {isReady ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Label: {label || '-'}</Text>
        <Text style={styles.debugText}>Clarity: {clarityScore ?? '-'}</Text>
        <Text style={styles.debugText}>Landmarks: {numLandmarks}</Text>
        <Text style={styles.debugText}>Duration: {lastDurationMs != null ? `${lastDurationMs} ms` : '-'}</Text>
        <Text style={styles.debugText}>Mode: {detectionIntervalMs && detectionIntervalMs > 0 ? `${detectionIntervalMs} ms` : 'Continuous'}</Text>
        <Text style={styles.debugText}>FPS: {fps != null ? fps : '-'}</Text>
        {metrics ? (
          <>
            <Text style={styles.debugText}>avgEAR: {metrics.avgEAR}</Text>
            <Text style={styles.debugText}>mouthWidth: {metrics.mouthWidth}</Text>
            <Text style={styles.debugText}>mouthHeight: {metrics.mouthHeight}</Text>
            <Text style={styles.debugText}>mar: {metrics.mar}</Text>
            <Text style={styles.debugText}>mouthOpenArea: {metrics.mouthOpenArea}</Text>
            <Text style={styles.debugText}>innerBrowDistance: {metrics.innerBrowDistance}</Text>
            <Text style={styles.debugText}>browRatio: {metrics.browRatio}</Text>
            <Text style={styles.debugText}>mouthCurve: {metrics.mouthCurve}</Text>
            <Text style={styles.debugText}>teethVisible: {String(metrics.teethVisible)}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 380,
    backgroundColor: '#000'
  },
  camera: {
    width: '100%',
    height: '100%'
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200
  },
  banner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  bannerError: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(180,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  bannerText: {
    color: '#fff'
  },
  badge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600'
  },
  debugPanel: {
    position: 'absolute',
    top: 44,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugText: {
    color: '#8EF6FF',
    fontSize: 11,
    marginBottom: 2,
    // Use monospace if available (Android)
    fontFamily: Platform.OS === 'android' ? 'monospace' : undefined,
  }
});

export default FaceMeshCameraDemo;


