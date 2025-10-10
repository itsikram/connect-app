# Emotion Detection Implementation Guide

This guide explains how to implement emotion detection in your React Native app, mirroring the sophisticated emotion detection from the web version.

## Overview

The emotion detection system uses facial landmarks and ML Kit Face Detection to analyze user expressions in real-time during chats. It detects various emotions like:

- 😊 Happy / 😄 Smiling / 😂 Laughing
- 😲 Surprised / 😕 Confused
- 🗣️ Speaking
- 😉 Winking / 😘 Flirting
- 😐 Neutral
- 🤨 Eyebrow Raise
- And more...

## Architecture

### Core Components

1. **`useEmotionDetection` Hook** (`app/src/hooks/useEmotionDetection.ts`)
   - Core emotion detection logic ported from web version
   - Analyzes facial landmarks and calculates expression confidence
   - Implements temporal smoothing to prevent emotion flickering
   - Validates expressions to prevent false positives
   - Emits emotions via Socket.IO

2. **`EmotionDetectionCamera` Component** (`app/src/components/EmotionDetectionCamera.tsx`)
   - Hidden camera component for frame capture
   - Uses React Native Vision Camera for high performance
   - Captures frames at configurable intervals

3. **`EmotionDetectionService` Component** (`app/src/components/EmotionDetectionService.tsx`)
   - Simplified service for emotion detection without vision camera
   - Alternative implementation for projects without continuous frame capture

## Installation

### Required Dependencies

The emotion detection system requires the following packages:

```bash
# Core ML Kit for face detection (already installed)
# "@react-native-ml-kit/face-detection": "^2.0.1"

# Camera options (choose one):

# Option 1: React Native Vision Camera (recommended for production)
npm install react-native-vision-camera
npm install react-native-worklets-core

# Option 2: Expo Camera (if using Expo)
npx expo install expo-camera

# Option 3: React Native Camera (legacy, but still works)
npm install react-native-camera

# File system for image handling
npm install react-native-fs
```

### iOS Setup

1. Add camera permissions to `ios/YourApp/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to detect your emotions during chats</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for video calls</string>
```

2. Install pods:

```bash
cd ios && pod install && cd ..
```

### Android Setup

1. Add camera permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.front" android:required="false" />
```

2. Update `android/app/build.gradle` if needed:

```gradle
android {
    // ...
    packagingOptions {
        pickFirst 'lib/x86/libc++_shared.so'
        pickFirst 'lib/x86_64/libc++_shared.so'
        pickFirst 'lib/armeabi-v7a/libc++_shared.so'
        pickFirst 'lib/arm64-v8a/libc++_shared.so'
    }
}
```

## Usage

### Basic Implementation

#### 1. Add to SingleMessage Screen

```typescript
import { useSettings } from '../contexts/SettingsContext';
import EmotionDetectionService from '../components/EmotionDetectionService';

// In your SingleMessage component:
const SingleMessage = () => {
  const { settings } = useSettings();
  const myProfile = useSelector((state: RootState) => state.profile);
  const friend = route.params.friend;

  // ... rest of your code

  return (
    <SafeAreaView>
      {/* Your existing UI */}
      
      {/* Add emotion detection service */}
      {settings.isShareEmotion && myProfile?._id && friend?._id && (
        <EmotionDetectionService
          profileId={myProfile._id}
          friendId={friend._id}
          isEnabled={settings.isShareEmotion}
          detectionInterval={1500}
        />
      )}
    </SafeAreaView>
  );
};
```

#### 2. Display Friend's Emotion

The emotion is already displayed in the chat header (line 1161 in SingleMessage.tsx):

```typescript
{friendEmotion && (
  <>
    <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>|</Text>
    <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>
      {friendEmotion}
    </Text>
  </>
)}
```

#### 3. Listen for Emotion Updates

Socket listener is already implemented (line 304 in SingleMessage.tsx):

```typescript
const handleEmotionChange = (emotion: string) => {
  setFriendEmotion(emotion);
};

on('emotion_change', handleEmotionChange);
```

### Advanced Implementation with Vision Camera

For better performance and continuous frame capture:

```typescript
import EmotionDetectionCamera from '../components/EmotionDetectionCamera';

// In your component:
{settings.isShareEmotion && (
  <EmotionDetectionCamera
    profileId={myProfile._id}
    friendId={friend._id}
    isEnabled={settings.isShareEmotion}
    detectionInterval={1000}
  />
)}
```

## Features

### 1. Sophisticated Emotion Detection

The system uses advanced facial landmark analysis:

- **Mouth Metrics**: Height, width, corner positions, asymmetry
- **Eye Metrics**: Openness, height, asymmetry
- **Eyebrow Metrics**: Position, raise, furrow
- **ML Kit Classifications**: Smiling probability, eye open probability

### 2. Confidence-Based Selection

- Calculates confidence scores for each expression
- Requires minimum confidence thresholds
- Uses confidence gaps to prevent ambiguous detections
- Validates expressions to prevent false positives

### 3. Temporal Smoothing

- Prevents emotion flickering
- Requires stability across multiple detections
- Adaptive stability requirements based on confidence
- Action lock mechanism to prevent rapid changes

### 4. Quality-Based Adjustments

- Assesses face detection quality
- Adjusts confidence thresholds based on quality
- Scales detection frequency based on face size

### 5. Expression Validation

- Cross-validates with ML Kit probabilities
- Prevents impossible emotion combinations
- Special validation for specific emotions (e.g., Sad, Speaking)

## Detection Algorithm

### Expression Confidence Calculation

```typescript
// Example: Smiling detection
{
  name: 'Smiling',
  confidence: calculateExpressionConfidence([
    mouthCornerRaise > 0.025 || mlKitSmile > 0.7,     // 25% weight
    mouthWidthNorm > 0.38,                             // 20% weight
    mouthHeightNorm > 0.03 && < 0.08,                  // 15% weight
    leftCornerRaise > 0.015 && rightCornerRaise > 0.015, // 15% weight
    avgEyeHeightNorm > 0.035,                          // 10% weight
    mouthRatio < 0.3,                                  // 10% weight
    Math.abs(mouthAsymmetry) < 0.02                    // 5% weight
  ], [0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05])
}
```

### Stability Requirements

- **High Confidence (>0.8)**: 1 stable detection
- **Good Confidence (>0.7)**: 2 stable detections
- **Moderate Confidence (>0.6)**: 3 stable detections
- **Low Confidence (>0.4)**: 4 stable detections

### Lock Mechanism

After detecting an emotion:
- High confidence: 1.5 second lock
- Normal confidence: 1.2 second lock

This prevents rapid emotion changes and improves user experience.

## Configuration Options

### Detection Interval

Control how often frames are processed:

```typescript
<EmotionDetectionService
  detectionInterval={1500} // milliseconds
