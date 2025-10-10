# Background Notification Testing Guide

## Overview

This guide provides comprehensive instructions for testing that incoming call notifications and all other notifications work even when the app is completely closed.

## Prerequisites

### 1. Device Setup
- Android device with API level 21+ (Android 5.0+)
- App installed and permissions granted
- Battery optimization disabled for the app
- Auto-start permission enabled (if available on your device)

### 2. Server Setup
- Firebase Cloud Messaging (FCM) configured
- Server sending push notifications with proper payload structure

## Testing Steps

### Phase 1: Initial Setup and Verification

#### 1.1 Grant Permissions
1. Open the app
2. Go to **Settings → Background**
3. Tap **"Request Permissions"**
4. Grant all requested permissions:
   - Notification permissions
   - Battery optimization exemption
   - Auto-start permission (if prompted)

#### 1.2 Verify Service Status
1. In **Settings → Background**, check all service status indicators:
   - ✅ Background TTS Service
   - ✅ Notification Service  
   - ✅ Battery Optimization Exempt
   - ✅ Auto-Start Enabled

#### 1.3 Test TTS Functionality
1. Tap **"Test TTS"** button
2. Verify you can hear the test message clearly
3. If TTS doesn't work, check device volume and TTS settings

### Phase 2: Background Service Testing

#### 2.1 Test with App in Background
1. **Don't close the app completely yet**
2. Minimize the app (press home button)
3. Send a test notification from your server
4. Verify:
   - Notification appears in notification tray
   - TTS plays the notification message
   - Tapping notification opens the app

#### 2.2 Test with App Closed from Recent Apps
1. Open recent apps (swipe up from bottom or press recent apps button)
2. **Swipe away the Connect app completely**
3. Wait 10-15 seconds
4. Send a test notification from your server
5. Verify:
   - Notification appears in notification tray
   - TTS plays the notification message
   - Tapping notification opens the app

#### 2.3 Test with App Force-Stopped
1. Go to **Settings → Apps → Connect**
2. Tap **"Force Stop"**
3. Wait 10-15 seconds
4. Send a test notification from your server
5. Verify:
   - Notification appears in notification tray
   - TTS plays the notification message
   - Tapping notification opens the app

### Phase 3: Specific Notification Types Testing

#### 3.1 Incoming Call Notifications
Send a push notification with this payload:
```json
{
  "data": {
    "type": "incoming_call",
    "callerName": "John Doe",
    "isAudio": "true",
    "callerId": "user123",
    "channelName": "call_channel_123",
    "callerProfilePic": "https://example.com/avatar.jpg"
  },
  "notification": {
    "title": "Incoming Call",
    "body": "John Doe is calling you"
  }
}
```

Expected behavior:
- Full-screen incoming call notification appears
- TTS says: "Incoming audio call from John Doe"
- Accept/Decline buttons are functional
- Ringtone plays (if enabled)

#### 3.2 New Message Notifications
Send a push notification with this payload:
```json
{
  "data": {
    "type": "new_message",
    "senderName": "Alice",
    "message": "Hey, how are you doing?",
    "senderId": "user456"
  },
  "notification": {
    "title": "New Message",
    "body": "Alice: Hey, how are you doing?"
  }
}
```

Expected behavior:
- Regular notification appears in tray
- TTS says: "New message from Alice: Hey, how are you doing?"
- Tapping opens the app to the conversation

#### 3.3 General Notifications
Send a push notification with this payload:
```json
{
  "data": {
    "type": "notification",
    "title": "Friend Request",
    "body": "Sarah sent you a friend request"
  },
  "notification": {
    "title": "Friend Request",
    "body": "Sarah sent you a friend request"
  }
}
```

Expected behavior:
- Regular notification appears in tray
- TTS says: "Friend Request. Sarah sent you a friend request"
- Tapping opens the app

### Phase 4: Edge Cases and Stress Testing

