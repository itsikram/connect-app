import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import config from '../lib/config';
import { useSocket } from '../contexts/SocketContext';

interface UseEmotionDetectionMediapipeOptions {
  profileId: string;
  connectId: string;
  isEnabled: boolean;
  detectionInterval?: number;
  sessionId?: string;
}

interface MediapipeEmotionResult {
  emotion: string | null;
  emotion_scores?: Record<string, number>;
  confidence?: number;
  dominant_state?: string | null;
  states?: any;
  error?: string;
}

export const useEmotionDetectionMediapipe = (options: UseEmotionDetectionMediapipeOptions) => {
  const { profileId, connectId, isEnabled, detectionInterval = 900, sessionId = 'rn' } = options;
  const { emit } = useSocket();

  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const inFlightRef = useRef<boolean>(false);

  const imageFileToBase64 = useCallback(async (uri: string): Promise<string | null> => {
    try {
      // RNFS can read file paths without the file:// prefix on Android
      const normalizedUri = Platform.OS === 'android' ? uri.replace('file://', '') : uri;
      const base64 = await RNFS.readFile(normalizedUri, 'base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (e) {
      console.warn('Failed to convert image to base64', e);
      return null;
    }
  }, []);

  const sendToMediapipe = useCallback(async (base64Image: string): Promise<MediapipeEmotionResult | null> => {
    try {
      const response = await fetch(`${config.MEDIAPIPE_BASE_URL}/emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, session_id: sessionId, use_custom_model: false })
      });
      const json = await response.json();
      return json as MediapipeEmotionResult;
    } catch (e) {
      console.warn('Failed to call MediaPipe server', e);
      return null;
    }
  }, [sessionId]);

  const processImagePath = useCallback(async (imagePath: string) => {
    if (inFlightRef.current || !isEnabled) return;
    inFlightRef.current = true;
    try {
      const base64 = await imageFileToBase64(imagePath);
      if (!base64) return;

      const result = await sendToMediapipe(base64);
      if (!result) return;

      const emotion = result.emotion ? result.emotion.toLowerCase() : null;
      const dominant = result.dominant_state || null;
      const label = emotion || dominant;

      if (label && profileId && connectId) {
        const emojiMap: Record<string, string> = {
          happy: '😊', smiling: '😄', laughing: '😂', excited: '🤩', surprised: '😲',
          fear: '😨', angry: '😠', sad: '😢', crying: '😭', disgust: '🤢', confused: '😕',
          neutral: '😐', winking: '😉', flirting: '😘', kissing: '💋', sarcastic: '😏',
          speaking: '🗣️', sleepy: '😴', yawn: '🥱', yawning: '🥱'
        };
        const emoji = emojiMap[label] || '😐';
        const composed = `${emoji} ${label.charAt(0).toUpperCase() + label.slice(1)}`;

        emit('emotion_change', {
          profileId,
          emotion: composed,
          emotionText: label,
          emoji,
          connectId,
          confidence: result.confidence || 0.6,
          quality: result.confidence || 0.6
        });
        setCurrentEmotion(composed);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [emit, connectId, imageFileToBase64, isEnabled, profileId, sendToMediapipe]);

  useEffect(() => {
    setIsDetecting(isEnabled);
    if (!isEnabled) setCurrentEmotion(null);
  }, [isEnabled]);

  return {
    currentEmotion,
    isDetecting,
    processImagePath,
  };
};

export default useEmotionDetectionMediapipe;