/>
```

**Recommendations:**
- Production: 1500-2000ms (battery friendly)
- Development/Testing: 1000ms
- High-performance devices: 800ms

### Enable/Disable

Users can toggle emotion sharing in Settings:

```typescript
const { settings } = useSettings();

// Toggle in settings
await updateSetting('isShareEmotion', true);
```

## Performance Optimization

### Battery Optimization

1. Use appropriate detection intervals (1500-2000ms)
2. Disable detection when app is in background
3. Use low camera resolution (320x240)
4. Stop detection when not in chat screens

### Memory Management

1. Clean up intervals on component unmount
2. Release camera resources when disabled
3. Clear emotion history periodically

### Frame Processing

1. Skip frames if previous processing hasn't completed
2. Use worklets for frame processing (with vision-camera)
3. Implement frame throttling

## Troubleshooting

### Camera Not Working

1. Check permissions are granted
2. Verify camera device is available
3. Check for conflicts with other camera usage

### Emotions Not Detecting

1. Ensure good lighting conditions
2. Face should be clearly visible and frontal
3. Check if ML Kit models are loaded
4. Verify socket connection is active

### Performance Issues

1. Increase detection interval
2. Reduce camera resolution
3. Check for memory leaks
4. Profile using React Native Performance Monitor

## API Reference

### useEmotionDetection Hook

```typescript
const {
  currentEmotion,      // Current detected emotion string
  isDetecting,         // Boolean indicating if detection is active
  startDetection,      // Function to start detection
  stopDetection,       // Function to stop detection
  processFaceDetection // Function to process a face detection result
} = useEmotionDetection({
  profileId: string,        // Current user profile ID
  friendId: string,         // Friend profile ID
  isEnabled: boolean,       // Enable/disable detection
  detectionInterval?: number // Detection interval in ms (default: 1000)
});
```

### Socket Events

#### Emit (Client → Server)

```typescript
socket.emit('emotion_change', {
  profileId: string,
  emotion: string,      // Full emotion string with emoji
  emotionText: string,  // Emotion text only
  emoji: string,        // Emoji only
  friendId: string,
  confidence: number,   // 0-1 confidence score
  quality: number       // 0-1 quality score
});
```

#### Listen (Server → Client)

```typescript
socket.on('emotion_change', (data) => {
  console.log('Friend emotion:', data.emotion);
  setFriendEmotion(data.emotion);
});
```

## Comparison with Web Version

This implementation closely mirrors the web version (`web/src/components/Message/ChatHeader.js`):

| Feature | Web | React Native | Status |
|---------|-----|--------------|--------|
| Face Detection | @vladmandic/face-api | @react-native-ml-kit | ✅ Implemented |
| Facial Landmarks | 68-point landmarks | ML Kit landmarks | ✅ Implemented |
| Expression Analysis | Custom calculations | Same calculations | ✅ Implemented |
| Confidence Scoring | Multi-factor weights | Same algorithm | ✅ Implemented |
| Temporal Smoothing | Stability counting | Same mechanism | ✅ Implemented |
| Validation Logic | Expression validation | Same validation | ✅ Implemented |
| Socket Integration | Socket.IO | Same | ✅ Implemented |
| Hidden Camera | Hidden video element | Service component | ⚠️ Simplified |

### Key Differences

1. **Frame Capture**: Web uses hidden `<video>` element; React Native requires a camera solution
2. **Face Detection Library**: Web uses face-api.js; React Native uses ML Kit
3. **Performance**: React Native may have slightly lower frame rates due to native bridge

## Future Enhancements

1. **Implement Native Module** for silent camera capture
2. **Add Emotion History** visualization
3. **Implement Emotion Reactions** in messages
4. **Add Emotion Analytics** dashboard
5. **Support Group Chats** with multiple emotion displays
6. **Add Emotion Filters** for privacy
7. **Implement Emotion Trends** over time

## Contributing

When contributing to the emotion detection system:

1. Maintain compatibility with web version
2. Add comprehensive tests for new expressions
3. Document any algorithm changes
4. Test on various devices and lighting conditions
5. Profile performance impact

## License

Same as the main project license.

## Support

For issues or questions:
1. Check this documentation first
2. Review the web implementation for reference
3. Test on a physical device (emulators may have camera limitations)
4. Check ML Kit documentation for face detection specifics

