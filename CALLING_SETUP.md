# Video and Audio Calling Setup

This document provides instructions for setting up and using the video and audio calling features in your React Native app.

## Features Implemented

✅ **Video Calling**: Full-screen video calls with Agora SDK
✅ **Audio Calling**: Audio-only calls with speaker/mute controls
✅ **Call Minimization**: Minimize calls to a floating bar
✅ **Socket Integration**: Real-time signaling through your existing socket system
✅ **Permission Handling**: Camera and microphone permissions
✅ **Call Controls**: Mute, camera toggle, speaker toggle, camera switching

## Setup Instructions

### 1. Install Dependencies (Already Done)
```bash
npm install react-native-agora@3.7.1 react-native-permissions
```

### 2. Android Setup

The following permissions have been added to `android/app/src/main/AndroidManifest.xml`:
- Camera access
- Microphone access
- Audio settings modification
- Network access
- Bluetooth access

### 3. iOS Setup

The following permissions have been added to `ios/Connect/Info.plist`:
- Camera usage description
- Microphone usage description

### 4. Run Pod Install (iOS only)
```bash
cd ios && pod install && cd ..
```

## Usage

### Starting Calls

1. **Video Call**: Tap the video camera icon in the SingleMessage screen header
2. **Audio Call**: Tap the phone icon in the SingleMessage screen header

### During Calls

**Video Call Controls:**
- 🎤 Mute/Unmute microphone
- 📹 Turn camera on/off
- 🔄 Switch between front/back camera
- ⬇️ Minimize call
- ❌ End call

**Audio Call Controls:**
- 🎤 Mute/Unmute microphone
- 🔊 Toggle speaker
- ⬇️ Minimize call
- ❌ End call

### Minimized Calls

When a call is minimized:
- A floating bar appears at the top of the screen
- Shows caller info and call duration
- Tap the bar to restore the full call interface
- Quick controls available in the minimized bar

## Architecture

### Components Created

1. **VideoCall.tsx**: Full-screen video calling interface
2. **AudioCall.tsx**: Full-screen audio calling interface
3. **MinimizedCallBar.tsx**: Floating minimized call interface
4. **CallMinimizeContext.tsx**: Context for managing minimized calls

### Socket Events

The app listens for these socket events:
- `agora-incoming-video-call`: Incoming video call
- `agora-incoming-audio-call`: Incoming audio call
- `agora-call-accepted`: Call accepted by recipient
- `videoCallEnd` / `audioCallEnd`: Call ended by other party

### Server Requirements

Your server should handle:
1. **Agora Token Generation**: `/agora/token` endpoint
2. **Socket Events**: The calling socket events in `server/sockets/callingSocket.js`

## Testing

1. **Test Video Calls**: 
   - Open the app on two devices
   - Navigate to a chat
   - Tap the video call button
   - Accept the call on the other device

2. **Test Audio Calls**:
   - Same as video calls but use the phone icon

3. **Test Call Minimization**:
   - During an active call, tap the minimize button
   - Verify the floating bar appears
   - Test restore functionality

## Troubleshooting

### Common Issues

1. **"Call Failed" Error**:
   - Check server connectivity
   - Verify Agora token generation endpoint
   - Check network permissions

2. **No Audio/Video**:
   - Verify permissions are granted
   - Check device camera/microphone access
   - Restart the app after granting permissions

3. **Calls Not Connecting**:
   - Verify socket connection
   - Check server logs for socket events
   - Ensure both users are connected to the same server

### Debug Steps

1. Check React Native logs: `npx react-native log-android` or `npx react-native log-ios`
2. Verify socket connection in the app
3. Check server logs for incoming socket events
4. Test Agora token generation endpoint manually

## Next Steps

1. **Test the implementation** on physical devices (recommended for audio/video)
2. **Configure Agora settings** in your server for production
3. **Add call history** if needed
4. **Implement push notifications** for missed calls
5. **Add call recording** if required

## Notes

- Video/audio calls work best on physical devices
- Emulators may have limited camera/microphone support
- Ensure proper network connectivity for real-time communication
- The implementation uses Agora SDK version 3.7.1 for compatibility with React Native 0.80

