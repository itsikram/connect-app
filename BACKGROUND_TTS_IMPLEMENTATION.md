# Background TTS Implementation Guide

## Overview

This implementation adds comprehensive background Text-to-Speech (TTS) functionality to your React Native app, enabling push notifications to be spoken even when the app is closed or in the background.

## Features

### ✅ Implemented Features

1. **Background TTS Service** (`src/lib/backgroundTtsService.ts`)
   - Singleton service for managing TTS operations
   - Persistent settings storage using AsyncStorage
   - Configurable speech rate, volume, and pitch
   - Priority-based speech (high, normal, low)
   - Speech interruption handling

2. **Enhanced Push Notifications** (`index.js`)
   - Background message handler with TTS integration
   - Automatic TTS for incoming calls
   - TTS for new messages
   - TTS for general notifications
   - Foreground message handling with TTS

3. **TTS Settings UI** (`src/components/settings/TtsSettings.tsx`)
   - Enable/disable TTS functionality
   - Adjustable speech rate (10% - 100%)
   - Volume control (0% - 100%)
   - Pitch adjustment (50% - 200%)
   - Test TTS functionality
   - Reset to default settings

4. **Android Permissions** (`android/app/src/main/AndroidManifest.xml`)
   - Background processing permissions
   - Notification policy access
   - Battery optimization exemption
   - Boot receiver for service restart

5. **Integration with Existing TTS**
   - Updated App.tsx to use background TTS service
   - Socket message handling with TTS
   - Seamless integration with existing notification system

## How It Works

### Background Processing

1. **App Initialization**: Background TTS service initializes when the app starts
2. **Push Notifications**: When a push notification is received in the background:
   - The notification type is determined (call, message, general)
   - Appropriate TTS message is generated and spoken
   - Visual notification is displayed alongside TTS

3. **Foreground Processing**: When app is active:
   - TTS still works for important notifications
   - Visual notifications are skipped (handled by app UI)
   - TTS provides audio feedback

### TTS Message Types

1. **Incoming Calls**: "Incoming [audio/video] call from [caller name]"
2. **New Messages**: "New message from [sender name]: [message preview]"
3. **General Notifications**: "[Title]. [Body]"

## Configuration

### TTS Settings

Users can configure TTS through the Settings → TTS tab:

- **Enable TTS**: Master switch for all TTS functionality
- **Speech Rate**: How fast the text is spoken (10% - 100%)
- **Volume**: Audio volume level (0% - 100%)
- **Pitch**: Voice pitch (50% - 200%)

### Priority Levels

- **High Priority**: Incoming calls (interrupts other speech, faster rate)
- **Normal Priority**: Messages and notifications
- **Low Priority**: General announcements

## Testing

### Test Scripts

Use the test scripts in `src/lib/testBackgroundTts.js`:

```javascript
import { testBackgroundTts, testTtsSettings, testBackgroundNotificationSimulation } from './src/lib/testBackgroundTts';

// Test basic TTS functionality
await testBackgroundTts();

// Test TTS settings
await testTtsSettings();

// Simulate background notifications
await testBackgroundNotificationSimulation();
```

### Manual Testing

1. **Background Testing**:
   - Close the app completely
   - Send a test notification from your server
   - Verify TTS plays the notification

2. **Settings Testing**:
   - Go to Settings → TTS
   - Adjust speech rate, volume, pitch
   - Test TTS with different settings
   - Save and verify settings persist

3. **Interruption Testing**:
   - Start a long TTS message
   - Send a high-priority notification
   - Verify the new message interrupts the old one

## Server Integration

### Push Notification Payload

To enable TTS, include the appropriate data in your push notifications:

```javascript
// Incoming call
{
  data: {
    type: 'incoming_call',
    callerName: 'John Doe',
    isAudio: 'true', // or 'false' for video
    callerId: 'user123',
    channelName: 'call_channel_123',
    callerProfilePic: 'https://example.com/avatar.jpg'
  }
}

// New message
{
  data: {
    type: 'new_message',
    senderName: 'Alice',
    message: 'Hey, how are you?',
    senderId: 'user456'
  }
}

// General notification
{
  data: {
    type: 'notification',
    title: 'Friend Request',
    body: 'Sarah sent you a friend request'
  }
}
```

## Troubleshooting

### Common Issues

1. **TTS Not Working in Background**
   - Check Android battery optimization settings
   - Ensure notification permissions are granted
   - Verify background app refresh is enabled

2. **TTS Settings Not Persisting**
   - Check AsyncStorage permissions
   - Verify settings are saved before app closes

3. **TTS Interruption Not Working**
   - Ensure `interrupt: true` is set for high-priority messages
   - Check if TTS service is properly initialized

### Debug Logging

Enable debug logging by checking console output:

```
🎤 Background TTS Service initialized
📱 Background message received: [messageId]
🎤 Speaking message: [message preview]
```

## Performance Considerations

1. **Memory Usage**: TTS service is lightweight and uses minimal memory
2. **Battery Impact**: Minimal impact due to efficient speech synthesis
3. **Network**: No additional network usage (TTS is local)
4. **Storage**: Settings stored locally in AsyncStorage

## Security Considerations

1. **Local Processing**: All TTS processing happens locally on device
2. **No Data Transmission**: No sensitive data is sent for TTS processing
3. **User Control**: Users can disable TTS at any time
4. **Privacy**: TTS only processes notification content

## Future Enhancements

1. **Multiple Languages**: Support for different TTS languages
2. **Voice Selection**: Allow users to choose different TTS voices
3. **Custom Messages**: Allow users to customize TTS message templates
4. **Scheduling**: TTS notifications at specific times
5. **Conditional TTS**: TTS only in certain conditions (time, location, etc.)

## Dependencies

- `react-native-tts`: Text-to-speech functionality
- `@react-native-async-storage/async-storage`: Settings persistence
- `@react-native-firebase/messaging`: Push notifications
- `@notifee/react-native`: Enhanced notifications
- `@react-native-community/slider`: Settings UI slider

## Installation Notes

1. Ensure all dependencies are installed
2. Update Android permissions in AndroidManifest.xml
3. Configure Firebase messaging for your app
4. Test TTS functionality after installation

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Test with the provided test scripts
4. Verify all permissions are granted

