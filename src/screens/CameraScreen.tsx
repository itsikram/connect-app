import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { savePhotoToMedia, saveVideoToMedia } from '../lib/mediaLibrary';

const MODE_OPTIONS = [
  { id: 'pano', label: 'Pano' },
  { id: 'square', label: 'Square' },
  { id: 'photo', label: 'Photo' },
  { id: 'video', label: 'Video' },
  { id: 'portrait', label: 'Portrait' },
] as const;

const FILTER_OPTIONS = [
  { id: 'original', label: 'Original', overlay: '#000000', opacity: 0 },
  { id: 'vivid', label: 'Vivid', overlay: '#2f7bff', opacity: 0.26 },
  { id: 'vividWarm', label: 'Vivid Warm', overlay: '#ffb14a', opacity: 0.28 },
  { id: 'vividCool', label: 'Vivid Cool', overlay: '#61c1ff', opacity: 0.24 },
  { id: 'dramatic', label: 'Dramatic', overlay: '#1b2538', opacity: 0.38 },
  { id: 'dramaticWarm', label: 'Dramatic Warm', overlay: '#c67a2c', opacity: 0.32 },
  { id: 'dramaticCool', label: 'Dramatic Cool', overlay: '#3d667e', opacity: 0.3 },
  { id: 'mono', label: 'Mono', overlay: '#dfe4eb', opacity: 0.32 },
  { id: 'silvertone', label: 'Silvertone', overlay: '#dfe3eb', opacity: 0.28 },
  { id: 'noir', label: 'Noir', overlay: '#080b10', opacity: 0.72 },
] as const;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
};

