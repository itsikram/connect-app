import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { Camera, useCameraDevice, useCameraPermission, VisionCameraProxy, useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import useFaceMeshTfjs from '../hooks/useFaceMeshTfjs';
import { createEmotionDetector } from '../lib/mediapipeExpressions';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSocket } from '../contexts/SocketContext';
import { useSettings } from '../contexts/SettingsContext';
import { selectProfileId, selectMyFriends } from '../selectors/profileSelectors';

const SNAPSHOT_INTERVAL_MS = 1200;
const PLUGIN_FRAME_RATE = 12;

/**
 * GlobalExpressionDetection
 * Invisible background detector using MediaPipe-style FaceMesh landmarks
 * Emits `emotion_change` via socket to all friends (broadcast) when label changes.
 */
const GlobalExpressionDetection: React.FC = () => {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const faceMeshPlugin: any = (VisionCameraProxy as any)?.getFrameProcessorPlugin?.('faceMesh');
  const isPluginAvailable = Boolean(faceMeshPlugin);
  const { settings } = useSettings();
  const isEnabled = Boolean(settings?.isShareEmotion);

  const { isReady, lastError, estimateFromImagePath } = useFaceMeshTfjs({ backend: 'cpu', maxFaces: 1, refineLandmarks: false, targetMaxSide: 88 });
  const detectorRef = useRef(createEmotionDetector());
  const lastEmitRef = useRef<number>(0);
  const lastLabelRef = useRef<string>('');
  const snapshotInFlightRef = useRef<boolean>(false);

  const profileId = useSelector(selectProfileId);
  const myFriends = useSelector(selectMyFriends);
  const friendsRef = useRef<string[]>([]);
  useEffect(() => { friendsRef.current = myFriends; }, [myFriends]);
  const { emit } = useSocket();

  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightStartedAtRef = useRef<number>(0);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      setIsAppActive(state === 'active');
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const requestSeqRef = useRef<number>(0);
  const lastSkipLogRef = useRef<number>(0);
  const skipCountRef = useRef<number>(0);
  const USE_NATIVE_GATE = false; // enable for ML Kit pre-check; disable for speed

  useEffect(() => {
    try {
      console.log('[GlobalExpressionDetection] TFJS status', { isReady, lastError });
    } catch {}
  }, [isReady, lastError]);

  useEffect(() => {
    if (!isEnabled) {
      try { console.log('[GlobalExpressionDetection] Disabled via settings'); } catch {}
      return;
    }
    if (!hasPermission) {
      try { console.log('[GlobalExpressionDetection] Camera permission missing, requesting...'); } catch {}
      if (Platform.OS === 'android') {
        requestPermission();
      } else {
        requestPermission();
      }
    } else {
      try { console.log('[GlobalExpressionDetection] Camera permission granted'); } catch {}
    }
  }, [isEnabled, hasPermission, requestPermission]);

  useEffect(() => {
    const nextActive = Boolean(device && hasPermission && isEnabled && isAppActive);
    setActive(nextActive);
    try {
      console.log('[GlobalExpressionDetection] State', {
        deviceAvailable: Boolean(device),
        hasPermission,
        isEnabled,
        pluginAvailable: isPluginAvailable,
        appActive: isAppActive,
        active: nextActive,
      });
    } catch {}
  }, [device, hasPermission, isEnabled, isPluginAvailable, isAppActive]);

  const maybeEmit = useCallback((label: string, clarity: number, emoji?: string, source?: 'plugin' | 'snapshot') => {
    const now = Date.now();
    if (!profileId) return;
    // Throttle to ~1s cadence even if plugin produces more frequent results
    const elapsed = now - lastEmitRef.current;
    if (label === lastLabelRef.current && elapsed < 1000) {
      return;
    }
    lastLabelRef.current = label;
    lastEmitRef.current = now;
    const payloadBase = {
      profileId,
      emotion: `${emoji ?? ''} ${label}`.trim(),
      emotionText: label,
      emoji: emoji ?? '',
      confidence: 0.8,
      quality: clarity,
    } as any;
    const friendIds = Array.isArray(friendsRef.current) ? friendsRef.current : [];
    const payload = friendIds.length > 0
      ? { ...payloadBase, friendIds }
      : { ...payloadBase, broadcast: true };
    try {
      console.log('[GlobalExpressionDetection] Detected', {
        profileId,
        label,
        clarity,
        source: source || (isPluginAvailable ? 'plugin' : 'snapshot'),
        ts: new Date().toISOString(),
        targets: friendIds.length > 0 ? `friendIds(${friendIds.length})` : 'broadcast',
      });
    } catch {}
    emit('emotion_change', payload);
  }, [emit, profileId, isPluginAvailable]);

  const handleFromPlugin = useCallback((landmarks: Array<{x:number;y:number;z:number}>, w: number, h: number) => {
    try {
      const out = detectorRef.current.process(landmarks as any, w, h);
      const label: string = out.analysis.customExpression;
      const clarity: number = out.clarityScore ?? 0;
      maybeEmit(label, clarity, undefined, 'plugin');
    } catch {}
  }, [maybeEmit]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // @ts-ignore
    const plugin = (VisionCameraProxy as any)?.getFrameProcessorPlugin?.('faceMesh');
    if (!plugin) return;
    // @ts-ignore
    const res = plugin(frame);
    if (res && res.landmarks && res.landmarks.length) {
      // Landmarks must be normalized 0..1 from plugin
      // @ts-ignore
      runOnJS(handleFromPlugin)(res.landmarks, frame.width, frame.height);
    }
  }, [handleFromPlugin]);

  const runOnceSnapshot = useCallback(async () => {
    if (!isReady || !cameraRef.current || snapshotInFlightRef.current) {
      const now = Date.now();
      // Throttle skip logs to avoid spam
      if (now - lastSkipLogRef.current > 2000) {
        try {
          const inflightMs = snapshotInFlightRef.current && inflightStartedAtRef.current
            ? now - inflightStartedAtRef.current
            : 0;
          console.log('[GlobalExpressionDetection] Skip tick', {
            isReady,
            hasCameraRef: Boolean(cameraRef.current),
            snapshotInFlight: snapshotInFlightRef.current,
            inflightMs,
          });
        } catch {}
        lastSkipLogRef.current = now;
        skipCountRef.current = 0;
      } else {
        skipCountRef.current += 1;
      }
      return;
    }
    const t0 = Date.now();
    snapshotInFlightRef.current = true;
    inflightStartedAtRef.current = t0;
    const reqId = ++requestSeqRef.current;
    try {
      try { console.log('[GlobalExpressionDetection] Snapshot tick'); } catch {}
      const snapTimeoutMs = 5000;
      const snapTimed = new Promise<'__snap_timeout__'>(resolve => setTimeout(() => resolve('__snap_timeout__'), snapTimeoutMs));
      const snapRes = await Promise.race([cameraRef.current.takeSnapshot({ quality: 3 }), snapTimed]);
      if (reqId !== requestSeqRef.current) { try { console.log('[GlobalExpressionDetection] Stale snapshot result ignored'); } catch {} return; }
      if (snapRes === '__snap_timeout__') { try { console.log('[GlobalExpressionDetection] Snapshot timeout exceeded', { snapTimeoutMs }); } catch {} return; }
      const photo = snapRes as any;
      const uri = `file://${photo.path}`;
      // Optional native face gating
      try {
        const snapW = (photo as any).width ?? 0;
        const snapH = (photo as any).height ?? 0;
        try { console.log('[GlobalExpressionDetection] Snapshot size', { snapW, snapH }); } catch {}
        if (USE_NATIVE_GATE) {
          if (snapW >= 32 && snapH >= 32) {
            const faces = await FaceDetection.detect(uri, {
              performanceMode: 'fast',
              landmarkMode: 'all',
              contourMode: 'all',
            });
            if (!faces || faces.length === 0) {
              try { console.log('[GlobalExpressionDetection] No face detected (native)'); } catch {}
              return;
            }
          } else {
            try { console.log('[GlobalExpressionDetection] Skipping native gating: snapshot too small for MLKit'); } catch {}
          }
        }
      } catch (e) {
        if (USE_NATIVE_GATE) { try { console.log('[GlobalExpressionDetection] Native face detection error', e); } catch {} }
      }
      // Watchdog timeout for slow estimations
      const timeoutMs = 8000;
      const timed = new Promise<'__timeout__'>(resolve => setTimeout(() => resolve('__timeout__'), timeoutMs));
      const res = await Promise.race([estimateFromImagePath(uri) as Promise<any>, timed]);
      if (reqId !== requestSeqRef.current) {
        try { console.log('[GlobalExpressionDetection] Stale estimation result ignored'); } catch {}
        return;
      }
      if (res === '__timeout__') {
        try { console.log('[GlobalExpressionDetection] Estimation timeout exceeded', { timeoutMs }); } catch {}
        return;
      }
      const preds = res as any;
      if (preds === null) {
        try { console.log('[GlobalExpressionDetection] estimateFromImagePath returned null (error during estimation)'); } catch {}
      } else if (preds && preds.length) {
        const first = preds[0];
        const w = (photo as any).width ?? 640;
        const h = (photo as any).height ?? 480;
        const landmarks = (first.points || []).map(([x, y, z]: any) => ({ x: x / w, y: y / h, z: z || 0 }));
        const out = detectorRef.current.process(landmarks as any, w, h);
        const label: string = out.analysis.customExpression;
        const clarity: number = out.clarityScore ?? 0;
        try { console.log('[GlobalExpressionDetection] Landmarks', { count: (first.points || []).length, w, h }); } catch {}
        maybeEmit(label, clarity, undefined, 'snapshot');
      } else {
        try { console.log('[GlobalExpressionDetection] No face detected in snapshot'); } catch {}
      }
    } catch {}
    finally {
      try { console.log('[GlobalExpressionDetection] Snapshot duration(ms)', Date.now() - t0); } catch {}
      snapshotInFlightRef.current = false;
    }
  }, [isReady, estimateFromImagePath, maybeEmit]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (timeoutRef.current) { try { console.log('[GlobalExpressionDetection] Stopping snapshot loop'); } catch {} clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      return;
    }
    if (!isPluginAvailable && !timeoutRef.current) {
      try { console.log('[GlobalExpressionDetection] Starting snapshot loop @', SNAPSHOT_INTERVAL_MS, 'ms'); } catch {}
      const loop = async () => {
        if (!activeRef.current) return;
        await runOnceSnapshot();
        if (!activeRef.current) return;
        timeoutRef.current = setTimeout(loop, SNAPSHOT_INTERVAL_MS);
      };
      loop();
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (timeoutRef.current) { try { console.log('[GlobalExpressionDetection] Stopping snapshot loop'); } catch {} clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
  }, [active, isPluginAvailable, runOnceSnapshot]);

  if (!isEnabled || !active || !device) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={active}
        photo={!isPluginAvailable}
        frameProcessor={isPluginAvailable ? frameProcessor : undefined}
        // @ts-ignore - available at runtime in VisionCamera
        frameProcessorFps={isPluginAvailable ? PLUGIN_FRAME_RATE : undefined}
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
    bottom: 0,
    right: 0,
  },
  camera: {
      // Smaller preview to speed up snapshots and decoding
      width: 192,
      height: 192,
  },
});

export default GlobalExpressionDetection;


