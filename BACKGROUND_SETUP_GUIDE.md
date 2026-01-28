# Background Mode Setup Guide

This guide explains how the React Native Connect app handles background operations for receiving notifications and incoming calls.

## Overview

The app is configured to run in the background and receive notifications/calls even when closed or the device is locked. This involves multiple layers of configuration:

### 1. Platform-Specific Background Modes

#### Android Configuration
- **File**: `android/app/src/main/AndroidManifest.xml`
- **Key Permissions**:
  - `FOREGROUND_SERVICE_*` - Various foreground service types
  - `WAKE_LOCK` - Keep device awake for calls
  - `RECEIVE_BOOT_COMPLETED` - Auto-start after reboot
  - `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` - Battery exemption
  - `USE_FULL_SCREEN_INTENT` - Full-screen call notifications

#### iOS Configuration  
- **File**: `ios/Connect/Info.plist` and `app.json`
- **Background Modes**:
  - `audio` - For call audio
  - `background-fetch` - Periodic background tasks
  - `background-processing` - Background data processing
  - `remote-notification` - Push notifications
  - `voip` - Voice over IP calls

### 2. Background Services

#### BackgroundTaskManager
- **File**: `src/lib/backgroundTaskManager.ts`
- **Purpose**: Manages periodic background tasks using expo-background-fetch
- **Features**:
  - 5-minute minimum interval background sync
  - Automatic registration and status checking
  - Persistent status tracking

#### BackgroundServiceManager
- **File**: `src/lib/backgroundServiceManager.ts`
- **Purpose**: Manages background services and permissions
- **Features**:
  - Battery optimization exemption requests
  - Auto-start permission management
  - Service status monitoring

### 3. Notification System

#### Push Notifications
- **File**: `src/lib/push.ts`
- **Features**:
  - Expo push token management
  - Notifee integration for rich notifications
  - Incoming call full-screen notifications
  - Background notification handling

#### Call Notifications
- **File**: `src/lib/callNotificationService.tsx`
- **Features**:
  - Full-screen incoming call notifications
  - Accept/reject actions
  - Auto-accept from notification
  - Cross-platform compatibility

### 4. User Interface

#### BackgroundPermissionsGuide
- **File**: `src/components/BackgroundPermissionsGuide.tsx`
- **Purpose**: User-friendly permission management interface
- **Features**:
  - Visual permission status display
  - One-tap permission requests
  - Educational content about permissions

#### useBackgroundPermissions Hook
- **File**: `src/hooks/useBackgroundPermissions.ts`
- **Purpose**: React hook for permission management
- **Features**:
  - Automatic permission checking
  - Permission request orchestration
  - Status tracking

## Implementation Details

### Background Task Flow

1. **App Initialization**: Background services are initialized on app start
2. **Permission Check**: App checks current permission status
3. **Service Registration**: Background tasks are registered with the OS
4. **Periodic Execution**: Tasks run every 5+ minutes when app is backgrounded
5. **Notification Handling**: Push notifications can wake the app for important events

### Incoming Call Flow

1. **Push Notification**: Server sends push notification for incoming call
2. **System Wake**: Notification wakes the app if backgrounded
3. **Full-Screen Alert**: Notifee displays full-screen call notification
4. **User Action**: User can accept/reject from notification
5. **App Navigation**: App navigates to IncomingCall screen

### Battery Optimization

#### Android
- App requests battery optimization exemption
- Users are guided to disable battery optimization
- Background services are configured to persist

#### iOS
- Background App Refresh is enabled
- VoIP background mode is used for calls
- Silent notifications can wake the app

## Testing Background Functionality

### 1. Notification Testing
```bash
# Test with expo-notifications
npx expo start --dev-client

# Send test notification via server or Expo notification tool
```

### 2. Background Task Testing
```javascript
// In development, you can force background task execution
import backgroundTaskManager from './src/lib/backgroundTaskManager';
await backgroundTaskManager.forceRunTask();
```

### 3. Call Testing
1. Put app in background
2. Send incoming call from another device
3. Verify full-screen notification appears
4. Test accept/reject functionality

## Troubleshooting

### Common Issues

#### Notifications Not Working
- Check notification permissions in device settings
- Verify expo-notifications setup
- Ensure push token is registered with server

#### Background Tasks Not Running
- Check battery optimization settings (Android)
- Verify Background App Refresh (iOS)
- Ensure background modes are properly configured

#### Calls Not Connecting
- Check VoIP background mode (iOS)
- Verify foreground service permissions (Android)
- Ensure socket connection is maintained

### Debugging Tools

#### Android
```bash
# Check background services
adb shell dumpsys activity services com.connect.app

# Check battery optimization
adb shell dumpsys deviceidle whitelist
```

#### iOS
- Use Xcode Console to monitor background activity
- Check Background App Refresh status in Settings

## Best Practices

### 1. Permission Requests
- Request permissions at appropriate times
- Provide clear explanations for why permissions are needed
- Handle permission denial gracefully

### 2. Background Operations
- Keep background tasks minimal and efficient
- Use appropriate background modes for specific use cases
- Handle network connectivity issues gracefully

### 3. User Experience
- Provide clear feedback about permission status
- Allow users to easily manage permissions
- Offer alternative functionality when permissions are denied

## Platform-Specific Notes

### Android
- Background services may be killed by aggressive battery optimization
- Different OEMs have different background execution policies
- Foreground services require persistent notifications

### iOS
- Background execution is more limited than Android
- Apps have limited background execution time
- VoIP background mode provides the most flexibility for calls

## Security Considerations

- Minimal data is processed in background
- All background operations are user-initiated
- Sensitive operations require explicit user permission
- Background tasks follow platform security guidelines

## Future Enhancements

1. **Adaptive Background Intervals**: Adjust frequency based on usage patterns
2. **Smart Wake-up**: Use machine learning to optimize background timing
3. **Cross-Device Sync**: Sync background status across user devices
4. **Performance Monitoring**: Track background operation success rates

This setup ensures reliable background operation while respecting platform constraints and user privacy.