const CameraScreen = () => {
  const navigation = useNavigation();
  const camera = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraPosition, setCameraPosition] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [timer, setTimer] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [layoutMode, setLayoutMode] = useState<(typeof MODE_OPTIONS)[number]['id']>('photo');
  const [showFilters, setShowFilters] = useState(true);
  const [filterId, setFilterId] = useState<string>('original');
  const [intensity, setIntensity] = useState(100);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [showFilterLabel, setShowFilterLabel] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!permission) {
        const result = await requestPermission();
        setHasPermission(result.granted);
      } else {
        setHasPermission(permission.granted);
      }
    };

    run();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0);
      return;
    }

    const timerId = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [isRecording]);

  useEffect(() => {
    if (!showFilterLabel) {
      return;
    }

    const timeout = setTimeout(() => setShowFilterLabel(false), 900);
    return () => clearTimeout(timeout);
  }, [showFilterLabel, filterId]);

  const triggerFlashAnimation = useCallback(() => {
    setFlashOn(true);
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
    ]).start(() => {
      setFlashOn(false);
    });
  }, [flashOpacity]);

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

  const flipCamera = useCallback(() => {
    setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));
    setZoom(1);
  }, []);

  const onModeSelect = useCallback((modeId: (typeof MODE_OPTIONS)[number]['id']) => {
    setLayoutMode(modeId);
    setCaptureMode(modeId === 'video' ? 'video' : 'photo');
  }, []);

  const delay = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

  const takePhoto = useCallback(async () => {
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);
    try {
      if (timer > 0) {
        for (let i = timer; i > 0; i -= 1) {
          setCountdown(i);
          await delay(1000);
        }
      }

      triggerFlashAnimation();
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        throw new Error('No photo created');
      }

      const saved = await savePhotoToMedia(photo.uri);
      setLastThumb(saved);
      setShowFilterLabel(true);
      Alert.alert('Saved', 'Photo saved to gallery');
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setCountdown(null);
      setIsCapturing(false);
    }
  }, [delay, isCapturing, timer, triggerFlashAnimation]);

  const startRecording = useCallback(async () => {
    if (!camera.current || isRecording) return;

    setIsRecording(true);
    try {
      const video = await camera.current.recordAsync({ maxDuration: 60 });
      const saved = await saveVideoToMedia(video.uri);
      setLastThumb(saved);
      Alert.alert('Saved', 'Video saved to gallery');
    } catch (error) {
      console.error('Failed to record video:', error);
      Alert.alert('Error', 'Failed to record video');
    } finally {
      setIsRecording(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    if (!camera.current || !isRecording) return;

    try {
      await camera.current.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [isRecording]);

  const handleCapture = useCallback(() => {
    if (captureMode === 'video') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
      return;
    }

    takePhoto();
  }, [captureMode, isRecording, startRecording, stopRecording, takePhoto]);

  const currentFilter = FILTER_OPTIONS.find((item) => item.id === filterId) ?? FILTER_OPTIONS[0];
  const activeZoom = zoom === 2 ? 0.42 : 0;
  const filterPreviewOpacity =
    filterId === 'original'
      ? 0
      : Math.min(0.86, Math.max(currentFilter.opacity, 0.12 + (intensity / 100) * 0.72));
  const filterOverlayStyle = {
    backgroundColor: currentFilter.overlay,
    opacity: filterPreviewOpacity,
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <TouchableOpacity style={styles.closeAbsoluteButton} onPress={() => navigation.goBack()}>
            <Icon name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <IconIonic name="camera-outline" size={72} color="#fff" />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>Allow camera access to take photos and videos.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              const result = await requestPermission();
              setHasPermission(result.granted);
            }}
          >
            <Text style={styles.primaryButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.cameraStage}>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={cameraPosition}
          flash={flash}
          zoom={activeZoom}
          mode={captureMode === 'video' ? 'video' : 'picture'}
        />

        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flashOpacity }]}
        />

        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.filterOverlay, filterOverlayStyle]} />

        {isRecording && (
          <View style={styles.recPill}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>{formatTime(recordingTime)}</Text>
          </View>
        )}

        {countdown !== null && countdown > 0 && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {showFilterLabel && (
          <View style={styles.filterLabel}>
            <Text style={styles.filterLabelText}>{currentFilter.label}</Text>
          </View>
        )}

        <View style={styles.chromeTop}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, flash !== 'off' && styles.iconButtonActive]}
              onPress={cycleFlash}
            >
              <IconIonic
                name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'}
                size={24}
                color={flash === 'off' ? '#fff' : '#FFD60A'}
              />
              {flash === 'auto' && <Text style={styles.flashLetter}>A</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, timer > 0 && styles.iconButtonActive]}
              onPress={cycleTimer}
            >
              <IconIonic name="timer-outline" size={24} color={timer > 0 ? '#FFD60A' : '#fff'} />
              {timer > 0 && <Text style={styles.timerBadgeText}>{timer}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, showFilters && styles.iconButtonActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <IconIonic name="color-filter-outline" size={24} color={showFilters ? '#FFD60A' : '#fff'} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.chromeBottom}>
          <View style={styles.zoomRow}>
            {[1, 2].map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.zoomPill, zoom === value && styles.zoomPillActive]}
                onPress={() => setZoom(value as 1 | 2)}
              >
                <Text style={[styles.zoomText, zoom === value && styles.zoomTextActive]}>{value}×</Text>
              </TouchableOpacity>
            ))}
          </View>

          {showFilters ? (
            <View style={styles.filterWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterStrip}
              >
                {FILTER_OPTIONS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterItem, filterId === item.id && styles.filterItemActive]}
                    onPress={() => {
                      setFilterId(item.id);
                      setShowFilterLabel(true);
                    }}
                  >
                    <View
                      style={[
                        styles.filterThumb,
                        { backgroundColor: item.overlay },
                        filterId === item.id && styles.filterThumbActive,
                      ]}
                    />
                    <Text style={[styles.filterLabelTextMini, filterId === item.id && styles.filterLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filterId !== 'original' && (
                <View style={styles.intensityRow}>
                  <Text style={styles.intensityValue}>{intensity}</Text>
                  <View style={styles.sliderShell}>
                    <Text style={styles.sliderText}>Intensity</Text>
                    <Slider
                      value={intensity}
                      minimumValue={0}
                      maximumValue={100}
                      step={1}
                      onValueChange={setIntensity}
                      minimumTrackTintColor="#FFD60A"
                      maximumTrackTintColor="rgba(255,255,255,0.25)"
                      thumbTintColor="#FFFFFF"
                      style={styles.slider}
                    />
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.modeRow}>
              {MODE_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.modeButton}
                  onPress={() => onModeSelect(item.id)}
                >
                  <Text style={[styles.modeText, layoutMode === item.id && styles.modeTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.captureRow}>
            <TouchableOpacity style={styles.galleryButton} onPress={() => {}}>
              {lastThumb ? (
                <Image source={{ uri: lastThumb }} style={styles.galleryThumbImage} />
              ) : (
                <IconIonic name="images-outline" size={26} color="#fff" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shutterButton, (captureMode === 'video' || isRecording) && styles.shutterVideo, isRecording && styles.shutterRecording]}
              onPress={handleCapture}
              disabled={isCapturing}
            >
              <View style={styles.shutterRing} />
              <View style={[styles.shutterCore, (captureMode === 'video' || isRecording) && styles.shutterCoreVideo, isRecording && styles.shutterCoreRecording]} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.flipButton, isFocused && styles.flipButtonFocused]} onPress={flipCamera}>
              <IconIonic name="camera-reverse" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 18,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050506',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    marginTop: 18,
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  permissionText: {
    marginTop: 10,
    maxWidth: 320,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 21,
  },
  primaryButton: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#0A84FF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeAbsoluteButton: {
    position: 'absolute',
    top: 26,
    left: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraStage: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  chromeTop: {
    position: 'absolute',
    top: (Platform.OS === 'ios' ? 16 : 8),
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12,12,14,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonActive: {
    borderColor: 'rgba(255,214,10,0.45)',
  },
  flashLetter: {
    position: 'absolute',
    right: 7,
    bottom: 6,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFD60A',
  },
  timerBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#FFD60A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  timerBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '800',
  },
  chromeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
  },
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  zoomPill: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPillActive: {
    backgroundColor: '#fff',
  },
  zoomText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  zoomTextActive: {
    color: '#111',
  },
  filterWrap: {
    marginBottom: 12,
  },
  filterStrip: {
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 12,
  },
  filterItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    gap: 6,
  },
  filterItemActive: {
    opacity: 1,
  },
  filterThumb: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#161618',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#fff',
    shadowOpacity: 0.12,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  filterThumbActive: {
    borderColor: '#FFD60A',
    shadowColor: '#FFD60A',
    shadowOpacity: 0.9,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    transform: [{ scale: 1.08 }],
  },
  filterLabelTextMini: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '650',
    letterSpacing: 0.1,
    maxWidth: 74,
  },
  filterLabelActive: {
    color: '#FFD60A',
  },
  intensityRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 10,
  },
  intensityValue: {
    width: 36,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  sliderShell: {
    flex: 1,
  },
  sliderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 28,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginBottom: 18,
  },
  modeButton: {
    paddingVertical: 6,
  },
  modeText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modeTextActive: {
    color: '#FFD60A',
  },
  captureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterVideo: {
    opacity: 1,
  },
  shutterRecording: {
    transform: [{ scale: 1 }],
  },
  shutterRing: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
  },
  shutterCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  shutterCoreVideo: {
    backgroundColor: '#FF3B30',
  },
  shutterCoreRecording: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  flipButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButtonFocused: {
    transform: [{ rotate: '180deg' }],
  },
  recPill: {
    position: 'absolute',
    top: 80,
    left: '50%',
    transform: [{ translateX: -50 }],
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  recText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  countdownContainer: {
    position: 'absolute',
    inset: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    color: '#fff',
    fontSize: 120,
    fontWeight: '200',
    letterSpacing: -4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  filterLabel: {
    position: 'absolute',
    left: '50%',
    top: '22%',
    transform: [{ translateX: -50 }],
    zIndex: 11,
    opacity: 1,
  },
  filterLabelText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '590',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18,
  },
  filterOverlay: {
    backgroundColor: '#000000',
    opacity: 0,
  },
});

export default CameraScreen;