#### 4.1 Multiple Rapid Notifications
1. Send 3-5 notifications within 5 seconds
2. Verify:
   - All notifications are received
   - TTS handles interruptions properly
   - No crashes or freezes occur

#### 4.2 Device Restart Testing
1. Restart the device completely
2. Wait for device to fully boot
3. **Don't open the app manually**
4. Send a test notification
5. Verify notification and TTS work

#### 4.3 Battery Optimization Testing
1. Enable battery optimization for the app
2. Close the app completely
3. Send a test notification
4. Verify if notification is received (may be delayed or not received)
5. Disable battery optimization again
6. Test again to confirm it works

#### 4.4 Low Battery Testing
1. Let device battery drop to 20% or below
2. Close the app completely
3. Send a test notification
4. Verify notification behavior with low battery

### Phase 5: Troubleshooting

#### 5.1 Common Issues and Solutions

**Issue: Notifications not received when app is closed**
Solutions:
- Check battery optimization settings
- Verify auto-start permission
- Check if device has aggressive battery saving mode
- Ensure FCM token is valid and registered

**Issue: TTS not working in background**
Solutions:
- Check TTS settings in Settings → TTS
- Verify device TTS engine is working
- Check if TTS is disabled in device accessibility settings
- Test TTS in foreground first

**Issue: App doesn't open when notification is tapped**
Solutions:
- Check notification payload structure
- Verify intent filters in AndroidManifest.xml
- Check if app is properly installed
- Test with different notification types

#### 5.2 Debug Information
Enable debug logging by checking console output:
```
🔧 Initializing Background Service Manager...
✅ Background Service Manager initialized
🎤 Background TTS Service initialized
📱 Background message received: [messageId]
🎤 Speaking message: [message preview]
```

#### 5.3 Service Status Check
Use the Background Notification Tester:
1. Go to **Settings → Background**
2. Check service status indicators
3. Use **"Restart Services"** if needed
4. Use **"Refresh Status"** to update status

## Expected Results

### ✅ Success Criteria
- All notification types work when app is completely closed
- TTS plays for all notification types
- Notifications appear in system notification tray
- Tapping notifications opens the app correctly
- Services restart after device reboot
- No crashes or memory leaks occur

### ❌ Failure Indicators
- Notifications not received when app is closed
- TTS not working in background
- App crashes when notifications are received
- Services don't restart after device reboot
- Battery drain issues

## Server-Side Testing

### Test Payloads
Use these payloads for comprehensive testing:

#### Incoming Call
```json
{
  "to": "FCM_TOKEN_HERE",
  "data": {
    "type": "incoming_call",
    "callerName": "Test Caller",
    "isAudio": "true",
    "callerId": "test_user",
    "channelName": "test_channel"
  },
  "notification": {
    "title": "Incoming Call",
    "body": "Test Caller is calling you"
  }
}
```

#### New Message
```json
{
  "to": "FCM_TOKEN_HERE",
  "data": {
    "type": "new_message",
    "senderName": "Test Sender",
    "message": "This is a test message",
    "senderId": "test_sender"
  },
  "notification": {
    "title": "New Message",
    "body": "Test Sender: This is a test message"
  }
}
```

#### General Notification
```json
{
  "to": "FCM_TOKEN_HERE",
  "data": {
    "type": "notification",
    "title": "Test Notification",
    "body": "This is a test notification"
  },
  "notification": {
    "title": "Test Notification",
    "body": "This is a test notification"
  }
}
```

## Performance Monitoring

### Key Metrics to Monitor
- Notification delivery rate (should be >95%)
- TTS response time (should be <2 seconds)
- App startup time after notification tap
- Battery usage impact
- Memory usage of background services

### Monitoring Tools
- Firebase Analytics for notification delivery
- Android Studio Logcat for debugging
- Device battery usage statistics
- App performance monitoring tools

## Conclusion

This comprehensive testing ensures that your app's background notification system works reliably even when the app is completely closed. Regular testing of these scenarios will help maintain a high-quality user experience for push notifications and TTS functionality.

