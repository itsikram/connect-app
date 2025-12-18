import { Platform } from 'react-native';
// Face type removed - @react-native-ml-kit/face-detection uninstalled
type Face = any;

// Emotion to emoji mapping (exact same as web version)
export const emotionEmojiMap: Record<string, string> = {
  'Happy': '😊',
  'Smiling': '😄',
  'Laughing': '😂',
  'Excited': '🤩',
  'Surprised': '😲',
  'Fear': '😨',
  'Angry': '😠',
  'Sad': '😢',
  'Crying': '😭',
  'Disgust': '🤢',
  'Confused': '😕',
  'Neutral': '😐',
  'Winking': '😉',
  'Flirting': '😘',
  'Kissing': '💋',
  'Sarcastic': '😏',
  'Eyebrow Raise': '🤨',
  'Eyebrow Furrow': '😤',
  'Yawning': '🥱',
  'Sleepy': '😴',
  'Speaking': '🗣️'
};

// Helper function to extract emotion name from emoji string
export const getEmotionName = (emotionString: string): string => {
  if (!emotionString || typeof emotionString !== 'string') return '';
  return emotionString.replace(/😊|😄|😂|🤩|😲|😨|😠|😢|😭|🤢|😕|😐|😉|😘|💋|😏|🤨|😤|🥱|😴|🗣️/g, '').trim();
};

// Emotion category definitions for stability requirements
export const emotionCategories = {
  'transient': ['Speaking', 'Surprised', 'Eyebrow Raise'],
  'stable': ['Smiling', 'Happy', 'Neutral', 'Sleepy'],
  'significant': ['Sad', 'Angry', 'Disgust', 'Fear', 'Crying', 'Laughing'],
  'suspicious': ['Kissing', 'Winking', 'Flirting', 'Confused', 'Eyebrow Furrow']
};

// Calculate expression confidence based on conditions and weights
const calculateExpressionConfidence = (conditions: boolean[], weights: number[]): number => {
  const score = conditions.reduce((sum, condition, index) => {
    return sum + (condition ? weights[index] : 0);
  }, 0);
  return Math.min(1, score / weights.reduce((a, b) => a + b, 0));
};

// Enhanced emotion detection state management interface
export interface EmotionDetectionState {
  emotionHistoryRef: React.MutableRefObject<any[]>;
  baselineExpressionsRef: React.MutableRefObject<any>;
  lastStableEmotionRef: React.MutableRefObject<string | null>;
  emotionStabilityCountRef: React.MutableRefObject<number>;
  detectionQualityRef: React.MutableRefObject<number>;
  consecutiveEmotionCountRef: React.MutableRefObject<Record<string, number>>;
  lastEmotionTimestampRef: React.MutableRefObject<number>;
  actionLockRef: React.MutableRefObject<{ label: string | null; until: number }>;
}

// Extract facial landmarks from ML Kit face detection
const extractFacialLandmarks = (face: Face) => {
  try {
    const faceData = face as any;
    
    if (!faceData.landmarks || !faceData.contours) {
      return null;
    }

    const contours = faceData.contours;
    
    // Extract key facial features using string keys for contour types
    const leftEye = contours.LEFT_EYE || contours['LEFT_EYE'];
    const rightEye = contours.RIGHT_EYE || contours['RIGHT_EYE'];
    const upperLipTop = contours.UPPER_LIP_TOP || contours['UPPER_LIP_TOP'];
    const lowerLipBottom = contours.LOWER_LIP_BOTTOM || contours['LOWER_LIP_BOTTOM'];
    const leftCheek = contours.LEFT_CHEEK || contours['LEFT_CHEEK'];
    const rightCheek = contours.RIGHT_CHEEK || contours['RIGHT_CHEEK'];
    const leftEyebrowTop = contours.LEFT_EYEBROW_TOP || contours['LEFT_EYEBROW_TOP'];
    const rightEyebrowTop = contours.RIGHT_EYEBROW_TOP || contours['RIGHT_EYEBROW_TOP'];
    const leftEyebrowBottom = contours.LEFT_EYEBROW_BOTTOM || contours['LEFT_EYEBROW_BOTTOM'];
    const rightEyebrowBottom = contours['RIGHT_EYEBROW_BOTTOM'] || contours['RIGHT_EYEBROW_BOTTOM'];
    const noseTip = contours.NOSE_TIP || contours['NOSE_TIP'];
    const noseBottom = contours.NOSE_BOTTOM || contours['NOSE_BOTTOM'];

    if (!leftEye || !rightEye || !upperLipTop || !lowerLipBottom) {
      return null;
    }

    const faceBox = faceData.boundingBox || faceData.bounds || { width: 100, height: 100, top: 0, left: 0 };

    return {
      // Mouth landmarks
      mouth: {
        top: upperLipTop,
        bottom: lowerLipBottom,
        left: leftCheek,
        right: rightCheek,
        center: {
          x: (upperLipTop[0]?.x + lowerLipBottom[0]?.x) / 2,
          y: (upperLipTop[0]?.y + lowerLipBottom[0]?.y) / 2
        }
      },
      // Eye landmarks
      leftEye,
      rightEye,
      // Eyebrow landmarks
      leftEyebrow: {
        top: leftEyebrowTop,
        bottom: leftEyebrowBottom
      },
      rightEyebrow: {
        top: rightEyebrowTop,
        bottom: rightEyebrowBottom
      },
      // Nose landmarks
      nose: {
        tip: noseTip,
        bottom: noseBottom
      },
      faceBox,
      // ML Kit classifications
      mlKitData: {
        smilingProbability: faceData.smilingProbability || 0,
        leftEyeOpenProbability: faceData.leftEyeOpenProbability || 0.5,
        rightEyeOpenProbability: faceData.rightEyeOpenProbability || 0.5
      }
    };
  } catch (error) {
    console.error('Error extracting facial landmarks:', error);
    return null;
  }
};

