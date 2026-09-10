import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { useSocket } from '../contexts/SocketContext';
import { emotionEmojiMap, getEmotionName } from '../lib/emotionDetection';

/**
 * Emotion Detection Test Component
 * Use this to test and validate the emotion detection functionality
 */
const EmotionDetectionTest: React.FC = () => {
  const profile = useSelector((state: any) => state.profile);
  const settings = useSelector((state: any) => state.setting);
  const { emit, on } = useSocket();

  const [myEmotion, setMyEmotion] = useState<string | null>(null);
  const [connectEmotion, setConnectEmotion] = useState<string | null>(null);
  const [testConnectId] = useState('test-connect-123'); // Test connect ID
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if emotion sharing is enabled
  useEffect(() => {
    setIsEnabled(settings.isShareEmotion === true);
  }, [settings.isShareEmotion]);

  // Listen for emotion changes
  useEffect(() => {
    const handleEmotionChange = (data: any) => {
      console.log('🎭 Test - Received emotion change:', data);
      
      if (data && data.emotion) {
        if (data.profileId === testConnectId) {
          setConnectEmotion(data.emotion);
          console.log('🎭 Test - Connect emotion updated:', data.emotion);
        } else if (data.profileId === profile._id) {
          setMyEmotion(data.emotion);
          console.log('🎭 Test - My emotion updated:', data.emotion);
        }
      }
    };

    on('emotion_change', handleEmotionChange);

    return () => {
      // Cleanup handled by socket context
    };
  }, [on, testConnectId, profile._id]);

  // Test manual emotion emission
  const testEmotionEmission = (emotionText: string) => {
    if (!isEnabled) {
      Alert.alert('Emotion Detection Disabled', 'Please enable emotion sharing in settings first.');
      return;
    }

    const emoji = emotionEmojiMap[emotionText] || '😐';
    const emotionData = {
      profileId: profile._id,
      emotion: `${emoji} ${emotionText}`,
      emotionText,
      emoji,
      connectId: testConnectId,
      confidence: 0.95, // High confidence for manual test
      quality: 0.9
    };

    console.log('🎭 Test - Emitting emotion:', emotionData);
    emit('emotion_change', emotionData);
    setMyEmotion(emotionData.emotion);
  };

  // Test emotion name extraction
  const testEmotionNameExtraction = () => {
    const testEmotions = [
      '😊 Happy',
      '😄 Smiling',
      '😂 Laughing',
      '🗣️ Speaking',
      '😐 Neutral'
    ];

    console.log('🧪 Testing emotion name extraction:');
    testEmotions.forEach(emotion => {
      const extracted = getEmotionName(emotion);
      console.log(`  "${emotion}" -> "${extracted}"`);
    });
  };

  // Test all emotion types
  const testAllEmotions = () => {
    console.log('🧪 Testing all emotion types:');
    Object.keys(emotionEmojiMap).forEach(emotionText => {
      console.log(`  ${emotionEmojiMap[emotionText]} ${emotionText}`);
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎭 Emotion Detection Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isEnabled ? '✅ Enabled' : '❌ Disabled'}
        </Text>
        <Text style={styles.statusText}>
          Profile ID: {profile._id || 'Not available'}
        </Text>
      </View>

      <View style={styles.emotionContainer}>
        <Text style={styles.sectionTitle}>My Emotion</Text>
        <Text style={styles.emotionText}>
          {myEmotion || 'None detected'}
        </Text>
      </View>

      <View style={styles.emotionContainer}>
        <Text style={styles.sectionTitle}>Connect's Emotion</Text>
        <Text style={styles.emotionText}>
          {connectEmotion || 'None received'}
        </Text>
      </View>

      <View style={styles.testContainer}>
        <Text style={styles.sectionTitle}>Test Emotions</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={() => testEmotionEmission('Happy')}
          >
            <Text style={styles.buttonText}>😊 Happy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={() => testEmotionEmission('Smiling')}
          >
            <Text style={styles.buttonText}>😄 Smiling</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={() => testEmotionEmission('Speaking')}
          >
            <Text style={styles.buttonText}>🗣️ Speaking</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={() => testEmotionEmission('Neutral')}
          >
            <Text style={styles.buttonText}>😐 Neutral</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={() => testEmotionEmission('Surprised')}
          >
            <Text style={styles.buttonText}>😲 Surprised</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={() => testEmotionEmission('Confused')}
          >
            <Text style={styles.buttonText}>😕 Confused</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.debugContainer}>
        <Text style={styles.sectionTitle}>Debug Tests</Text>
        
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={testEmotionNameExtraction}
        >
          <Text style={styles.debugButtonText}>Test Name Extraction</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={testAllEmotions}
        >
          <Text style={styles.debugButtonText}>Log All Emotions</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instructions}>
        💡 Instructions:{'\n'}
        1. Enable emotion sharing in settings{'\n'}
        2. Tap emotion buttons to test emission{'\n'}
        3. Check console logs for debug info{'\n'}
        4. Use in a chat screen with a real connect ID
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  emotionContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  emotionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
  testContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  debugContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugButton: {
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructions: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});

export default EmotionDetectionTest;

