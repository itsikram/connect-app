/**
 * Emotion Detection Integration Example
 * 
 * This file shows how to integrate emotion detection into your chat screens.
 * Copy this code into your SingleMessage.tsx or similar components.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useSettings } from '../contexts/SettingsContext';
import { useEmotionDetection } from '../hooks/useEmotionDetection';

/**
 * Example 1: Basic Integration (No Camera Required)
 * 
 * This approach uses a simpler emotion detection that doesn't require
 * continuous camera access. It can work with periodic snapshots or
 * manual emotion selection.
 */
export const useBasicEmotionDetection = (profileId: string, connectId: string) => {
  const { settings } = useSettings();
  const [myEmotion, setMyEmotion] = useState<string | null>(null);
  const [connectEmotion, setConnectEmotion] = useState<string | null>(null);
  const { on, off, emit } = useSocket();

  // Listen for connect's emotion changes
  useEffect(() => {
    const handleEmotionChange = (data: any) => {
      if (data.profileId === connectId) {
        setConnectEmotion(data.emotion);
      }
    };

    on('emotion_change', handleEmotionChange);

    return () => {
      off('emotion_change', handleEmotionChange);
    };
  }, [connectId, on, off]);

  // Manual emotion update function
  const updateMyEmotion = (emotion: string, emoji: string, emotionText: string) => {
    if (settings.isShareEmotion && profileId && connectId) {
      const emotionData = {
        profileId,
        emotion: `${emoji} ${emotionText}`,
        emotionText,
        emoji,
        connectId,
        confidence: 1.0, // Manual selection has 100% confidence
        quality: 1.0
      };

      emit('emotion_change', emotionData);
      setMyEmotion(emotionData.emotion);
    }
  };

  return {
    myEmotion,
    connectEmotion,
    updateMyEmotion,
    isEnabled: settings.isShareEmotion
  };
};

/**
 * Example 2: Full Automated Detection (Requires Camera)
 * 
 * This approach uses the full emotion detection system with camera.
 * Requires additional setup - see EMOTION_DETECTION_GUIDE.md
 */
export const useAutomatedEmotionDetection = (profileId: string, connectId: string) => {
  const { settings } = useSettings();
  const [connectEmotion, setConnectEmotion] = useState<string | null>(null);
  const { on, off } = useSocket();

  const {
    currentEmotion: myEmotion,
    isDetecting,
    startDetection,
    stopDetection,
  } = useEmotionDetection({
    profileId,
    connectId,
    isEnabled: settings.isShareEmotion || false,
    detectionInterval: 1500,
  });

  // Listen for connect's emotion changes
  useEffect(() => {
    const handleEmotionChange = (data: any) => {
      if (data.profileId === connectId) {
        setConnectEmotion(data.emotion);
      }
    };

    on('emotion_change', handleEmotionChange);

    return () => {
      off('emotion_change', handleEmotionChange);
    };
  }, [connectId, on, off]);

  return {
    myEmotion,
    connectEmotion,
    isDetecting,
    startDetection,
    stopDetection,
    isEnabled: settings.isShareEmotion
  };
};

/**
 * Example 3: Emotion Display Component
 * 
 * Shows how to display emotions in your UI
 */
interface EmotionDisplayProps {
  emotion: string | null;
  label: string;
}

export const EmotionDisplay: React.FC<EmotionDisplayProps> = ({ emotion, label }) => {
  if (!emotion) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      color: '#666'
    }}>
      <span>{label}:</span>
      <span>{emotion}</span>
    </div>
  );
};

/**
 * Example 4: Integration in SingleMessage Component
 * 
 * Add this to your SingleMessage.tsx:
 */
/*

import { useBasicEmotionDetection } from '../components/EmotionDetectionIntegration';

const SingleMessage = () => {
  const route = useRoute();
  const connect = route.params.connect;
  const myProfile = useSelector((state: RootState) => state.profile);
  
  // Add emotion detection
  const {
    myEmotion,
    connectEmotion,
    updateMyEmotion,
    isEnabled
  } = useBasicEmotionDetection(myProfile?._id, connect?._id);

  return (
    <SafeAreaView>
      {/* Chat Header - Show connect's emotion *\/}
      <View style={styles.header}>
        <Text>{connect?.fullName}</Text>
        {isEnabled && connectEmotion && (
          <Text style={styles.emotion}>{connectEmotion}</Text>
        )}
      </View>

      {/* Chat Messages *\/}
      <FlatList ... />

      {/* Optional: Emotion picker for manual selection *\/}
      {isEnabled && (
        <EmotionPicker
          onSelectEmotion={(emoji, text) => updateMyEmotion(`${emoji} ${text}`, emoji, text)}
        />
      )}
    </SafeAreaView>
  );
};

*/

/**
 * Example 5: Emotion Picker Component (Optional)
 * 
 * Manual emotion selection UI
 */
interface EmotionOption {
  emoji: string;
  text: string;
  label: string;
}

const emotionOptions: EmotionOption[] = [
  { emoji: '😊', text: 'Happy', label: 'Happy' },
  { emoji: '😄', text: 'Smiling', label: 'Smiling' },
  { emoji: '😂', text: 'Laughing', label: 'Laughing' },
  { emoji: '😲', text: 'Surprised', label: 'Surprised' },
  { emoji: '😕', text: 'Confused', label: 'Confused' },
  { emoji: '😐', text: 'Neutral', label: 'Neutral' },
  { emoji: '🗣️', text: 'Speaking', label: 'Speaking' },
  { emoji: '😉', text: 'Winking', label: 'Winking' },
];

interface EmotionPickerProps {
  onSelectEmotion: (emoji: string, text: string) => void;
}

export const EmotionPicker: React.FC<EmotionPickerProps> = ({ onSelectEmotion }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <button onClick={() => setIsVisible(!isVisible)}>
        😊 Select Emotion
      </button>
      
      {isVisible && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          padding: 8,
          backgroundColor: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {emotionOptions.map((option) => (
            <button
              key={option.text}
              onClick={() => {
                onSelectEmotion(option.emoji, option.text);
                setIsVisible(false);
              }}
              style={{
                padding: 8,
                border: '1px solid #ddd',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 24 }}>{option.emoji}</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>{option.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Usage Notes:
 * 
 * 1. Start with useBasicEmotionDetection - no camera required
 * 2. Users can manually select emotions via EmotionPicker
 * 3. Emotions are shared via Socket.IO automatically
 * 4. Connect's emotions display in real-time
 * 5. Settings control emotion sharing (isShareEmotion)
 * 
 * For automated detection with camera:
 * - Follow setup in EMOTION_DETECTION_GUIDE.md
 * - Use useAutomatedEmotionDetection hook
 * - Requires camera permissions and additional packages
 */