// Calculate facial measurements for emotion detection
const calculateFacialMeasurements = (landmarks: any) => {
  if (!landmarks) return null;

  const { mouth, leftEye, rightEye, leftEyebrow, rightEyebrow, nose, faceBox, mlKitData } = landmarks;
  
  // Basic measurements
  const faceWidth = faceBox.width;
  const faceHeight = faceBox.height;
  
  // Mouth measurements
  const mouthHeight = Math.abs(mouth.top[0].y - mouth.bottom[0].y);
  const mouthWidth = mouth.left && mouth.right ? 
    Math.abs(mouth.left[0].x - mouth.right[0].x) : 
    faceWidth * 0.4;
  const mouthHeightNorm = mouthHeight / faceWidth;
  const mouthWidthNorm = mouthWidth / faceWidth;
  const mouthRatio = mouthHeight / mouthWidth;

  // Eye measurements
  const leftEyeHeight = leftEye.length > 1 ? 
    Math.abs(leftEye[1].y - (leftEye[5]?.y || leftEye[1].y)) : 0;
  const rightEyeHeight = rightEye.length > 1 ? 
    Math.abs(rightEye[1].y - (rightEye[5]?.y || rightEye[1].y)) : 0;
  const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
  const avgEyeHeightNorm = avgEyeHeight / faceWidth;
  const eyeOpennessDiff = Math.abs(leftEyeHeight - rightEyeHeight);

  // Mouth corner positions for smile detection
  const leftCornerY = mouth.left?.[0].y || mouth.center.y;
  const rightCornerY = mouth.right?.[0].y || mouth.center.y;
  const avgCornerY = (leftCornerY + rightCornerY) / 2;
  const mouthCornerRaise = (mouth.center.y - avgCornerY) / faceWidth;
  const leftCornerRaise = (mouth.center.y - leftCornerY) / faceWidth;
  const rightCornerRaise = (mouth.center.y - rightCornerY) / faceWidth;
  const mouthAsymmetry = Math.abs(leftCornerRaise - rightCornerRaise);

  // Eyebrow measurements
  const leftEyebrowTopY = leftEyebrow.top?.[2]?.y || 0;
  const rightEyebrowTopY = rightEyebrow.top?.[2]?.y || 0;
  const leftEyebrowBottomY = leftEyebrow.bottom?.[4]?.y || 0;
  const rightEyebrowBottomY = rightEyebrow.bottom?.[4]?.y || 0;
  const avgEyebrowTopY = (leftEyebrowTopY + rightEyebrowTopY) / 2;
  const avgEyebrowBottomY = (leftEyebrowBottomY + rightEyebrowBottomY) / 2;
  const eyebrowRaise = (avgEyebrowTopY - avgEyebrowBottomY) / faceWidth;
  const leftEyebrowRaise = (leftEyebrowTopY - leftEyebrowBottomY) / faceWidth;
  const rightEyebrowRaise = (rightEyebrowTopY - rightEyebrowBottomY) / faceWidth;
  const eyebrowAsymmetry = Math.abs(leftEyebrowRaise - rightEyebrowRaise);
  const eyebrowDistance = Math.abs(leftEyebrow.top?.[2]?.x - rightEyebrow.top?.[2]?.x) / faceWidth;

  // Nose measurements
  const noseWrinkle = nose.tip && nose.bottom ? 
    Math.abs(nose.tip[0].y - nose.bottom[0].y) / faceWidth : 0;

  return {
    // Basic measurements
    faceWidth,
    faceHeight,
    mouthHeight,
    mouthWidth,
    mouthHeightNorm,
    mouthWidthNorm,
    mouthRatio,
    
    // Eye measurements
    leftEyeHeight,
    rightEyeHeight,
    avgEyeHeight,
    avgEyeHeightNorm,
    eyeOpennessDiff,
    
    // Mouth measurements
    mouthCornerRaise,
    leftCornerRaise,
    rightCornerRaise,
    mouthAsymmetry,
    
    // Eyebrow measurements
    eyebrowRaise,
    leftEyebrowRaise,
    rightEyebrowRaise,
    eyebrowAsymmetry,
    eyebrowDistance,
    
    // Nose measurements
    noseWrinkle,
    
    // ML Kit data
    mlKitSmile: mlKitData.smilingProbability,
    mlKitLeftEyeOpen: mlKitData.leftEyeOpenProbability,
    mlKitRightEyeOpen: mlKitData.rightEyeOpenProbability
  };
};

