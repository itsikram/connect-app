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
export const useBasicEmotionDetection = (profileId: string, friendId: string) => {
  const { settings } = useSettings();
  const [myEmotion, setMyEmotion] = useState<string | null>(null);
  const [friendEmotion, setFriendEmotion] = useState<string | null>(null);
  const { on, off, emit } = useSocket();

  // Listen for friend's emotion changes
  useEffect(() => {
    const handleEmotionChange = (data: any) => {
      if (data.profileId === friendId) {
        setFriendEmotion(data.emotion);
      }
    };

    on('emotion_change', handleEmotionChange);

    return () => {
      off('emotion_change', handleEmotionChange);
    };
  }, [friendId, on, off]);

  // Manual emotion update function
  const updateMyEmotion = (emotion: string, emoji: string, emotionText: string) => {
    if (settings.isShareEmotion && profileId && friendId) {
      const emotionData = {
        profileId,
        emotion: `${emoji} ${emotionText}`,
        emotionText,
        emoji,
        friendId,
        confidence: 1.0, // Manual selection has 100% confidence
        quality: 1.0
      };

      emit('emotion_change', emotionData);
      setMyEmotion(emotionData.emotion);
    }
  };

  return {
    myEmotion,
    friendEmotion,
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
export const useAutomatedEmotionDetection = (profileId: string, friendId: string) => {
  const { settings } = useSettings();
  const [friendEmotion, setFriendEmotion] = useState<string | null>(null);
  const { on, off } = useSocket();

  const {
    currentEmotion: myEmotion,
    isDetecting,
    startDetection,
    stopDetection,
  } = useEmotionDetection({
    profileId,
    friendId,
    isEnabled: settings.isShareEmotion || false,
    detectionInterval: 1500,
  });

  // Listen for friend's emotion changes
  useEffect(() => {
    const handleEmotionChange = (data: any) => {
      if (data.profileId === friendId) {
        setFriendEmotion(data.emotion);
      }
    };

    on('emotion_change', handleEmotionChange);

    return () => {
      off('emotion_change', handleEmotionChange);
    };
  }, [friendId, on, off]);

  return {
    myEmotion,
    friendEmotion,
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
  const friend = route.params.friend;
  const myProfile = useSelector((state: RootState) => state.profile);
  
  // Add emotion detection
  const {
    myEmotion,
    friendEmotion,
    updateMyEmotion,
    isEnabled
  } = useBasicEmotionDetection(myProfile?._id, friend?._id);

  return (
    <SafeAreaView>
      {/* Chat Header - Show friend's emotion *\/}
      <View style={styles.header}>
        <Text>{friend?.fullName}</Text>
        {isEnabled && friendEmotion && (
          <Text style={styles.emotion}>{friendEmotion}</Text>
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
 * 4. Friend's emotions display in real-time
 * 5. Settings control emotion sharing (isShareEmotion)
 * 
 * For automated detection with camera:
 * - Follow setup in EMOTION_DETECTION_GUIDE.md
 * - Use useAutomatedEmotionDetection hook
 * - Requires camera permissions and additional packages
 */

