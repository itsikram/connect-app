import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import FaceDetection from '@react-native-ml-kit/face-detection';
import type { Face } from '@react-native-ml-kit/face-detection';
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
      
      if (!detectionResult || !detectionResult.validExpressions || detectionResult.validExpressions.length === 0) {
        return null;
      }

      const { validExpressions, detectionQuality, measurements } = detectionResult;
      const nowTs = Date.now();
      const lockActive = actionLockRef.current.until > nowTs;

      // Dynamic confidence thresholds based on detection quality
      const baseConfidenceThreshold = 0.50;
      const qualityMultiplier = detectionQuality;
      const dynamicThreshold = Math.max(0.32, baseConfidenceThreshold * qualityMultiplier);

      // Get top expressions with significant confidence gaps
      const topExpressions = validExpressions.slice(0, 3);
      const confidenceGap = topExpressions.length > 1 ? 
        topExpressions[0].confidence - topExpressions[1].confidence : 0;

      // Select the best expression based on confidence and gap
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
          const currentEmotionName = getEmotionName(currentEmotion || '');
          const currentInTop3 = topExpressions.find((expr: any) => 
            expr.name === currentEmotionName
          );
          
          if (currentInTop3 && topConfidence - currentInTop3.confidence < 0.1) {
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

      // Enhanced temporal smoothing with hysteresis
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

      // Adaptive stability requirement based on confidence and emotion type
      let stabilityRequirement = 2;
      if (emotionCategories.transient.includes(topExpression.name)) {
        stabilityRequirement = confidenceLevel > 0.8 ? 1 : confidenceLevel > 0.65 ? 2 : 3;
      } else if (emotionCategories.stable.includes(topExpression.name)) {
        stabilityRequirement = confidenceLevel > 0.8 ? 2 : confidenceLevel > 0.65 ? 2 : 3;
      } else if (emotionCategories.significant.includes(topExpression.name)) {
        stabilityRequirement = confidenceLevel > 0.8 ? 2 : confidenceLevel > 0.65 ? 3 : 4;
      } else if (emotionCategories.suspicious.includes(topExpression.name)) {
        stabilityRequirement = confidenceLevel > 0.8 ? 3 : confidenceLevel > 0.65 ? 4 : 5;
      }

      // Track stability
      if (confidenceLevel > dynamicThreshold) {
        if (lastStableEmotionRef.current === topExpression.name) {
          emotionStabilityCountRef.current++;
        } else {
          emotionStabilityCountRef.current = 1;
        }
      } else {
        emotionStabilityCountRef.current = Math.max(0, emotionStabilityCountRef.current - 0.5);
      }

      // Hysteresis: make it harder to switch away from current emotion
      const isSwitchingEmotion = topExpression.name !== currentEmotionName;
      const effectiveStability = isSwitchingEmotion ? stabilityRequirement : Math.max(1, stabilityRequirement - 1);

      // Enhanced emotion change decision
      const isDifferentFromCurrent = topExpression.name !== currentEmotionName;
      
      const shouldEmitEmotion = emotionStabilityCountRef.current >= effectiveStability && 
                               confidenceLevel > dynamicThreshold &&
                               isDifferentFromCurrent;

      // Only emit if we haven't already emitted this exact emotion recently
      const minTimeBetweenSameEmotion = 3000;
      const isSameAsLastEmitted = lastStableEmotionRef.current === topExpression.name;
      const timeSinceLastChange = Date.now() - lastEmotionTimestampRef.current;
      const canReEmitSameEmotion = !isSameAsLastEmitted || timeSinceLastChange > minTimeBetweenSameEmotion;

      if (shouldEmitEmotion && !lockActive && canReEmitSameEmotion) {
        const emotionName = topExpression.name;
        const confidence = topExpression.confidence;
        const emoji = emotionEmojiMap[emotionName] || '😐';

        // Set lock duration based on emotion type and confidence
        const lockDuration = confidence > 0.8 ? 1500 : 1200;
        actionLockRef.current = { label: `${emoji} ${emotionName}`, until: nowTs + lockDuration };

        // Update refs to track this emission
        lastActivityTimeRef.current = Date.now();
        lastEmotionTimestampRef.current = Date.now();
        lastStableEmotionRef.current = emotionName;
        emotionStabilityCountRef.current = 1;

        console.log('🎯 Emotion Change Detected:', {
          emotion: emotionName,
          emoji: emoji,
          confidence: confidence.toFixed(3),
          quality: detectionQuality.toFixed(3),
          stability: emotionStabilityCountRef.current,
          stabilityReq: effectiveStability,
          consecutiveCount: consecutiveEmotionCountRef.current[emotionName] || 0,
          threshold: dynamicThreshold.toFixed(3),
          top3: validExpressions.slice(0, 3).map((e: any) => `${e.name}:${e.confidence.toFixed(2)}`),
          confidenceGap: confidenceGap.toFixed(3),
          wasSmoothed: isSwitchingEmotion,
          timeSinceLastChange: timeSinceLastChange
        });

        return {
          emotion: `${emoji} ${emotionName}`,
          emoji,
          emotionText: emotionName,
          confidence: Math.round(confidence * 100) / 100,
          quality: Math.round(detectionQuality * 100) / 100
        };
      } else if (!lockActive && validExpressions.length === 0 && detectionQuality > 0.3) {
        // No valid expressions - check for neutral
        const isNeutral = Math.abs(measurements.mouthCornerRaise) < 0.018 && 
                        measurements.avgEyeHeightNorm > 0.032 && 
                        measurements.avgEyeHeightNorm < 0.052 && 
                        measurements.mouthHeightNorm > 0.018 && 
                        measurements.mouthHeightNorm < 0.065 &&
                        Math.abs(measurements.eyebrowRaise) < 0.01;
        
        if (isNeutral && currentEmotionName !== 'Neutral') {
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

      return null;
    } catch (error) {
      console.error('Error detecting emotion:', error);
      return null;
    }
  }, [currentEmotion]);

  /**
   * Process face detection result with enhanced logic
   */
  const processFaceDetection = useCallback(async (imagePath: string) => {
    try {
      const faces = await FaceDetection.detect(imagePath, {
        landmarkMode: 'all',
        contourMode: 'all',
        classificationMode: 'all',
      } as any);

      if (faces.length > 0) {
        const face = faces[0];
        const emotionData = await detectEmotion(face);
        
        if (emotionData && profileId && friendId) {
          // Emit emotion to server with enhanced data
          emit('emotion_change', {
            profileId,
            emotion: emotionData.emotion,
            emotionText: emotionData.emotionText,
            emoji: emotionData.emoji,
            friendId,
            confidence: emotionData.confidence,
            quality: emotionData.quality
          });

          // Update local state
          setCurrentEmotion(emotionData.emotion);
        }
      }
    } catch (error) {
      console.error('Error processing face detection:', error);
    }
  }, [detectEmotion, emit, profileId, friendId]);

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