// Create expression validator (exact same logic as web)
const createExpressionValidator = (
  emotions: any,
  detectionQualityRef: React.MutableRefObject<number>,
  emotionHistoryRef: React.MutableRefObject<any[]>
) => {
  return (name: string, confidence: number, measurements: any): boolean => {
    // Minimum thresholds - balanced for accuracy without over-filtering
    if (confidence < 0.32) return false; // Slightly increased for better accuracy
    if (detectionQualityRef.current < 0.30) return false; // Better quality threshold
    
    // Cross-validation with ML Kit emotions (if available)
    if (measurements?.mlKitSmile !== undefined) {
      // If ML Kit strongly disagrees, increase confidence requirement
      if (measurements.mlKitSmile > 0.80) {
        if (['Sad', 'Angry', 'Disgust', 'Crying', 'Fear'].includes(name)) {
          return confidence > 0.72; // Need very high confidence to override
        }
      } else if (measurements.mlKitSmile < 0.20) {
        if (['Happy', 'Smiling', 'Laughing', 'Excited'].includes(name)) {
          return confidence > 0.72;
        }
      }
    }
    
    // Enhanced specific expression validation
    const validations = measurements?.validations || {};
    if (validations[name]) {
      if (!validations[name]()) return false;
    }
    
    // Improved impossible combination checking with comprehensive rules (exact same as web)
    const incompatibleExpressions: Record<string, string[]> = {
      'Yawning': ['Speaking', 'Smiling', 'Laughing', 'Excited', 'Surprised', 'Fear'],
      'Speaking': ['Yawning', 'Sleepy', 'Crying'],
      'Laughing': ['Yawning', 'Sad', 'Angry', 'Fear', 'Crying', 'Sleepy', 'Disgust'],
      'Smiling': ['Yawning', 'Crying', 'Sleepy', 'Sad', 'Angry', 'Disgust', 'Fear'],
      'Happy': ['Sad', 'Angry', 'Crying', 'Disgust', 'Fear', 'Sleepy'],
      'Sad': ['Laughing', 'Smiling', 'Happy', 'Excited'],
      'Angry': ['Laughing', 'Smiling', 'Happy', 'Excited'],
      'Disgust': ['Laughing', 'Smiling', 'Happy', 'Excited'],
      'Crying': ['Happy', 'Laughing', 'Smiling', 'Excited', 'Yawning'],
      'Sleepy': ['Excited', 'Surprised', 'Laughing', 'Fear', 'Angry', 'Yawning'],
      'Excited': ['Sleepy', 'Sad', 'Angry', 'Crying', 'Yawning'],
      'Fear': ['Laughing', 'Happy', 'Excited', 'Sleepy', 'Yawning'],
      'Surprised': ['Sleepy', 'Yawning', 'Sad', 'Angry'],
      'Confused': ['Happy', 'Excited', 'Laughing', 'Sleepy'],
      'Winking': ['Sleepy', 'Crying', 'Sad'],
      'Flirting': ['Sad', 'Angry', 'Crying', 'Sleepy', 'Fear']
    };
    
    // Check for incompatible expressions in recent history (last 5 frames)
    if (incompatibleExpressions[name]) {
      const recentHistory = emotionHistoryRef.current.slice(-5);
      for (const impossible of incompatibleExpressions[name]) {
        const recentIncompatible = recentHistory.find(h => 
          h.emotion === impossible.toLowerCase() && h.confidence > 0.45
        );
        // Require higher confidence to switch between strongly incompatible emotions
        if (recentIncompatible) {
          const strongIncompatibility = ['Laughing', 'Sad', 'Happy', 'Angry', 'Crying', 'Excited'].includes(name) &&
                                       ['Laughing', 'Sad', 'Happy', 'Angry', 'Crying', 'Excited'].includes(impossible);
          const requiredConfidence = strongIncompatibility ? 0.68 : 0.60;
          if (confidence < requiredConfidence) {
            return false; // Need higher confidence to override recent history
          }
        }
      }
    }
    
    return true;
  };
};

