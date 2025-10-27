import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  StatusBar,
  Platform,
  Alert,
  Dimensions,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { detectEmotionsFromFace, emotionEmojiMap, type EmotionDetectionState } from '../lib/emotionDetection';
import { savePhotoToMedia, saveVideoToMedia } from '../lib/mediaLibrary';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

Reanimated.addWhitelistedNativeProps({ zoom: true });
const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);

type CameraMode = 'photo' | 'video' | 'portrait' | 'pano' | 'square';
type FlashMode = 'off' | 'on' | 'auto';
type TimerOption = 0 | 3 | 10;

const CameraScreen = () => {
  const navigation = useNavigation();
  const camera = useRef<Camera>(null);
  const isFocused = useIsFocused();

  // Camera permissions
  const { hasPermission, requestPermission } = useCameraPermission();

  // Camera states
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('front');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('photo');
  const [timer, setTimer] = useState<TimerOption>(0);
  const [hdr, setHdr] = useState(false);
  const [livePhoto, setLivePhoto] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  // Live filter
  const [activeFilter, setActiveFilter] = useState<'none' | 'vivid'>('none');
  const [lastMediaPath, setLastMediaPath] = useState<string | null>(null);
  const [beautyEnabled, setBeautyEnabled] = useState(true);
  const [beautyIntensity] = useState(0.12); // subtle default

  // Emotion detection states
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [emotionEmoji, setEmotionEmoji] = useState<string>('😐');
  const [emotionConfidence, setEmotionConfidence] = useState<number>(0);
  const [isEmotionDetectionEnabled, setIsEmotionDetectionEnabled] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);

  // Emotion detection refs (matching web version)
  const emotionHistoryRef = useRef<any[]>([]);
  const baselineExpressionsRef = useRef<any>({});
  const lastStableEmotionRef = useRef<string | null>(null);
  const emotionStabilityCountRef = useRef<number>(0);
  const detectionQualityRef = useRef<number>(0);
  const consecutiveEmotionCountRef = useRef<Record<string, number>>({});
  const lastEmotionTimestampRef = useRef<number>(Date.now());
  const actionLockRef = useRef<{ label: string | null; until: number }>({ label: null, until: 0 });
  const lastDetectionTimeRef = useRef<number>(0);

  // Get camera device
  const device = useCameraDevice(cameraPosition);
  const devices = useCameraDevices();

  // Log all available cameras
  useEffect(() => {
    if (devices && devices.length > 0) {
      console.log('📷 ===== AVAILABLE CAMERAS ON DEVICE =====');
      console.log(`Total cameras found: ${devices.length}`);
      console.log('');
      
      devices.forEach((cam, index) => {
        console.log(`Camera ${index + 1}:`);
        console.log(`  ID: ${cam.id}`);
        console.log(`  Position: ${cam.position}`);
        console.log(`  Name: ${cam.name}`);
        console.log(`  Has Flash: ${cam.hasFlash}`);
        console.log(`  Has Torch: ${cam.hasTorch}`);
        console.log(`  Min Zoom: ${cam.minZoom}x`);
        console.log(`  Max Zoom: ${cam.maxZoom}x`);
        console.log(`  Neutral Zoom: ${cam.neutralZoom}x`);
        console.log(`  Physical Devices: ${cam.physicalDevices.join(', ')}`);
        console.log(`  Supports Focus: ${cam.supportsFocus}`);
        console.log(`  Supports RAW: ${cam.supportsRawCapture}`);
        console.log(`  Supports Low Light: ${cam.supportsLowLightBoost}`);
        
        if (cam.formats && cam.formats.length > 0) {
          console.log(`  Available Formats: ${cam.formats.length}`);
          console.log(`    Max Photo Resolution: ${cam.formats[0].photoWidth}x${cam.formats[0].photoHeight}`);
          console.log(`    Max Video Resolution: ${cam.formats[0].videoWidth}x${cam.formats[0].videoHeight}`);
          console.log(`    Max FPS: ${cam.formats[0].maxFps}`);
        }
        console.log('');
      });
      
      console.log('📷 ===== END OF CAMERA LIST =====');
      console.log('');
      
      // Also show current active camera
      if (device) {
        console.log('✅ Currently Active Camera:');
        console.log(`  Position: ${device.position}`);
        console.log(`  Name: ${device.name}`);
        console.log(`  Zoom Range: ${device.minZoom}x - ${device.maxZoom}x`);
        console.log('');
      }
    }
  }, [devices, device]);

  // Zoom
  const zoom = useSharedValue(1);
  const [currentZoom, setCurrentZoom] = useState(1); // For displaying zoom level
  const minZoom = device?.minZoom ?? 1;
  const maxZoom = device?.maxZoom ?? 10;
  const neutralZoom = device?.neutralZoom ?? 1;

  // Recording timer
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const captureButtonScale = useSharedValue(1);
  const flashAnimation = useSharedValue(0);
  const flashOpacity = new Animated.Value(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  useEffect(() => {
    if (isRecording) {
      recordingInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [isRecording]);

  const animatedProps = useAnimatedProps(() => {
    return {
      zoom: Math.max(Math.min(zoom.value, maxZoom), minZoom),
    };
  }, [zoom, maxZoom, minZoom]);

  // Pinch to zoom gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const velocity = (event.scale - 1) / 5;
      const newZoom = zoom.value + velocity;
      zoom.value = Math.max(Math.min(newZoom, maxZoom), minZoom);
    })
    .onEnd(() => {
      // Update display zoom level
      runOnJS(setCurrentZoom)(zoom.value);
    });

  // Double tap to switch camera
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(flipCamera)();
    });

  // Single tap to focus
  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((event) => {
      // Focus at tap location
      runOnJS(focusAtPoint)(event.x, event.y);
    });

  const composedGestures = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, tapGesture)
  );

  const flipCamera = useCallback(() => {
    setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));
    zoom.value = withSpring(1);
    setCurrentZoom(1);
  }, [zoom]);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }, []);

  const cycleTimer = useCallback(() => {
    setTimer((prev) => {
      if (prev === 0) return 3;
      if (prev === 3) return 10;
      return 0;
    });
  }, []);

  const focusAtPoint = useCallback((x: number, y: number) => {
    // Show focus indicator at tap location
    // Note: VisionCamera v4 handles focus automatically on tap
    console.log('Focus at:', x, y);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const triggerFlashAnimation = () => {
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const delay = (ms: number) => new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

  const takePhoto = useCallback(async () => {
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // Handle timer
      if (timer > 0) {
        for (let i = timer; i > 0; i--) {
          // Show countdown (you can replace this with a custom UI overlay)
          console.log(`Countdown: ${i}`);
          await delay(1000);
        }
      }

      triggerFlashAnimation();

      const photo = await camera.current.takePhoto({
        flash: flash === 'off' ? 'off' : flash === 'on' ? 'on' : 'auto',
        enableShutterSound: true,
      });

      console.log('Photo captured:', photo.path);
      // Save to app gallery
      const saved = await savePhotoToMedia(photo.path);
      setLastMediaPath(saved);
      Alert.alert('Saved', 'Photo saved to Gallery');

      // You might want to navigate to a preview screen
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  }, [camera, flash, timer, isCapturing, cameraPosition]);

  const startRecording = useCallback(async () => {
    if (!camera.current || isRecording) return;

    try {
      setIsRecording(true);
      camera.current.startRecording({
        flash: flash === 'on' ? 'on' : 'off',
        onRecordingFinished: async (video) => {
          console.log('Video recorded:', video.path);
          try {
            const saved = await saveVideoToMedia(video.path);
            setLastMediaPath(saved);
            Alert.alert('Saved', 'Video saved to Gallery');
          } catch (e) {
            console.warn('Save video error', e);
            Alert.alert('Success', `Video saved to: ${video.path}`);
          }
          setIsRecording(false);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          Alert.alert('Error', 'Failed to record video');
          setIsRecording(false);
        },
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  }, [camera, flash, isRecording]);

  const stopRecording = useCallback(async () => {
    if (!camera.current || !isRecording) return;

    try {
      await camera.current.stopRecording();
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [camera, isRecording]);

  const handleCapture = useCallback(() => {
    if (cameraMode === 'video') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    } else {
      takePhoto();
    }
  }, [cameraMode, isRecording, startRecording, stopRecording, takePhoto]);

  const zoomIn = useCallback(() => {
    zoom.value = withSpring(Math.min(zoom.value + 1, maxZoom));
  }, [zoom, maxZoom]);

  const zoomOut = useCallback(() => {
    zoom.value = withSpring(Math.max(zoom.value - 1, minZoom));
  }, [zoom, minZoom]);

  const resetZoom = useCallback(() => {
    zoom.value = withSpring(1);
    setCurrentZoom(1);
  }, [zoom]);

  const setZoomLevel = useCallback((level: number) => {
    zoom.value = withSpring(level);
    setCurrentZoom(level);
  }, [zoom]);

  // Create emotion detection state object
  const emotionDetectionState: EmotionDetectionState = {
    emotionHistoryRef,
    baselineExpressionsRef,
    lastStableEmotionRef,
    emotionStabilityCountRef,
    detectionQualityRef,
    consecutiveEmotionCountRef,
    lastEmotionTimestampRef,
    actionLockRef
  };

  // Handle detected emotion
  const handleEmotionDetected = useCallback((emotion: string, emoji: string, confidence: number) => {
    setDetectedEmotion(emotion);
    setEmotionEmoji(emoji);
    setEmotionConfidence(confidence);
  }, []);

  // Detect emotion from camera frame
  const detectEmotionFromFrame = useCallback(async () => {
    if (!isEmotionDetectionEnabled || !isFocused) return;
    // Avoid snapshots during video mode or while recording to prevent invalid session configurations
    if (cameraMode === 'video' || isRecording) return;
    
    const now = Date.now();
    if (now - lastDetectionTimeRef.current < 500) return;
    lastDetectionTimeRef.current = now;
    
    try {
      // Take a snapshot for face detection
      if (camera.current) {
        const photo = await camera.current.takeSnapshot({
          quality: 20, // Low quality for fast processing
        });
        
        // Detect faces
        const faces = await FaceDetection.detect(`file://${photo.path}`, {
          performanceMode: 'fast',
          landmarkMode: 'all',
          contourMode: 'all',
        });
        
        setFaceDetected(faces && faces.length > 0);
        
        if (faces && faces.length > 0) {
          const face = faces[0];
          
          // Detect emotion
          const detectionResult = await detectEmotionsFromFace(face, emotionDetectionState);
          
          if (detectionResult && detectionResult.topExpression) {
            const { topExpression } = detectionResult;
            const emoji = emotionEmojiMap[topExpression.name] || '😐';
            
            handleEmotionDetected(
              topExpression.name,
              emoji,
              topExpression.confidence
            );
          }
        } else {
          setFaceDetected(false);
        }
      }
    } catch (error) {
      console.error('Emotion detection error:', error);
    }
  }, [isEmotionDetectionEnabled, isFocused, cameraMode, isRecording, emotionDetectionState, handleEmotionDetected]);

  // Run emotion detection periodically
  useEffect(() => {
    if (!isEmotionDetectionEnabled || !isFocused) return;
    
    const interval = setInterval(() => {
      detectEmotionFromFrame();
    }, 500);
    
    return () => clearInterval(interval);
  }, [isEmotionDetectionEnabled, isFocused, detectEmotionFromFrame]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <IconIonic name="camera-outline" size={80} color="#999" />
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <GestureDetector gesture={composedGestures}>
        <View style={styles.cameraContainer}>
          <ReanimatedCamera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            photo={cameraMode !== 'video'}
            video={cameraMode === 'video'}
            audio={cameraMode === 'video'}
            animatedProps={animatedProps}
            enableZoomGesture={false}
          />

          {/* Flash animation overlay */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#fff', opacity: flashOpacity },
            ]}
            pointerEvents="none"
          />

          {/* Live filter overlays */}
          {activeFilter === 'vivid' && (
            <>
              {/* Neutral vivid (less warm) */}
              <View style={[StyleSheet.absoluteFill, styles.filterOverlay, styles.vividOverlayNeutral]} pointerEvents="none" />
              <View style={[StyleSheet.absoluteFill, styles.filterOverlay, styles.vividOverlayCool]} pointerEvents="none" />

              {/* Beauty ML overlay - only when a face is detected */}
              {beautyEnabled && faceDetected && (
                <View pointerEvents="none" style={styles.beautyContainer}>
                  <View style={[styles.beautyMask, { opacity: beautyIntensity }]} />
                  <View style={[styles.beautyMaskInner, { opacity: beautyIntensity * 0.8 }]} />
                </View>
              )}
            </>
          )}

          {/* Top controls */}
          {showControls && (
            <View style={styles.topControls}>
              <View style={styles.topLeftControls}>
                <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                  <Icon name="close" size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconButton} onPress={cycleFlash}>
                  <IconIonic
                    name={
                      flash === 'off'
                        ? 'flash-off'
                        : flash === 'on'
                        ? 'flash'
                        : 'flash-outline'
                    }
                    size={28}
                    color={flash === 'off' ? '#fff' : '#FFD700'}
                  />
                </TouchableOpacity>

                {cameraMode === 'photo' && (
                  <TouchableOpacity style={styles.iconButton} onPress={() => setLivePhoto(!livePhoto)}>
                    <IconIonic
                      name="radio-button-on-outline"
                      size={28}
                      color={livePhoto ? '#FFD700' : '#999'}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.topRightControls}>
                {cameraMode === 'photo' && (
                  <>
                    <TouchableOpacity style={styles.iconButton} onPress={cycleTimer}>
                      {timer === 0 ? (
                        <IconIonic name="timer-outline" size={28} color="#fff" />
                      ) : (
                        <View style={styles.timerBadge}>
                          <Text style={styles.timerText}>{timer}</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconButton} onPress={() => setHdr(!hdr)}>
                      <Text style={[styles.hdrText, { color: hdr ? '#FFD700' : '#fff' }]}>
                        HDR
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.iconButton} 
                      onPress={() => {
                        console.log('📷 Logging all cameras...');
                        if (devices && devices.length > 0) {
                          console.log(JSON.stringify(devices, null, 2));
                        } else {
                          console.log('No cameras found');
                        }
                      }}
                    >
                      <IconIonic name="information-circle-outline" size={28} color="#fff" />
                    </TouchableOpacity>

                    {/* Vivid filter toggle */}
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => setActiveFilter(prev => (prev === 'vivid' ? 'none' : 'vivid'))}
                    >
                      <IconIonic
                        name="color-filter"
                        size={26}
                        color={activeFilter === 'vivid' ? '#FFD700' : '#fff'}
                      />
                    </TouchableOpacity>

                    {/* Beauty toggle (applies when vivid on) */}
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => setBeautyEnabled(v => !v)}
                    >
                      <IconIonic
                        name={beautyEnabled ? 'sparkles' : 'sparkles-outline'}
                        size={24}
                        color={beautyEnabled ? '#FFD700' : '#fff'}
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatTime(recordingTime)}</Text>
            </View>
          )}

          {/* Zoom controls */}
          {showControls && (
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomButton} onPress={resetZoom}>
                <Text style={styles.zoomText}>1x</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={() => setZoomLevel(2)}>
                <Text style={styles.zoomText}>2x</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={() => setZoomLevel(5)}>
                <Text style={styles.zoomText}>5x</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom controls */}
          {showControls && (
            <View style={styles.bottomControls}>
              {/* Mode selector */}
              <View style={styles.modeSelector}>
                <ScrollableModePicker
                  modes={['PANO', 'SQUARE', 'PHOTO', 'VIDEO', 'PORTRAIT']}
                  activeMode={cameraMode.toUpperCase()}
                  onModeChange={(mode) => {
                    const modeMap: Record<string, CameraMode> = {
                      PANO: 'pano',
                      SQUARE: 'square',
                      PHOTO: 'photo',
                      VIDEO: 'video',
                      PORTRAIT: 'portrait',
                    };
                    setCameraMode(modeMap[mode] || 'photo');
                  }}
                />
              </View>

              {/* Capture controls */}
              <View style={styles.captureRow}>
                {/* Gallery thumbnail */}
                <TouchableOpacity style={styles.galleryButton} onPress={() => (navigation as any).navigate('Gallery')}>
                  <View style={styles.galleryPlaceholder}>
                    {lastMediaPath ? (
                      <Image source={{ uri: `file://${lastMediaPath}` }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                    ) : (
                      <Icon name="photo-library" size={24} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Capture button */}
                <TouchableOpacity
                  style={styles.captureButtonContainer}
                  onPress={handleCapture}
                  disabled={isCapturing}
                  activeOpacity={0.8}
                >
                  <View style={styles.captureButtonOuter}>
                    <View
                      style={[
                        styles.captureButtonInner,
                        isRecording && styles.captureButtonRecording,
                        isCapturing && styles.captureButtonDisabled,
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                {/* Flip camera */}
                <TouchableOpacity style={styles.flipButton} onPress={flipCamera}>
                  <View style={styles.flipButtonCircle}>
                    <IconIonic name="camera-reverse" size={28} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Zoom indicator */}
          {currentZoom > 1.1 && (
            <View style={styles.zoomIndicator}>
              <Text style={styles.zoomIndicatorText}>{currentZoom.toFixed(1)}x</Text>
            </View>
          )}

          {/* Emotion Detection Overlay */}
          {isEmotionDetectionEnabled && (
            <>
              {/* Emotion display card */}
              {faceDetected && detectedEmotion && (
                <View style={styles.emotionCard}>
                  <View style={styles.emotionHeader}>
                    <Text style={styles.emotionEmoji}>{emotionEmoji}</Text>
                    <View style={styles.emotionTextContainer}>
                      <Text style={styles.emotionText}>{detectedEmotion}</Text>
                      <View style={styles.confidenceBar}>
                        <View 
                          style={[
                            styles.confidenceBarFill, 
                            { width: `${emotionConfidence * 100}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.confidenceText}>
                        {(emotionConfidence * 100).toFixed(0)}% confident
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Face detection indicator */}
              <View style={styles.emotionStatusBar}>
                <View style={[
                  styles.emotionStatusDot,
                  { backgroundColor: faceDetected ? '#4CAF50' : '#999' }
                ]} />
                <Text style={styles.emotionStatusText}>
                  {faceDetected ? 'Face Detected' : 'Looking for faces...'}
                </Text>
              </View>

              {/* Toggle button */}
              <TouchableOpacity
                style={styles.emotionToggleButton}
                onPress={() => setIsEmotionDetectionEnabled(!isEmotionDetectionEnabled)}
              >
                <IconIonic
                  name={isEmotionDetectionEnabled ? "happy" : "happy-outline"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            </>
          )}

          {/* Emotion detection disabled button */}
          {!isEmotionDetectionEnabled && (
            <TouchableOpacity
              style={[styles.emotionToggleButton, styles.emotionToggleButtonDisabled]}
              onPress={() => setIsEmotionDetectionEnabled(true)}
            >
              <IconIonic name="happy-outline" size={24} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

// Scrollable mode picker component (iPhone-style)
const ScrollableModePicker = ({
  modes,
  activeMode,
  onModeChange,
}: {
  modes: string[];
  activeMode: string;
  onModeChange: (mode: string) => void;
}) => {
  return (
    <View style={styles.modePickerContainer}>
      {modes.map((mode) => (
        <TouchableOpacity
          key={mode}
          onPress={() => onModeChange(mode)}
          style={styles.modeItem}
        >
          <Text
            style={[
              styles.modeText,
              activeMode === mode && styles.modeTextActive,
            ]}
          >
            {mode}
          </Text>
          {activeMode === mode && <View style={styles.modeIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topLeftControls: {
    flexDirection: 'row',
    gap: 15,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  timerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hdrText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  recordingIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  zoomControls: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    zIndex: 10,
  },
  zoomButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  zoomIndicator: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  zoomIndicatorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modeSelector: {
    marginBottom: 30,
  },
  modePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 25,
  },
  modeItem: {
    alignItems: 'center',
  },
  modeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeTextActive: {
    color: '#FFD700',
    fontSize: 14,
  },
  modeIndicator: {
    marginTop: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
  },
  captureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  galleryButton: {
    width: 50,
    height: 50,
  },
  galleryPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  captureButtonContainer: {
    width: 80,
    height: 80,
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 6,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  captureButtonRecording: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  flipButton: {
    width: 50,
    height: 50,
  },
  flipButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  // Emotion detection styles
  emotionCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 20,
    padding: 16,
    paddingHorizontal: 20,
    minWidth: 250,
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.5)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  emotionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emotionEmoji: {
    fontSize: 48,
  },
  emotionTextContainer: {
    flex: 1,
  },
  emotionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  confidenceText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  emotionStatusBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 220 : 190,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 8,
  },
  emotionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emotionStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emotionToggleButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 130,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  emotionToggleButtonDisabled: {
    borderColor: '#999',
    shadowColor: '#999',
  },
  // Live filter overlays
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Neutral, detail-friendly vivid tint (less warm)
  vividOverlayNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  vividOverlayCool: {
    backgroundColor: 'rgba(0, 160, 255, 0.05)',
  },
  // Beauty mask centered softly to brighten midtones where the face usually is
  beautyContainer: {
    position: 'absolute',
    top: '20%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  beautyMask: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_HEIGHT * 0.5,
    borderRadius: SCREEN_WIDTH * 0.7,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  beautyMaskInner: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: SCREEN_WIDTH * 0.65,
    backgroundColor: 'rgba(255,255,255,0.6)'
  },
});

export default CameraScreen;

