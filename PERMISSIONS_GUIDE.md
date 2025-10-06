# App Permissions Guide

## Overview

The Connect app now automatically requests the following permissions when a user first opens the app after logging in:

1. **Camera** - Required for video calls and sharing photos
2. **Microphone** - Required for voice and video calls  
3. **Notifications** - Required to alert users of new messages and incoming calls

## How It Works

### Automatic Permission Request

The app uses a smart permission system that:

- ✅ Only requests permissions **once** (on first app launch after login)
- ✅ Only requests permissions that **haven't been granted yet**
- ✅ Shows a **user-friendly explanation** before requesting permissions
- ✅ Handles permission denials **gracefully**
- ✅ Provides an option to **open Settings** if permissions are denied

### User Experience Flow

1. User opens the app for the first time and logs in
2. After 1 second (to ensure UI is fully loaded), the app shows an explanation dialog
3. User can choose:
   - **Continue** - Proceeds to request permissions
   - **Not Now** - Skips permission requests
4. If user continues, the app requests each permission sequentially
5. If any permissions are denied, the app shows a dialog with an option to open Settings

### Permission Tracking

The app uses AsyncStorage to track whether permissions have been requested:
- Key: `permissions_requested`
- Value: `'true'` after first request

This ensures users are not repeatedly asked for permissions on every app launch.

## Files Added/Modified

### New Files

1. **`app/src/lib/permissions.ts`**
   - Core permission management utilities
   - Functions to check and request individual permissions
   - Function to request all permissions at once
   - User-friendly permission request with alerts

2. **`app/src/components/PermissionsInitializer.tsx`**
   - React component that handles permission initialization
   - Automatically runs when user logs in
   - Prevents duplicate permission requests

### Modified Files

1. **`app/App.tsx`**
   - Added import for `PermissionsInitializer`
   - Integrated component into the app tree

2. **`app/ios/Connect/Info.plist`**
   - Added `NSUserNotificationsUsageDescription` for iOS notification permissions

3. **`app/android/app/src/main/AndroidManifest.xml`**
   - Already had all necessary permissions declared
   - No changes needed

## Platform-Specific Behavior

### Android

- **Camera**: Uses `PERMISSIONS.ANDROID.CAMERA`
- **Microphone**: Uses `PERMISSIONS.ANDROID.RECORD_AUDIO`
- **Notifications**: 
  - Android 13+ (API 33+): Uses `PERMISSIONS.ANDROID.POST_NOTIFICATIONS`
  - Older versions: Notifications are granted by default

### iOS

- **Camera**: Uses `PERMISSIONS.IOS.CAMERA`
- **Microphone**: Uses `PERMISSIONS.IOS.MICROPHONE`
- **Notifications**: Uses Firebase Messaging permission request

## Manual Permission Request

If you need to manually request permissions (e.g., from a settings screen), you can use the `usePermissions` hook:

```tsx
import { usePermissions } from './src/components/PermissionsInitializer';

function SettingsScreen() {
  const { requestPermissions } = usePermissions();

  const handleRequestPermissions = async () => {
    const status = await requestPermissions();
    console.log('Permission status:', status);
  };

  return (
    <Button title="Request Permissions" onPress={handleRequestPermissions} />
  );
}
```

## API Reference

### `permissions.ts`

#### Functions

- `checkCameraPermission()` - Check if camera permission is granted
- `requestCameraPermission()` - Request camera permission
- `checkMicrophonePermission()` - Check if microphone permission is granted
- `requestMicrophonePermission()` - Request microphone permission
- `checkNotificationPermission()` - Check if notification permission is granted
- `requestNotificationPermission()` - Request notification permission
- `checkAllPermissions()` - Check status of all three permissions
- `requestAllPermissions()` - Request all three permissions (only those not granted)
- `requestAllPermissionsWithAlerts()` - Request all permissions with user-friendly dialogs
- `openAppSettings()` - Open the app's settings page

#### Types

```typescript
interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  notification: boolean;
}
```

### `PermissionsInitializer.tsx`

#### Props

```typescript
interface PermissionsInitializerProps {
  user: any; // User object - permissions only requested if user is logged in
  onPermissionsChecked?: (status: PermissionStatus) => void; // Optional callback
}
```

## Troubleshooting

### Permissions Not Being Requested

1. Check that the user is logged in
2. Check AsyncStorage - clear `permissions_requested` key to test again:
   ```javascript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   await AsyncStorage.removeItem('permissions_requested');
   ```

### Permission Dialogs Not Showing

1. Ensure platform-specific permission descriptions are in place:
   - Android: Check `AndroidManifest.xml`
   - iOS: Check `Info.plist` for usage descriptions

### Permission Denied

If a user denies permissions:
1. The app will show a dialog with an option to open Settings
2. User can manually grant permissions from device Settings
3. Restart the app for changes to take effect

## Testing

### To Test the Permission Flow

1. Uninstall the app from device/emulator
2. Clear AsyncStorage (or fresh install does this automatically)
3. Install and open the app
4. Log in with a test account
5. Wait 1 second - permission dialog should appear
6. Test both "Continue" and "Not Now" options

### To Reset Permission Requests

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Run this in a component or debug console
await AsyncStorage.removeItem('permissions_requested');
```

Then restart the app to see the permission request flow again.

## Dependencies

The permission system uses the following packages:

- `react-native-permissions@5.4.2` - Cross-platform permission management
- `@react-native-firebase/messaging@23.3.0` - Firebase Cloud Messaging for notifications
- `@notifee/react-native@9.1.8` - Local notification handling
- `@react-native-async-storage/async-storage@2.2.0` - Persistent storage

All dependencies are already installed in the project.

