# Incoming Call Testing Guide

## Overview
This guide explains how to test the incoming call functionality when the app is not active or completely closed.

## What Was Fixed

### 1. **Enhanced Notification System**
- Created a dedicated `CallNotificationService` for better call handling
- Added native Android module for reliable app launching
- Improved notification configuration with full-screen intents
- Added proper Android manifest permissions and intent filters

### 2. **Native Android Module**
- `CallNotificationModule.java` - Handles incoming call intents
- `CallNotificationPackage.java` - Registers the native module
- `CallNotificationBridge.ts` - React Native bridge to native module
- Updated `MainActivity.kt` to handle incoming call intents

### 3. **Improved Notification Configuration**
- Enhanced notification channels with maximum priority
- Added full-screen action support
- Improved lock screen and heads-up notification handling
- Better battery optimization exemption handling

## Testing Instructions

### Prerequisites
1. **Clean Build Required**: Since we modified native Android code, you need to rebuild the app:
   ```bash
   cd app
   npx react-native run-android
   ```

2. **Permissions**: Ensure the app has all required permissions:
   - Notification permissions
   - Battery optimization exemption (optional but recommended)

### Test Scenarios

#### 1. **App Completely Closed**
1. Force close the app completely (swipe away from recent apps)
2. Send an incoming call from another device
3. **Expected Result**: 
   - App should launch automatically
   - IncomingCall screen should display immediately
   - Full-screen call UI should appear

#### 2. **App in Background**
1. Put the app in background (home button)
2. Send an incoming call from another device
3. **Expected Result**:
   - App should come to foreground
   - IncomingCall screen should display
   - Notification should appear with action buttons

#### 3. **Device Locked**
1. Lock the device
2. Send an incoming call from another device
3. **Expected Result**:
   - Device should wake up
   - IncomingCall screen should display over lock screen
   - Call UI should be fully functional

#### 4. **Notification Actions**
1. When notification appears, test both action buttons:
   - **Accept**: Should open app and auto-accept call
   - **Reject**: Should reject call and close notification
   - **Tap notification**: Should open IncomingCall screen

### Debugging

#### Check Logs
```bash
# Android logs
adb logcat | grep -E "(CallNotification|IncomingCall|📞)"

# React Native logs
npx react-native log-android
```

#### Common Issues

1. **App doesn't launch**: Check if battery optimization is disabled
2. **Notification doesn't appear**: Check notification permissions
3. **Full-screen doesn't work**: Check Android version (requires Android 10+)
4. **Native module not found**: Ensure clean rebuild was done

#### Battery Optimization
If calls don't work when app is closed:
1. Go to Settings > Apps > Connect
2. Battery > Battery optimization
3. Select "Don't optimize" for Connect app

### Files Modified

#### Native Android Files
- `app/android/app/src/main/java/com/connect/app/CallNotificationModule.java`
- `app/android/app/src/main/java/com/connect/app/CallNotificationPackage.java`
- `app/android/app/src/main/java/com/connect/app/MainActivity.kt`
- `app/android/app/src/main/java/com/connect/app/MainApplication.kt`
- `app/android/app/src/main/AndroidManifest.xml`

#### React Native Files
- `app/src/lib/callNotificationService.ts`
- `app/src/lib/CallNotificationBridge.ts`
- `app/src/lib/push.ts`
- `app/index.js`

### Expected Behavior

#### When App is Closed
1. Firebase message received in background
2. `CallNotificationService` displays notification
3. Native module attempts to launch app directly
4. If native fails, notification with full-screen action appears
5. User taps notification or action button
6. App launches and navigates to IncomingCall screen

#### When App is in Background
1. Firebase message received
2. Notification appears with action buttons
3. User taps notification or action button
4. App comes to foreground
5. IncomingCall screen displays

### Troubleshooting

#### If Nothing Happens
1. Check if Firebase is properly configured
2. Verify notification permissions
3. Check battery optimization settings
4. Ensure clean rebuild was done

#### If Notification Appears But App Doesn't Launch
1. Check native module registration
2. Verify intent filters in AndroidManifest.xml
3. Check MainActivity.kt for intent handling

#### If App Launches But Wrong Screen Shows
1. Check navigation logic in notification handlers
2. Verify parameter passing to IncomingCall screen
3. Check socket connection status

### Success Criteria
- ✅ App launches automatically when closed
- ✅ IncomingCall screen displays immediately
- ✅ Full-screen call UI appears
- ✅ Action buttons work correctly
- ✅ Works on lock screen
- ✅ Works when app is in background
- ✅ Notification appears with proper actions
- ✅ No crashes or errors in logs

## Notes
- This solution uses both notification-based and native-based approaches for maximum reliability
- The native module provides better control over app launching
- Fallback to notifications ensures compatibility across different Android versions
- Battery optimization exemption is recommended for best results