// Main emotion detection function (exact same logic as web)
export const detectEmotionsFromFace = async (
  face: Face,
  state: EmotionDetectionState
): Promise<any> => {
  const {
    emotionHistoryRef,
    baselineExpressionsRef,
    lastStableEmotionRef,
    emotionStabilityCountRef,
    detectionQualityRef,
    consecutiveEmotionCountRef,
    lastEmotionTimestampRef,
    actionLockRef
  } = state;

  try {
    // Extract facial landmarks
    const landmarks = extractFacialLandmarks(face);
    if (!landmarks) return null;

    const measurements = calculateFacialMeasurements(landmarks);
    if (!measurements) return null;

    const { faceBox } = landmarks;
    const faceData = face as any;

    // Calculate detection quality
    const faceArea = faceBox ? faceBox.width * faceBox.height : 0;
    const videoArea = 640 * 480; // Standard camera resolution
    const faceSizeRatio = faceArea / videoArea;
    detectionQualityRef.current = Math.min(1, faceSizeRatio * 10);

    // Update emotion history with current detection
    const currentEmotionData = {
      emotion: 'neutral', // Will be updated with actual detection
      confidence: 0.5,
      timestamp: Date.now(),
      measurements
    };
    
    emotionHistoryRef.current.push(currentEmotionData);
    
    // Keep only last 50 detections for efficiency
    if (emotionHistoryRef.current.length > 50) {
      emotionHistoryRef.current.shift();
    }
    
    // Calculate baseline dynamically after collecting enough samples
    if (emotionHistoryRef.current.length === 15 || 
        (emotionHistoryRef.current.length === 30 && !baselineExpressionsRef.current.mouthHeight)) {
      
      const neutralSamples = emotionHistoryRef.current
        .filter(e => e.emotion === 'neutral' && e.confidence > 0.35)
        .slice(-8);
      
      if (neutralSamples.length >= 3) {
        const avgMouthHeight = neutralSamples.reduce((sum, s) => {
          return sum + (s.measurements?.mouthHeightNorm || 0.05) * measurements.faceWidth;
        }, 0) / neutralSamples.length;
        
        const avgEyeHeight = neutralSamples.reduce((sum, s) => {
          return sum + (s.measurements?.avgEyeHeightNorm || 0.04) * measurements.faceWidth;
        }, 0) / neutralSamples.length;
        
        const avgMouthWidth = neutralSamples.reduce((sum, s) => {
          return sum + (s.measurements?.mouthWidthNorm || 0.35) * measurements.faceWidth;
        }, 0) / neutralSamples.length;

        baselineExpressionsRef.current = {
          mouthHeight: avgMouthHeight,
          eyeHeight: avgEyeHeight,
          mouthWidth: avgMouthWidth,
          faceWidth: faceBox?.width || 100,
          established: true
        };
        
        console.log('✅ Baseline established:', {
          mouthHeight: avgMouthHeight.toFixed(3),
          eyeHeight: avgEyeHeight.toFixed(3),
          mouthWidth: avgMouthWidth.toFixed(3),
          faceWidth: (faceBox?.width || 100).toFixed(1)
        });
      }
    }

    // Get baseline for adaptive thresholds
    const baseline = baselineExpressionsRef.current;
    const hasBaseline = baseline.mouthHeight && baseline.eyeHeight;
    const mouthThresholdMultiplier = hasBaseline ? (baseline.mouthHeight / measurements.faceWidth) / 0.04 : 1;
    const eyeThresholdMultiplier = hasBaseline ? (baseline.eyeHeight / measurements.faceWidth) / 0.04 : 1;

    // Debounce action labels to reduce flicker
    const nowTs = Date.now();
    const lockActive = actionLockRef.current.until > nowTs;

    // Create validation functions for specific expressions (exact same as web version)
    const validations = {
      'Smiling': () => {
        const goodRaise = measurements.mouthCornerRaise > 0.022;
        const symmetrical = Math.abs(measurements.leftCornerRaise - measurements.rightCornerRaise) < 0.018;
        const notTooOpen = measurements.mouthHeightNorm < 0.085 * mouthThresholdMultiplier;
        const wideEnough = measurements.mouthWidthNorm > 0.36;
        const bothCornersUp = measurements.leftCornerRaise > 0.012 && measurements.rightCornerRaise > 0.012;
        return goodRaise && symmetrical && notTooOpen && wideEnough && bothCornersUp;
      },
      'Laughing': () => {
        const veryOpen = measurements.mouthHeightNorm > 0.10 * mouthThresholdMultiplier;
        const strongRaise = measurements.mouthCornerRaise > 0.030;
        const bothCornersHigh = measurements.leftCornerRaise > 0.015 && measurements.rightCornerRaise > 0.015;
        const veryWide = measurements.mouthWidthNorm > 0.50;
        const eyesEngaged = measurements.avgEyeHeightNorm > 0.040 * eyeThresholdMultiplier;
        return veryOpen && strongRaise && bothCornersHigh && veryWide && eyesEngaged;
      },
      'Speaking': () => {
        const goodOpening = measurements.mouthHeightNorm > 0.065 * mouthThresholdMultiplier && 
                          measurements.mouthHeightNorm < 0.14 * mouthThresholdMultiplier;
        const neutralCorners = Math.abs(measurements.mouthCornerRaise) < 0.025;
        const wideEnough = measurements.mouthWidthNorm > 0.30;
        const eyesOpen = measurements.avgEyeHeightNorm > 0.028 * eyeThresholdMultiplier;
        const notYawning = !(measurements.mouthHeightNorm > 0.11 * mouthThresholdMultiplier && 
                           measurements.avgEyeHeightNorm < 0.035 * eyeThresholdMultiplier);
        return goodOpening && neutralCorners && wideEnough && eyesOpen && notYawning;
      },
      'Sad': () => {
        const strongDroop = measurements.mouthCornerRaise < -0.022;
        const narrowedEyes = measurements.avgEyeHeightNorm < 0.036 * eyeThresholdMultiplier;
        const moderateOpening = measurements.mouthHeightNorm > 0.022 * mouthThresholdMultiplier && 
                              measurements.mouthHeightNorm < 0.068 * mouthThresholdMultiplier;
        const notSpeaking = !(measurements.mouthHeightNorm > 0.060 * mouthThresholdMultiplier && measurements.mouthWidthNorm > 0.34);
        const bothDown = measurements.leftCornerRaise < -0.008 && measurements.rightCornerRaise < -0.008;
        const symmetrical = Math.abs(measurements.leftCornerRaise - measurements.rightCornerRaise) < 0.018;
        const notSmiling = measurements.mouthCornerRaise < 0;
        return strongDroop && narrowedEyes && moderateOpening && notSpeaking && bothDown && symmetrical && notSmiling;
      },
      'Happy': () => {
        const goodRaise = measurements.mouthCornerRaise > 0.015;
        const wideSmile = measurements.mouthWidthNorm > 0.36;
        const openMouth = measurements.mouthHeightNorm > 0.030 * mouthThresholdMultiplier;
        const brightEyes = measurements.avgEyeHeightNorm > 0.036 * eyeThresholdMultiplier;
        const notTooOpen = measurements.mouthHeightNorm < 0.10 * mouthThresholdMultiplier;
        return goodRaise && wideSmile && openMouth && brightEyes && notTooOpen;
      },
      'Angry': () => {
        const squintedEyes = measurements.avgEyeHeightNorm < 0.032 * eyeThresholdMultiplier;
        const tightMouth = measurements.mouthHeightNorm < 0.038 * mouthThresholdMultiplier;
        const wideMouth = measurements.mouthWidthNorm > 0.38;
        const furrowedBrow = measurements.eyebrowRaise < -0.006;
        const notSmiling = measurements.mouthCornerRaise < 0.010;
        const eyebrowsTogether = measurements.eyebrowDistance < 0.32;
        return squintedEyes && tightMouth && wideMouth && furrowedBrow && notSmiling && eyebrowsTogether;
      },
      'Disgust': () => {
        const tightMouth = measurements.mouthHeightNorm < 0.032 * mouthThresholdMultiplier;
        const narrowMouth = measurements.mouthWidthNorm < 0.37;
        const squintedEyes = measurements.avgEyeHeightNorm < 0.039 * eyeThresholdMultiplier;
        const notSpeaking = !(measurements.mouthHeightNorm > 0.055 * mouthThresholdMultiplier && measurements.mouthWidthNorm > 0.32);
        const notSmiling = measurements.mouthCornerRaise <= 0.005;
        const noseWrinkled = measurements.noseWrinkle > 0.018;
        return tightMouth && narrowMouth && squintedEyes && notSpeaking && notSmiling;
      },
      'Crying': () => {
        const veryNarrowEyes = measurements.avgEyeHeightNorm < 0.028 * eyeThresholdMultiplier;
        const droopingMouth = measurements.mouthCornerRaise < -0.003;
        const moderateMouth = measurements.mouthHeightNorm < 0.065 * mouthThresholdMultiplier;
        const notSmiling = !(measurements.mouthCornerRaise > 0.005);
        const notLaughing = !(measurements.mouthHeightNorm > 0.10 * mouthThresholdMultiplier && measurements.mouthCornerRaise > 0.02);
        return veryNarrowEyes && droopingMouth && moderateMouth && notSmiling && notLaughing;
      },
      'Surprised': () => {
        const wideOpen = measurements.mouthHeightNorm > 0.075 * mouthThresholdMultiplier;
        const wideEyes = measurements.avgEyeHeightNorm > 0.047 * eyeThresholdMultiplier;
        const raisedBrows = measurements.eyebrowRaise > 0.013;
        const neutralCorners = Math.abs(measurements.mouthCornerRaise) < 0.022;
        return wideOpen && wideEyes && raisedBrows && neutralCorners;
      },
      'Fear': () => {
        const raisedBrows = measurements.eyebrowRaise > 0.018;
        const wideEyes = measurements.avgEyeHeightNorm > 0.048 * eyeThresholdMultiplier;
        const openMouth = measurements.mouthHeightNorm > 0.045 * mouthThresholdMultiplier;
        const notTooOpen = measurements.mouthHeightNorm < 0.085 * mouthThresholdMultiplier;
        const notSmiling = measurements.mouthCornerRaise < 0.015;
        return raisedBrows && wideEyes && openMouth && notTooOpen && notSmiling;
      },
      'Yawning': () => {
        const veryOpen = measurements.mouthHeightNorm > 0.115 * mouthThresholdMultiplier;
        const droopyEyes = measurements.avgEyeHeightNorm < 0.038 * eyeThresholdMultiplier;
        const neutralCorners = Math.abs(measurements.mouthCornerRaise) < 0.018;
        const wide = measurements.mouthWidthNorm > 0.38;
        const notLaughing = !(measurements.mouthCornerRaise > 0.025);
        return veryOpen && droopyEyes && neutralCorners && wide && notLaughing;
      },
      'Sleepy': () => {
        const veryNarrowEyes = measurements.avgEyeHeightNorm < 0.027 * eyeThresholdMultiplier;
        const closedMouth = measurements.mouthHeightNorm < 0.042 * mouthThresholdMultiplier;
        const relaxedCorners = Math.abs(measurements.mouthCornerRaise) < 0.012;
        const notWideOpen = !(measurements.mouthHeightNorm > 0.08 * mouthThresholdMultiplier);
        return veryNarrowEyes && closedMouth && relaxedCorners && notWideOpen;
      },
      'Excited': () => {
        const veryWideEyes = measurements.avgEyeHeightNorm > 0.048 * eyeThresholdMultiplier;
        const bigSmile = measurements.mouthCornerRaise > 0.025;
        const raisedBrows = measurements.eyebrowRaise > 0.012;
        const wideMouth = measurements.mouthWidthNorm > 0.38;
        const openMouth = measurements.mouthHeightNorm > 0.045 * mouthThresholdMultiplier;
        return veryWideEyes && bigSmile && raisedBrows && wideMouth && openMouth;
      },
      'Confused': () => {
        const asymmetricBrows = measurements.eyebrowAsymmetry > 0.016;
        const oneRaised = (measurements.leftEyebrowRaise > 0.010 || measurements.rightEyebrowRaise > 0.010);
        const openEyes = measurements.avgEyeHeightNorm > 0.032 * eyeThresholdMultiplier;
        const neutralMouth = Math.abs(measurements.mouthCornerRaise) < 0.020;
        const notWideOpen = measurements.mouthHeightNorm < 0.070 * mouthThresholdMultiplier;
        return asymmetricBrows && oneRaised && openEyes && neutralMouth && notWideOpen;
      },
      'Winking': () => {
        const bigDifference = measurements.eyeOpennessDiff > 0.023;
        const oneClosed = (measurements.leftEyeHeight < 0.022 * measurements.faceWidth || measurements.rightEyeHeight < 0.022 * measurements.faceWidth);
        const oneOpen = (measurements.leftEyeHeight > 0.020 * measurements.faceWidth || measurements.rightEyeHeight > 0.020 * measurements.faceWidth);
        const notBothClosed = !(measurements.leftEyeHeight < 0.025 * measurements.faceWidth && measurements.rightEyeHeight < 0.025 * measurements.faceWidth);
        return bigDifference && oneClosed && oneOpen && notBothClosed;
      },
      'Flirting': () => {
        const winking = measurements.eyeOpennessDiff > 0.023;
        const oneClosed = (measurements.leftEyeHeight < 0.022 * measurements.faceWidth || measurements.rightEyeHeight < 0.022 * measurements.faceWidth);
        const smiling = measurements.mouthCornerRaise > 0.012;
        const wideMouth = measurements.mouthWidthNorm > 0.34;
        const notFullSmile = measurements.mouthCornerRaise < 0.040;
        return winking && oneClosed && smiling && wideMouth && notFullSmile;
      },
      'Sarcastic': () => {
        const asymmetric = measurements.mouthAsymmetry > 0.022;
        const oneCornerUp = (measurements.leftCornerRaise > 0.018 || measurements.rightCornerRaise > 0.018);
        const notBothHigh = !(measurements.leftCornerRaise > 0.025 && measurements.rightCornerRaise > 0.025);
        const openEyes = measurements.avgEyeHeightNorm > 0.034 * eyeThresholdMultiplier;
        const wideMouth = measurements.mouthWidthNorm > 0.34;
        return asymmetric && oneCornerUp && notBothHigh && openEyes && wideMouth;
      },
      'Eyebrow Raise': () => {
        const highRaise = measurements.eyebrowRaise > 0.022;
        const wideEyes = measurements.avgEyeHeightNorm > 0.038 * eyeThresholdMultiplier;
        const notSurprised = !(measurements.mouthHeightNorm > 0.08 * mouthThresholdMultiplier);
        return highRaise && wideEyes && notSurprised;
      }
    };

    // Build expressions array (exact same as web version)
    const expressions = [
      {
        name: 'Speaking',
        confidence: calculateExpressionConfidence([
          measurements.mouthHeightNorm > 0.08 * mouthThresholdMultiplier,
          measurements.mouthHeightNorm < 0.15 * mouthThresholdMultiplier,
          measurements.mouthWidthNorm > 0.3,
          measurements.mouthWidthNorm < 0.5,
          Math.abs(measurements.mouthCornerRaise) < 0.02,
          measurements.avgEyeHeightNorm > 0.03 * eyeThresholdMultiplier,
          measurements.mouthRatio > 0.2 && measurements.mouthRatio < 0.4
        ], [0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05])
      },
      {
        name: 'Smiling',
        confidence: calculateExpressionConfidence([
          measurements.mouthCornerRaise > 0.025 || measurements.mlKitSmile > 0.7,
          measurements.mouthWidthNorm > 0.38,
          measurements.mouthHeightNorm > 0.03 * mouthThresholdMultiplier && measurements.mouthHeightNorm < 0.08 * mouthThresholdMultiplier,
          measurements.leftCornerRaise > 0.015 && measurements.rightCornerRaise > 0.015,
          measurements.avgEyeHeightNorm > 0.035 * eyeThresholdMultiplier,
          measurements.mouthRatio < 0.3,
          Math.abs(measurements.mouthAsymmetry) < 0.02
        ], [0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05])
      },
      {
        name: 'Laughing',
        confidence: calculateExpressionConfidence([
          measurements.mouthHeightNorm > 0.12 * mouthThresholdMultiplier,
          measurements.mouthWidthNorm > 0.55,
          measurements.mouthCornerRaise > 0.04 || measurements.mlKitSmile > 0.85,
          measurements.avgEyeHeightNorm > 0.045 * eyeThresholdMultiplier,
          measurements.eyebrowRaise > 0.008,
          measurements.mouthRatio > 0.15,
          measurements.leftCornerRaise > 0.02 && measurements.rightCornerRaise > 0.02
        ], [0.2, 0.15, 0.2, 0.15, 0.1, 0.1, 0.1])
      },
      {
        name: 'Kissing',
        confidence: calculateExpressionConfidence([
          measurements.mouthHeightNorm < 0.045 * mouthThresholdMultiplier,
          measurements.mouthWidthNorm < 0.40,
          measurements.mouthRatio < 0.22,
          measurements.mouthCornerRaise < 0.008,
          Math.abs(measurements.mouthCornerRaise) < 0.012,
          measurements.avgEyeHeightNorm > 0.032 * eyeThresholdMultiplier
        ], [0.28, 0.24, 0.2, 0.14, 0.08, 0.06])
      },
      {
        name: 'Excited',
        confidence: calculateExpressionConfidence([
          measurements.avgEyeHeightNorm > 0.05 * eyeThresholdMultiplier,
          measurements.mouthCornerRaise > 0.03,
          measurements.eyebrowRaise > 0.015,
          measurements.mouthWidthNorm > 0.4,
          measurements.mouthHeightNorm > 0.05 * mouthThresholdMultiplier
        ], [0.2, 0.25, 0.2, 0.2, 0.15])
      },
      {
        name: 'Sarcastic',
        confidence: calculateExpressionConfidence([
          measurements.mouthAsymmetry > 0.025,
          (measurements.leftCornerRaise > 0.02 || measurements.rightCornerRaise > 0.02),
          measurements.mouthWidthNorm > 0.35,
          measurements.avgEyeHeightNorm > 0.035 * eyeThresholdMultiplier,
          Math.abs(measurements.mouthCornerRaise) < 0.02
        ], [0.3, 0.25, 0.15, 0.15, 0.15])
      },
      {
        name: 'Confused',
        confidence: calculateExpressionConfidence([
          measurements.eyebrowAsymmetry > 0.018,
          (measurements.leftEyebrowRaise > 0.012 || measurements.rightEyebrowRaise > 0.012),
          measurements.avgEyeHeightNorm > 0.033 * eyeThresholdMultiplier,
          Math.abs(measurements.mouthCornerRaise) < 0.018,
          measurements.mouthHeightNorm < 0.065 * mouthThresholdMultiplier
        ], [0.32, 0.28, 0.18, 0.12, 0.1])
      },
      {
        name: 'Yawning',
        confidence: calculateExpressionConfidence([
          measurements.mouthHeightNorm > 0.12 * mouthThresholdMultiplier,
          measurements.mouthWidthNorm > 0.4,
          measurements.avgEyeHeightNorm < 0.035 * eyeThresholdMultiplier
        ], [0.5, 0.3, 0.2])
      },
      {
        name: 'Sleepy',
        confidence: calculateExpressionConfidence([
          measurements.avgEyeHeightNorm < 0.025 * eyeThresholdMultiplier,
          measurements.mouthHeightNorm < 0.04 * mouthThresholdMultiplier,
          Math.abs(measurements.mouthCornerRaise) < 0.01
        ], [0.5, 0.3, 0.2])
      },
      {
        name: 'Winking',
        confidence: calculateExpressionConfidence([
          measurements.eyeOpennessDiff > 0.025,
          (measurements.leftEyeHeight < 0.02 * measurements.faceWidth || measurements.rightEyeHeight < 0.02 * measurements.faceWidth),
          measurements.avgEyeHeightNorm > 0.025 * eyeThresholdMultiplier,
          Math.abs(measurements.mouthCornerRaise) < 0.015
        ], [0.4, 0.35, 0.15, 0.1])
      },
      {
        name: 'Flirting',
        confidence: calculateExpressionConfidence([
          measurements.eyeOpennessDiff > 0.025,
          (measurements.leftEyeHeight < 0.02 * measurements.faceWidth || measurements.rightEyeHeight < 0.02 * measurements.faceWidth),
          measurements.mouthCornerRaise > 0.015,
          measurements.mouthWidthNorm > 0.35,
          measurements.eyebrowRaise > 0.005
        ], [0.25, 0.25, 0.25, 0.15, 0.1])
      },
      {
        name: 'Eyebrow Raise',
        confidence: calculateExpressionConfidence([
          measurements.eyebrowRaise > 0.025,
          measurements.avgEyeHeightNorm > 0.04 * eyeThresholdMultiplier
        ], [0.7, 0.3])
      },
      {
        name: 'Eyebrow Furrow',
        confidence: calculateExpressionConfidence([
          measurements.eyebrowDistance < 0.25,
          measurements.eyebrowRaise < -0.01,
          measurements.avgEyeHeightNorm < 0.04 * eyeThresholdMultiplier
        ], [0.4, 0.4, 0.2])
      },
      {
        name: 'Surprised',
        confidence: calculateExpressionConfidence([
          measurements.mouthHeightNorm > 0.08 * mouthThresholdMultiplier,
          measurements.eyebrowRaise > 0.015,
          measurements.avgEyeHeightNorm > 0.05 * eyeThresholdMultiplier
        ], [0.4, 0.3, 0.3])
      },
      {
        name: 'Fear',
        confidence: calculateExpressionConfidence([
          measurements.eyebrowRaise > 0.02,
          measurements.avgEyeHeightNorm > 0.05 * eyeThresholdMultiplier,
          measurements.mouthHeightNorm > 0.05 * mouthThresholdMultiplier,
          measurements.mouthHeightNorm < 0.08 * mouthThresholdMultiplier
        ], [0.3, 0.3, 0.2, 0.2])
      },
      {
        name: 'Disgust',
        confidence: calculateExpressionConfidence([
          measurements.mouthHeightNorm < 0.03 * mouthThresholdMultiplier,
          measurements.mouthWidthNorm < 0.36,
          measurements.avgEyeHeightNorm < 0.038 * eyeThresholdMultiplier,
          measurements.noseWrinkle > 0.02,
          measurements.mouthCornerRaise <= 0.003,
          measurements.eyebrowRaise < -0.005
        ], [0.25, 0.2, 0.2, 0.15, 0.1, 0.1])
      },
      {
        name: 'Happy',
        confidence: calculateExpressionConfidence([
          measurements.mouthCornerRaise > 0.018 || measurements.mlKitSmile > 0.6,
          measurements.mouthWidthNorm > 0.34,
          measurements.mouthHeightNorm > 0.035 * mouthThresholdMultiplier,
          measurements.avgEyeHeightNorm > 0.038 * eyeThresholdMultiplier,
          measurements.mouthRatio < 0.32
        ], [0.25, 0.2, 0.25, 0.2, 0.1])
      },
      {
        name: 'Angry',
        confidence: calculateExpressionConfidence([
          measurements.avgEyeHeightNorm < 0.03 * eyeThresholdMultiplier,
          measurements.mouthHeightNorm < 0.035 * mouthThresholdMultiplier,
          measurements.mouthWidthNorm > 0.4,
          measurements.mouthRatio < 0.18,
          measurements.eyebrowRaise < -0.008,
          measurements.eyebrowDistance < 0.3
        ], [0.2, 0.2, 0.15, 0.15, 0.15, 0.15])
      },
      {
        name: 'Sad',
        confidence: calculateExpressionConfidence([
          measurements.mouthCornerRaise < -0.028,
          measurements.avgEyeHeightNorm < 0.033 * eyeThresholdMultiplier,
          measurements.mouthHeightNorm > 0.028 * mouthThresholdMultiplier,
          measurements.mouthHeightNorm < 0.062 * mouthThresholdMultiplier,
          measurements.eyebrowRaise < -0.008,
          measurements.mouthWidthNorm < 0.37,
          measurements.leftCornerRaise < -0.012 && measurements.rightCornerRaise < -0.012,
          Math.abs(measurements.mouthAsymmetry) < 0.012
        ], [0.25, 0.2, 0.15, 0.1, 0.1, 0.1, 0.05, 0.05])
      },
      {
        name: 'Crying',
        confidence: calculateExpressionConfidence([
          measurements.avgEyeHeightNorm < 0.03 * eyeThresholdMultiplier,
          measurements.mouthHeightNorm < 0.06 * mouthThresholdMultiplier,
          measurements.mouthRatio < 0.3,
          measurements.mouthCornerRaise < -0.005
        ], [0.3, 0.3, 0.2, 0.2])
      }
    ];

    // Create validator
    const validateExpression = createExpressionValidator({}, detectionQualityRef, emotionHistoryRef);

    // Apply quality multiplier and validation
    const expressionsWithValidation = expressions.map(expr => {
      const qualityFactor = Math.max(0.5, detectionQualityRef.current);
      const adjustedConfidence = expr.confidence * qualityFactor;
      
      const isValid = validateExpression(expr.name, adjustedConfidence, { validations, ...measurements });
      
      const consecutiveCount = consecutiveEmotionCountRef.current[expr.name] || 0;
      const finalConfidence = consecutiveCount > 2 ? adjustedConfidence * 1.1 : adjustedConfidence; // 10% boost for consistent detections
      
      return {
        ...expr,
        confidence: finalConfidence,
        isValid
      };
    });

    const validExpressions = expressionsWithValidation.filter((expr: any) => expr.isValid);
    validExpressions.sort((a: any, b: any) => b.confidence - a.confidence);

    // Debug logging (10% of the time)
    if (Math.random() < 0.1 && validExpressions.length > 0) {
      console.log('📊 Detection Status:', {
        validExpressions: validExpressions.length,
        top3: validExpressions.slice(0, 3).map((e: any) => `${e.name}:${e.confidence.toFixed(2)}`),
        quality: detectionQualityRef.current.toFixed(3),
        lastStable: lastStableEmotionRef.current,
        stability: emotionStabilityCountRef.current
      });
    }

    // Confidence analysis helper function (exact same as web)
    const analyzeConfidence = (expressions: any[]) => {
      if (expressions.length === 0) return null;
      
      const top = expressions[0];
      const second = expressions[1];
      const third = expressions[2];
      
      return {
        topConfidence: top.confidence,
        confidenceGap: second ? top.confidence - second.confidence : top.confidence,
        top3Spread: third ? top.confidence - third.confidence : top.confidence,
        reliability: top.confidence > 0.8 ? 'Very High' :
                   top.confidence > 0.7 ? 'High' :
                   top.confidence > 0.6 ? 'Medium' :
                   top.confidence > 0.4 ? 'Low' : 'Very Low',
        competition: second && (top.confidence - second.confidence) < 0.05 ? 'High' :
                   second && (top.confidence - second.confidence) < 0.1 ? 'Medium' : 'Low'
      };
    };
    
    const confidenceAnalysis = analyzeConfidence(validExpressions);
    
    // Dynamic confidence thresholds based on detection quality (exact same as web)
    const baseConfidenceThreshold = 0.50; // Balanced threshold
    const qualityMultiplier = detectionQualityRef.current;
    const dynamicThreshold = Math.max(0.32, baseConfidenceThreshold * qualityMultiplier); // Balanced minimum
    
    // Get top expressions with significant confidence gaps
    const topExpressions = validExpressions.slice(0, 3); // Top 3 expressions
    const confidenceGap = topExpressions.length > 1 ? 
        topExpressions[0].confidence - topExpressions[1].confidence : 0;
    
    // Select the best expression based on confidence and gap (exact same as web)
    let selectedExpression = null;
    
    if (topExpressions.length > 0) {
      const topConfidence = topExpressions[0].confidence;
      
      // High confidence with significant gap - very reliable
      if (topConfidence > 0.8 && confidenceGap > 0.15) {
        selectedExpression = topExpressions[0];
      }
      // Good confidence with moderate gap - reliable
      else if (topConfidence > 0.7 && confidenceGap > 0.1) {
        selectedExpression = topExpressions[0];
      }
      // Decent confidence with small gap - acceptable
      else if (topConfidence > dynamicThreshold && confidenceGap > 0.05) {
        selectedExpression = topExpressions[0];
      }
      // Multiple similar confidence - be more conservative
      else if (topConfidence > dynamicThreshold && confidenceGap <= 0.05) {
        // If current emotion is in top 3, maintain it unless confidence is much higher
        const currentEmotionName = lastStableEmotionRef.current;
        const currentInTop3 = topExpressions.find((expr: any) => 
          expr.name === currentEmotionName
        );
        
        if (currentInTop3 && topConfidence - currentInTop3.confidence < 0.1) {
          // Maintain current emotion if it's still competitive
          selectedExpression = currentInTop3;
        } else {
          selectedExpression = topExpressions[0];
        }
      }
    }
    
    // Fallback to neutral if no expression meets criteria
    const topExpression = selectedExpression || {
      name: 'Neutral',
      confidence: 0.5
    };

    return {
      topExpression,
      validExpressions,
      detectionQuality: detectionQualityRef.current,
      faceBox,
      measurements,
      confidenceAnalysis
    };

  } catch (error) {
    console.error('Error in emotion detection:', error);
    return null;
  }
};


