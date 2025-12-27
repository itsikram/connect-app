# FCM Production Build Setup

This document ensures FCM (Firebase Cloud Messaging) notifications work correctly in production builds.

## Critical Requirements

### 1. Background Message Handler Registration
- ✅ The `setBackgroundMessageHandler` is called **BEFORE** `AppRegistry.registerComponent`
- ✅ The handler is registered at the top level of `index.js`
- ✅ The handler works in production (no `__DEV__` checks that prevent execution)

### 2. ProGuard Rules
- ✅ FCM classes are kept in `proguard-rules.pro`
- ✅ React Native Firebase classes are preserved
- ✅ Notifee classes are preserved

### 3. Error Handling
- ✅ All critical errors are logged even in production (using `console.error`)
- ✅ Fallback handlers ensure notifications are displayed even if primary handler fails
- ✅ Graceful degradation if Firebase initialization fails

### 4. Android Configuration
- ✅ `google-services.json` is present in `app/android/app/`
- ✅ Firebase is initialized in `MainApplication`
- ✅ Notification permissions are requested

## Testing in Production

1. **Build a release APK:**
   ```bash
   cd app/android
   ./gradlew assembleRelease
   ```

2. **Install on device:**
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

3. **Test scenarios:**
   - App in foreground: Should receive notifications
   - App in background: Should receive notifications
   - App killed: Should receive notifications (most critical)
   - Device reboot: Should receive notifications after reboot

4. **Check logs:**
   ```bash
   adb logcat | grep -i "fcm\|firebase\|notification"
   ```

## Troubleshooting

### Notifications not received when app is killed:
1. Check that `setBackgroundMessageHandler` is called before `AppRegistry.registerComponent`
2. Verify `google-services.json` is present and correct
3. Check ProGuard rules are applied
4. Ensure notification permissions are granted

### Notifications not received in background:
1. Check battery optimization settings
2. Verify background service is running
3. Check FCM token is registered on server

### Notifications not received in foreground:
1. Check `listenForegroundMessages()` is called
2. Verify notification channels are created
3. Check app state handling

## Key Files

- `app/index.js` - Background message handler registration
- `app/android/app/proguard-rules.pro` - ProGuard rules for FCM
- `app/src/lib/push.ts` - Foreground message handling
- `app/src/lib/pushBackgroundService.ts` - Background message handling
- `app/android/app/src/main/AndroidManifest.xml` - Android permissions

