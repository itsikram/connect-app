// Simplified camera without Reanimated for debugging
// Use this version if you need Chrome debugger, otherwise use CameraScreen.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';

type CameraMode = 'photo' | 'video';
type FlashMode = 'off' | 'on' | 'auto';

const CameraScreenSimple = () => {
  const navigation = useNavigation();
  const camera = useRef<any>(null);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Request camera permission on mount
  useEffect(() => {
    (async () => {
      if (!permission) {
        const result = await requestPermission();
        setHasPermission(result.granted);
      } else {
        setHasPermission(permission.granted);
      }
    })();
  }, [permission, requestPermission]);

  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('photo');
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Expo Camera handles device selection differently
  const device = null;

  const flipCamera = useCallback(() => {
    setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));
    setZoom(1);
  }, []);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }, []);

  const takePhoto = useCallback(async () => {
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({
        quality: 0.8,
      });
      console.log('Photo captured:', photo.uri);
      // Handle photo...
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  }, [camera, isCapturing]);

  const startRecording = useCallback(async () => {
    if (!camera.current || isRecording) return;

    try {
      setIsRecording(true);
      const video = await camera.current.recordAsync({});
      console.log('Video recorded:', video.uri);
      Alert.alert('Success', 'Video recorded!');
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  }, [camera, isRecording]);

  const stopRecording = useCallback(async () => {
    if (!camera.current || !isRecording) return;
    try {
      await camera.current.stopRecording();
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

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <IconIonic name="camera-outline" size={80} color="#999" />
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => {
            (async () => {
              const result = await requestPermission();
              setHasPermission(result.granted);
            })();
          }}>
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={cameraPosition}
        mode={cameraMode === 'video' ? 'video' : 'picture'}
      />

      {/* Top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Icon name="close" size={32} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={cycleFlash}>
          <IconIonic
            name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'}
            size={28}
            color={flash === 'off' ? '#999' : '#FFD700'}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {/* Mode selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity onPress={() => setCameraMode('photo')}>
            <Text style={[styles.modeText, cameraMode === 'photo' && styles.modeTextActive]}>
              PHOTO
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCameraMode('video')}>
            <Text style={[styles.modeText, cameraMode === 'video' && styles.modeTextActive]}>
              VIDEO
            </Text>
          </TouchableOpacity>
        </View>

        {/* Capture button */}
        <View style={styles.captureRow}>
          <View style={{ width: 50 }} />
          
          <TouchableOpacity
            style={styles.captureButtonContainer}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            <View style={styles.captureButtonOuter}>
              <View
                style={[
                  styles.captureButtonInner,
                  isRecording && styles.captureButtonRecording,
                ]}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.flipButton} onPress={flipCamera}>
            <IconIonic name="camera-reverse" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 30,
  },
  modeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFD700',
  },
  captureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  captureButtonContainer: {
    width: 80,
    height: 80,
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CameraScreenSimple;

