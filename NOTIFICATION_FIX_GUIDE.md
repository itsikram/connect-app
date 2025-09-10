# Incoming Call Push Notification Fix Guide

## Issues Fixed

1. **Enhanced permission handling** - Added proper Android 13+ notification permissions
2. **Improved notification channels** - Better configuration with vibration, lights, and priority
3. **Better error handling** - Added comprehensive error logging and fallbacks
4. **Notification initialization** - Created proper initialization flow
5. **Background notification handling** - Fixed background message processing

## Files Modified

### 1. `src/lib/push.ts`
- Enhanced `requestPushPermission()` with proper Android 13+ permissions
- Improved `configureNotificationsChannel()` with better channel settings
- Enhanced `displayIncomingCallNotification()` with better notification properties
- Added `initializeNotifications()` function for proper setup
- Added `cancelIncomingCallNotifications()` for cleanup

### 2. `src/hooks/useNotifications.ts` (NEW)
- Custom hook for managing notification lifecycle
- Handles app state changes
- Manages notification listeners

### 3. `src/components/NotificationSetup.tsx` (NEW)
- Component to initialize notifications in your app

## Integration Steps

### Step 1: Add to App.tsx

Add the NotificationSetup component to your main App component:

```tsx
import NotificationSetup from './src/components/NotificationSetup';

// In your main App component, add:
<NotificationSetup navigation={navigation} />
```

### Step 2: Test the Fix

1. **Check permissions**: Ensure notification permissions are granted
2. **Test foreground**: Send a test notification while app is open
3. **Test background**: Send a test notification while app is in background
4. **Test killed state**: Send a test notification while app is completely closed

### Step 3: Debug Steps

If notifications still don't work:

1. **Check logs**: Look for console logs starting with "Notification" or "Error"
2. **Verify FCM token**: Check if token is being generated and registered
3. **Check server**: Ensure your server is sending notifications with correct format
4. **Test permissions**: Manually check notification permissions in device settings

## Server-Side Requirements

Your server should send notifications with this format:

```json
{
  "to": "FCM_TOKEN",
  "data": {
    "type": "incoming_call",
    "callerId": "user123",
    "callerName": "John Doe",
    "callerProfilePic": "https://example.com/avatar.jpg",
    "channelName": "call_channel_123",
    "isAudio": "true"
  },
  "notification": {
    "title": "Incoming Call",
    "body": "Call from John Doe"
  }
}
```

## Testing Commands

```bash
# Test notification permission
adb shell dumpsys notification

# Check notification channels
adb shell dumpsys notification | grep -A 10 "calls"

# Test FCM token
adb logcat | grep "FCM"
```

## Common Issues & Solutions

1. **No notifications appear**: Check if permissions are granted
2. **Notifications appear but no actions**: Check notification channel configuration
3. **Background notifications don't work**: Verify background message handler
4. **Full-screen notifications don't work**: Check Android manifest permissions
