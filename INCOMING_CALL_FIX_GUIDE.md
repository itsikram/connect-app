# Incoming Call Screen Fix for Closed App on Android

## Problem
The incoming call screen was not showing on the Android home screen when the app was completely closed. Users would only see a notification in the notification tray instead of a full-screen incoming call UI.

## Solution Implemented

### 1. **Android Manifest Enhancements**
Added critical permissions and configurations:
- ✅ `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` - Allows the app to request exemption from battery optimization
- ✅ Added intent filter for incoming call deep links in MainActivity
- ✅ Enhanced Activity flags (`showWhenLocked`, `turnScreenOn`) for lock screen display

**File**: `app/android/app/src/main/AndroidManifest.xml`

### 2. **Enhanced Notification System**
Upgraded the notification configuration for incoming calls:
- ✅ Full-screen intent with proper launch activity
- ✅ High-importance notification channel with DND bypass
- ✅ Call category with maximum priority
- ✅ Ongoing notification flag to prevent dismissal
- ✅ Auto-dismiss after 45 seconds
- ✅ Chronometer countdown display

**Files**: `app/src/lib/push.ts`, `app/index.js`

### 3. **Battery Optimization Management**
Added functionality to request battery optimization exemption:
- ✅ Detects device power manager
- ✅ Prompts user once to disable battery optimization
- ✅ Opens device battery settings directly
- ✅ Stores user preference to avoid repeated prompts

**File**: `app/src/lib/push.ts` - New functions:
- `requestBatteryOptimizationExemption()`
- `requestIncomingCallPermissions()`

### 4. **Improved Background Message Handling**
Enhanced the Firebase background message handler:
- ✅ Better logging for debugging
- ✅ Explicit handling of incoming call notifications
- ✅ Proper error handling and recovery
- ✅ Separate code paths for calls vs. regular notifications

**File**: `app/index.js`

## Testing Instructions

### 1. **Clean Build Required**
Since we modified the Android manifest, you need to rebuild the app:

```bash
cd app
# For Android
npx react-native run-android
# Or rebuild in Android Studio
```

### 2. **Test Scenarios**

#### Scenario A: App Completely Closed
1. Force close the app (swipe away from recent apps)
2. Have another user initiate a video or audio call to you
3. **Expected**: A full-screen notification should appear with "Accept" and "Reject" buttons
4. Tapping "Accept" should open the app and connect the call
5. Tapping "Reject" should dismiss the notification and decline the call

#### Scenario B: App in Background
1. Open the app, then press home button
2. Have another user call you
3. **Expected**: Same as Scenario A

#### Scenario C: Device Locked
1. Lock your device
2. Have another user call you
3. **Expected**: Full-screen call notification on lock screen
4. You should be able to accept/reject without unlocking

#### Scenario D: Battery Saver Mode
1. Enable battery saver on your device
2. Test scenarios A-C again
3. If issues occur, the app will prompt you to disable battery optimization

### 3. **Verification Checklist**

- [ ] Notification appears as full-screen when app is closed
- [ ] "Accept" and "Reject" buttons are visible and functional
- [ ] Notification shows on lock screen
- [ ] Call connects properly when accepted from notification
- [ ] Notification auto-dismisses after ~45 seconds
- [ ] Battery optimization prompt appears (first time only)
- [ ] Works on different Android versions (tested on API 29+)

## Troubleshooting

### Issue: Notification appears but not full-screen

**Solution**: The user needs to disable battery optimization for the app.

Manual steps:
1. Go to Settings → Apps → Connect
2. Tap "Battery" or "Battery usage"
3. Select "Unrestricted" or "Not optimized"

The app will prompt users to do this automatically on first call.

### Issue: No notification at all

**Possible causes**:
1. **FCM token not registered** - Check if push notifications work for messages
2. **Internet connectivity** - Verify device has active internet
3. **Notification permissions** - Go to app settings and enable notifications
4. **Google Play Services** - Ensure Play Services are up to date

**Debugging**:
```bash
# View Android logs
adb logcat | grep -E "FCM|notifee|incoming_call"
```

Look for:
- `📱 Background message received`
- `📞 Processing incoming call in background`
- `✅ Incoming call notification displayed`

### Issue: Full-screen intent not showing on Android 14+

Android 14+ requires explicit user permission for full-screen intents. The system will show a prompt automatically. Users need to:
1. Tap the system notification about full-screen intent
2. Enable "Full screen notifications" for the app

## Server-Side Requirements

Ensure your server is sending push notifications with the correct format:

```javascript
// Example from server/sockets/callingSocket.js
await sendDataPushToProfile(recipientId, {
  type: 'incoming_call',
  isAudio: 'true', // or 'false' for video
  from: String(callerId),
  callerName: 'John Doe',
  callerProfilePic: 'https://...',
  channelName: 'channel_name'
});
```

**Important**: Use `sendDataPushToProfile` (data-only push) NOT `sendPushToProfile` (notification push) for incoming calls. This ensures the app can render the custom full-screen UI.

## Additional Notes

### Android Version Compatibility
- ✅ Android 10 (API 29) and above: Full support with full-screen intent
- ✅ Android 13 (API 33): Notification permission prompt automatically handled
- ✅ Android 14 (API 34): Full-screen intent permission prompt handled by system

### Known Limitations
1. Some manufacturers (Xiaomi, Huawei, Oppo) have aggressive battery management that may still block notifications. Users need to manually whitelist the app in those cases.
2. If the device is in "Do Not Disturb" mode, the notification channel is configured to bypass it, but user settings may override this.

### Performance Impact
- Minimal: Battery optimization exemption only affects background connectivity
- Network usage: No change, uses existing FCM infrastructure
- No additional battery drain during normal app usage

## Files Modified

1. `app/android/app/src/main/AndroidManifest.xml` - Added permissions and intent filters
2. `app/src/lib/push.ts` - Enhanced notification system and battery optimization
3. `app/index.js` - Improved background message handler
4. `app/src/screens/IncomingCall.tsx` - No changes needed (existing implementation is correct)

## Next Steps

1. **Build and test** on multiple Android devices
2. **Monitor logs** during testing for any errors
3. **User feedback** - Ask users to report if they're not receiving calls
4. Consider adding **in-app tutorial** showing users how to enable battery optimization exemption

---

**Questions or Issues?**
Check the logs using `adb logcat` and look for the emoji markers:
- 📱 = Background message
- 📞 = Incoming call processing
- ✅ = Success
- ❌ = Error




