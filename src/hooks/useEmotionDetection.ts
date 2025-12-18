import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
// FaceDetection removed - @react-native-ml-kit/face-detection uninstalled
import { Platform } from 'react-native';
import { 
  emotionEmojiMap, 
  getEmotionName, 
  emotionCategories,
  detectEmotionsFromFace,
  type EmotionDetectionState 
} from '../lib/emotionDetection';

interface EmotionDetectionOptions {
  profileId: string;
  friendId: string;
  isEnabled: boolean;
  detectionInterval?: number;
}

interface EmotionData {
  emotion: string;
  emoji: string;
  emotionText: string;
  confidence: number;
  quality: number;
}

/**
 * Custom hook for emotion detection using ML Kit Face Detection
 * Mirrors the sophisticated emotion detection from the web version with exact same logic
 */
export const useEmotionDetection = (options: EmotionDetectionOptions) => {
  const { profileId, friendId, isEnabled, detectionInterval = 900 } = options; // Faster base interval like web
  const { emit } = useSocket();
  
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  
  // Enhanced emotion detection state management (exact same as web version)
  const emotionHistoryRef = useRef<any[]>([]);
  const baselineExpressionsRef = useRef<any>({});
  const lastStableEmotionRef = useRef<string | null>(null);
  const emotionStabilityCountRef = useRef<number>(0);
  const detectionQualityRef = useRef<number>(0);
  const consecutiveEmotionCountRef = useRef<Record<string, number>>({});
  const lastEmotionTimestampRef = useRef<number>(Date.now());
  const actionLockRef = useRef<{ label: string | null; until: number }>({ label: null, until: 0 });
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameSkipCounterRef = useRef<number>(0);
  const lastActivityTimeRef = useRef<number>(Date.now());

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

  /**
   * Enhanced emotion detection with exact same logic as web version
   */
  const detectEmotion = useCallback(async (face: Face): Promise<EmotionData | null> => {
    try {
      // Use the enhanced detection function from our utility
      const detectionResult = await detectEmotionsFromFace(face, emotionDetectionState);
      
      if (!detectionResult || !detectionResult.topExpression) {
        return null;
      }

      // Use the topExpression directly from detection result (already selected with sophisticated logic)
      const { topExpression, validExpressions, detectionQuality, confidenceAnalysis } = detectionResult;
      const nowTs = Date.now();
      const lockActive = actionLockRef.current.until > nowTs;

      // Enhanced temporal smoothing with hysteresis (exact same as web)
      const confidenceLevel = topExpression.confidence;
      const currentEmotionName = getEmotionName(currentEmotion || '');

      // Update consecutive emotion count for hysteresis
      if (topExpression.name === lastStableEmotionRef.current) {
        consecutiveEmotionCountRef.current[topExpression.name] = 
          (consecutiveEmotionCountRef.current[topExpression.name] || 0) + 1;
      } else {
        // Decay counts for other emotions
        Object.keys(consecutiveEmotionCountRef.current).forEach(key => {
          if (key !== topExpression.name) {
            consecutiveEmotionCountRef.current[key] = 
              Math.max(0, (consecutiveEmotionCountRef.current[key] || 0) - 0.5);
          }
        });
        consecutiveEmotionCountRef.current[topExpression.name] = 1;
      }

      // Simple check: emit if emotion is different from current (exact same as web)
      const isDifferentFromCurrent = topExpression.name !== currentEmotionName;
      
      if (isDifferentFromCurrent) {
        const emotionName = topExpression.name;
        const confidence = topExpression.confidence;
        const emoji = emotionEmojiMap[emotionName] || '😐';

        // Update refs to track this emission
        lastEmotionTimestampRef.current = Date.now();
        lastStableEmotionRef.current = emotionName;

        // Enhanced debug logging (exact same as web)
        console.log('🎯 Emotion Change Detected:', {
          emotion: emotionName,
          emoji: emoji,
          confidence: confidence.toFixed(3),
          quality: detectionQuality.toFixed(3),
          consecutiveCount: consecutiveEmotionCountRef.current[emotionName] || 0,
          top3: validExpressions?.slice(0, 3).map((e: any) => `${e.name}:${e.confidence.toFixed(2)}`).join(', ') || 'N/A',
          reliability: confidenceAnalysis?.reliability || 'N/A'
        });

        return {
          emotion: `${emoji} ${emotionName}`,
          emoji,
          emotionText: emotionName,
          confidence: Math.round(confidence * 100) / 100,
          quality: Math.round(detectionQuality * 100) / 100
        };
      } else if (!lockActive && validExpressions && validExpressions.length === 0 && detectionQuality > 0.3) {
        // No valid expressions - check for neutral (exact same as web)
        const measurements = detectionResult.measurements;
        if (measurements) {
          const isNeutral = Math.abs(measurements.mouthCornerRaise) < 0.018 && 
                          measurements.avgEyeHeightNorm > 0.032 && 
                          measurements.avgEyeHeightNorm < 0.052 && 
                          measurements.mouthHeightNorm > 0.018 && 
                          measurements.mouthHeightNorm < 0.065 &&
                          Math.abs(measurements.eyebrowRaise) < 0.01;
          
          if (isNeutral && currentEmotionName !== 'Neutral') {
            // Need stability for neutral too
            if (lastStableEmotionRef.current === 'Neutral') {
              emotionStabilityCountRef.current++;
            } else {
              emotionStabilityCountRef.current = 1;
              lastStableEmotionRef.current = 'Neutral';
            }
            
            if (emotionStabilityCountRef.current >= 3) {
              const neutralEmoji = emotionEmojiMap['Neutral'];
              actionLockRef.current = { label: `${neutralEmoji} Neutral`, until: nowTs + 1800 };
              
              // Update refs
              lastEmotionTimestampRef.current = Date.now();
              lastStableEmotionRef.current = 'Neutral';
              emotionStabilityCountRef.current = 1;
              
              console.log('😐 Neutral detected with stability:', emotionStabilityCountRef.current);
              
              return {
                emotion: `${neutralEmoji} Neutral`,
                emoji: neutralEmoji,
                emotionText: 'Neutral',
                confidence: 0.6,
                quality: Math.round(detectionQuality * 100) / 100
              };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error detecting emotion:', error);
      return null;
    }
  }, [currentEmotion]);

  /**
   * Process face detection result - disabled (FaceDetection removed)
   */
  const processFaceDetection = useCallback(async (imagePath: string) => {
    // Face detection disabled - @react-native-ml-kit/face-detection uninstalled
    console.warn('Face detection disabled - FaceDetection package removed');
  }, []);

  /**
   * Start emotion detection with enhanced state management
   */
  const startDetection = useCallback(() => {
    if (!isEnabled || detectionIntervalRef.current) return;

    console.log('🎭 Starting enhanced emotion detection...');
    setIsDetecting(true);

    // Reset state for fresh start
    emotionHistoryRef.current = [];
    baselineExpressionsRef.current = {};
    lastStableEmotionRef.current = null;
    emotionStabilityCountRef.current = 0;
    detectionQualityRef.current = 0;
    consecutiveEmotionCountRef.current = {};
    lastEmotionTimestampRef.current = Date.now();
    actionLockRef.current = { label: null, until: 0 };
    frameSkipCounterRef.current = 0;
    lastActivityTimeRef.current = Date.now();

    // Note: The actual camera frame capture needs to be implemented
    // in the component using this hook. This hook provides the detection logic.
  }, [isEnabled]);

  /**
   * Stop emotion detection with full cleanup
   */
  const stopDetection = useCallback(() => {
    console.log('🎭 Stopping enhanced emotion detection...');
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    setIsDetecting(false);
    setCurrentEmotion(null);
    
    // Full state cleanup
    emotionHistoryRef.current = [];
    baselineExpressionsRef.current = {};
    lastStableEmotionRef.current = null;
    emotionStabilityCountRef.current = 0;
    detectionQualityRef.current = 0;
    consecutiveEmotionCountRef.current = {};
    lastEmotionTimestampRef.current = Date.now();
    actionLockRef.current = { label: null, until: 0 };
    frameSkipCounterRef.current = 0;
    lastActivityTimeRef.current = Date.now();
  }, []);

  /**
   * Auto-start/stop detection based on isEnabled
   */
  useEffect(() => {
    if (isEnabled) {
      startDetection();
    } else {
      stopDetection();
    }

    return () => {
      stopDetection();
    };
  }, [isEnabled, startDetection, stopDetection]);

  return {
    currentEmotion,
    isDetecting,
    startDetection,
    stopDetection,
    processFaceDetection,
  };
};

