# FCM Production Build Setup

This document ensures FCM (Firebase Cloud Messaging) notifications work correctly in production builds.

## Critical Requirements

### 1. Background Message Handling
- ✅ `ConnectFirebaseMessagingService` handles data-only FCM messages natively.
- ✅ Native notifications are displayed when the React Native process is stopped.
- ✅ Android displays notification payloads while the app is backgrounded or stopped.
- ⚠️ Android force-stop is an OS restriction: delivery resumes after the user
  launches the app again.

For custom notifications that must display while the app is stopped, send a
data-only message with `type`, `title`, `body`, and (when needed) `channelId`,
`messageId`, and navigation identifiers inside `data`. Do not include a
`notification` object for this path.

### 2. ProGuard Rules
- ✅ FCM classes are kept in `proguard-rules.pro`
- ✅ React Native Firebase classes are preserved
- ✅ Notifee classes are preserved

### 3. Error Handling
- ✅ Native FCM errors are logged with the `ConnectFCM` tag.
- ✅ JavaScript registration updates the authenticated API after login/startup.

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
1. Verify the server sent a data-only message with a non-empty `data` object
2. Verify `google-services.json` is present and matches `com.connect.app`
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

- `app/index.js` - Foreground and Expo task registration
- `app/android/app/proguard-rules.pro` - ProGuard rules for FCM
- `app/src/lib/push.ts` - Token registration and foreground handling
- `app/android/app/src/main/java/com/connect/app/ConnectFirebaseMessagingService.kt` - Killed-state FCM handling
- `app/android/app/src/main/AndroidManifest.xml` - Android permissions
