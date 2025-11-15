import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import Svg, { Circle, Path } from 'react-native-svg';
import FaceDetection from '@react-native-ml-kit/face-detection';
import type { Face } from '@react-native-ml-kit/face-detection';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Landmark {
  x: number;
  y: number;
  type?: string;
}

interface DetectedFace {
  landmarks: Landmark[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const FaceLandmarksScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors: themeColors } = useTheme();
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);

  const [isActive, setIsActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [viewSize, setViewSize] = useState<{ width: number; height: number }>({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessTime, setLastProcessTime] = useState<number>(0);
  const [faceCount, setFaceCount] = useState<number>(0);
  const [landmarkCount, setLandmarkCount] = useState<number>(0);

  const processingRef = useRef(false);
  const lastProcessTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const PROCESSING_INTERVAL = 200; // Process every 200ms for smooth real-time detection

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

  const processFrame = useCallback(async () => {
    if (processingRef.current) return;
    
    const now = Date.now();
    if (now - lastProcessTimeRef.current < PROCESSING_INTERVAL) {
      return;
    }
    lastProcessTimeRef.current = now;

    processingRef.current = true;
    setIsProcessing(true);
    setLastProcessTime(now);

    try {
      // Take a snapshot for face detection
      if (cameraRef.current) {
        const photo = await cameraRef.current.takeSnapshot({
          quality: 30, // Lower quality for faster processing
        });

        const fileUri = `file://${photo.path}`;
        
        // Detect faces with all landmarks
        const faces = await FaceDetection.detect(fileUri, {
          performanceMode: 'fast',
          landmarkMode: 'all',
          contourMode: 'all',
          classificationMode: 'none',
        });

        if (faces && faces.length > 0) {
          const processedFaces: DetectedFace[] = [];
          let totalLandmarks = 0;

          faces.forEach((face: Face) => {
            const landmarks: Landmark[] = [];
            const photoWidth = (photo as any)?.width ?? viewSize.width;
            const photoHeight = (photo as any)?.height ?? viewSize.height;

            // Extract all landmark points
            const faceData = face as any;
            
            // Left eye landmarks
            if (faceData.leftEye) {
              landmarks.push({
                x: faceData.leftEye.x / photoWidth,
                y: faceData.leftEye.y / photoHeight,
                type: 'leftEye',
              });
            }

            // Right eye landmarks
            if (faceData.rightEye) {
              landmarks.push({
                x: faceData.rightEye.x / photoWidth,
                y: faceData.rightEye.y / photoHeight,
                type: 'rightEye',
              });
            }

            // Nose landmarks
            if (faceData.noseBase) {
              landmarks.push({
                x: faceData.noseBase.x / photoWidth,
                y: faceData.noseBase.y / photoHeight,
                type: 'noseBase',
              });
            }

            // Mouth landmarks
            if (faceData.leftMouth) {
              landmarks.push({
                x: faceData.leftMouth.x / photoWidth,
                y: faceData.leftMouth.y / photoHeight,
                type: 'leftMouth',
              });
            }
            if (faceData.rightMouth) {
              landmarks.push({
                x: faceData.rightMouth.x / photoWidth,
                y: faceData.rightMouth.y / photoHeight,
                type: 'rightMouth',
              });
            }
            if (faceData.bottomMouth) {
              landmarks.push({
                x: faceData.bottomMouth.x / photoWidth,
                y: faceData.bottomMouth.y / photoHeight,
                type: 'bottomMouth',
              });
            }

            // Contour points (face outline)
            if (faceData.contours && faceData.contours.length > 0) {
              faceData.contours.forEach((point: any) => {
                landmarks.push({
                  x: point.x / photoWidth,
                  y: point.y / photoHeight,
                  type: 'contour',
                });
              });
            }

            // Additional landmarks if available
            if (faceData.landmarks && faceData.landmarks.length > 0) {
              faceData.landmarks.forEach((landmark: any) => {
                landmarks.push({
                  x: landmark.position.x / photoWidth,
                  y: landmark.position.y / photoHeight,
                  type: landmark.type || 'landmark',
                });
              });
            }

            totalLandmarks += landmarks.length;

            // Get face bounds
            const bounds: any = (face as any).bounds || (face as any).frame || {};
            const faceBounds = {
              x: (bounds.x ?? bounds.left ?? 0) / photoWidth,
              y: (bounds.y ?? bounds.top ?? 0) / photoHeight,
              width: (bounds.width ?? ((bounds.right ?? 0) - (bounds.left ?? 0))) / photoWidth,
              height: (bounds.height ?? ((bounds.bottom ?? 0) - (bounds.top ?? 0))) / photoHeight,
            };

            processedFaces.push({
              landmarks,
              bounds: faceBounds,
            });
          });

          setDetectedFaces(processedFaces);
          setFaceCount(processedFaces.length);
          setLandmarkCount(totalLandmarks);
        } else {
          setDetectedFaces([]);
          setFaceCount(0);
          setLandmarkCount(0);
        }
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      setDetectedFaces([]);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [viewSize]);

  // Start / stop JS interval for processing instead of using frameProcessor worklets
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      // Fire-and-forget; internal throttling will skip if too soon
      processFrame();
    }, PROCESSING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, processFrame]);

  // Scale points from normalized (0-1) to view coordinates
  const scalePoint = useCallback((nx: number, ny: number, flipX: boolean = true) => {
    const x = flipX ? viewSize.width - nx * viewSize.width : nx * viewSize.width;
    const y = ny * viewSize.height;
    return { x, y };
  }, [viewSize]);

  // Helper to flip X coordinate for front camera
  const flipX = useCallback((x: number) => {
    return viewSize.width - x;
  }, [viewSize]);

  // Render landmarks overlay
  const landmarksOverlay = useMemo(() => {
    if (!detectedFaces.length) return null;

    const circles: Array<React.ReactElement> = [];
    const paths: Array<React.ReactElement> = [];
    let circleKey = 0;

    detectedFaces.forEach((face, faceIdx) => {
      // Draw face bounding box
      const boxX = flipX(face.bounds.x * viewSize.width);
      const boxY = face.bounds.y * viewSize.height;
      const boxWidth = face.bounds.width * viewSize.width;
      const boxHeight = face.bounds.height * viewSize.height;

      paths.push(
        <Path
          key={`box-${faceIdx}`}
          d={`M ${boxX} ${boxY} L ${boxX + boxWidth} ${boxY} L ${boxX + boxWidth} ${boxY + boxHeight} L ${boxX} ${boxY + boxHeight} Z`}
          fill="none"
          stroke="#00FF00"
          strokeWidth="2"
        />
      );

      // Draw landmarks
      face.landmarks.forEach((landmark) => {
        const point = scalePoint(landmark.x, landmark.y);
        
        let color = '#00E0FF'; // Default blue
        let radius = 3;

        // Color code by type
        switch (landmark.type) {
          case 'leftEye':
          case 'rightEye':
            color = '#FF00FF'; // Magenta for eyes
            radius = 4;
            break;
          case 'noseBase':
            color = '#FFFF00'; // Yellow for nose
            radius = 5;
            break;
          case 'leftMouth':
          case 'rightMouth':
          case 'bottomMouth':
            color = '#FF6600'; // Orange for mouth
            radius = 4;
            break;
          case 'contour':
            color = '#00FF00'; // Green for contour
            radius = 2;
            break;
          default:
            color = '#00E0FF'; // Cyan for other landmarks
            radius = 3;
        }

        circles.push(
          <Circle
            key={`landmark-${circleKey++}`}
            cx={point.x}
            cy={point.y}
            r={radius}
            fill={color}
            stroke="#000"
            strokeWidth="0.5"
            opacity={0.9}
          />
        );
      });

      // Draw contour lines if we have enough contour points
      const contourPoints = face.landmarks.filter(l => l.type === 'contour');
      if (contourPoints.length > 2) {
        const contourPath = contourPoints
          .map((p, idx) => {
            const pt = scalePoint(p.x, p.y);
            return idx === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`;
          })
          .join(' ');
        
        paths.push(
          <Path
            key={`contour-${faceIdx}`}
            d={contourPath + ' Z'}
            fill="none"
            stroke="#00FF00"
            strokeWidth="2"
            opacity={0.6}
          />
        );
      }
    });

    return (
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width={viewSize.width}
        height={viewSize.height}
      >
        {paths}
        {circles}
      </Svg>
    );
  }, [detectedFaces, viewSize, scalePoint, flipX]);

  if (!device || !hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: themeColors.surface.primary }]}
          >
            <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            Face Landmarks
          </Text>
        </View>
        <View style={styles.fallback}>
          <Icon name="camera-alt" size={64} color={themeColors.text.secondary} />
          <Text style={[styles.fallbackText, { color: themeColors.text.secondary }]}>
            Camera permission required
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: themeColors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: themeColors.surface.primary }]}
        >
          <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>
          Face Landmarks
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View
        style={styles.cameraContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setViewSize({ width, height });
        }}
      >
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={isActive}
          photo={true}
        />
        {landmarksOverlay}
      </View>

      <ScrollView style={styles.infoContainer} contentContainerStyle={styles.infoContent}>
        <View style={[styles.infoCard, { backgroundColor: themeColors.surface.primary }]}>
          <View style={styles.infoRow}>
            <Icon name="face" size={20} color={themeColors.primary} />
            <Text style={[styles.infoLabel, { color: themeColors.text.secondary }]}>Faces:</Text>
            <Text style={[styles.infoValue, { color: themeColors.text.primary }]}>{faceCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="scatter-plot" size={20} color={themeColors.primary} />
            <Text style={[styles.infoLabel, { color: themeColors.text.secondary }]}>Landmarks:</Text>
            <Text style={[styles.infoValue, { color: themeColors.text.primary }]}>{landmarkCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="sync" size={20} color={isProcessing ? themeColors.primary : themeColors.text.secondary} />
            <Text style={[styles.infoLabel, { color: themeColors.text.secondary }]}>Status:</Text>
            <Text style={[styles.infoValue, { color: themeColors.text.primary }]}>
              {isProcessing ? 'Processing...' : 'Ready'}
            </Text>
          </View>
        </View>

        <View style={[styles.legendCard, { backgroundColor: themeColors.surface.primary }]}>
          <Text style={[styles.legendTitle, { color: themeColors.text.primary }]}>Legend</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF00FF' }]} />
            <Text style={[styles.legendText, { color: themeColors.text.secondary }]}>Eyes</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFFF00' }]} />
            <Text style={[styles.legendText, { color: themeColors.text.secondary }]}>Nose</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF6600' }]} />
            <Text style={[styles.legendText, { color: themeColors.text.secondary }]}>Mouth</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00FF00' }]} />
            <Text style={[styles.legendText, { color: themeColors.text.secondary }]}>Contour</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00E0FF' }]} />
            <Text style={[styles.legendText, { color: themeColors.text.secondary }]}>Other Landmarks</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  headerRight: {
    width: 40,
  },
  cameraContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
  },
  infoContent: {
    padding: 16,
    paddingBottom: 32,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  legendCard: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  fallbackText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FaceLandmarksScreen;

