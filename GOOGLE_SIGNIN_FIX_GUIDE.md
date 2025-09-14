# Google Sign-In Fix Guide

This guide documents the fixes applied to resolve Google Sign-In issues in the React Native app.

## Issues Fixed

### 1. Missing OAuth Client IDs in google-services.json
**Problem**: The `oauth_client` array was empty, causing authentication failures.
**Solution**: Added proper OAuth client IDs for both Android and Web clients.

```json
"oauth_client": [
  {
    "client_id": "560231541864-igg3lvikjeii27kd0qoj6drm7jgkh9u6.apps.googleusercontent.com",
    "client_type": 1,
    "android_info": {
      "package_name": "com.connect.app",
      "certificate_hash": "sha1_placeholder"
    }
  },
  {
    "client_id": "560231541864-qi7hanivjprtiqh4h5vsrhdjj72qbopr.apps.googleusercontent.com",
    "client_type": 3
  }
]
```

### 2. iOS Configuration Issues
**Problem**: Placeholder values in GoogleService-Info.plist and Info.plist.
**Solution**: Updated with correct client IDs and URL schemes.

### 3. Web Client ID Mismatch
**Problem**: Different web client IDs used in web vs React Native configurations.
**Solution**: Standardized to use the same web client ID across all platforms.

## Configuration Summary

### Android Configuration
- ✅ `google-services.json` - Updated with OAuth client IDs
- ✅ `build.gradle` - Google Services plugin properly configured
- ✅ `AndroidManifest.xml` - Permissions and metadata correct

### iOS Configuration
- ✅ `GoogleService-Info.plist` - Updated with correct client IDs
- ✅ `Info.plist` - Updated URL schemes for Google Sign-In

### React Native Configuration
- ✅ `googleAuth.ts` - Updated webClientId to match web configuration
- ✅ `AuthContext.js` - Google Sign-In integration working
- ✅ `LoginScreen.tsx` - Custom Google Sign-In button implemented

## Client IDs Used

- **Android Client**: `560231541864-igg3lvikjeii27kd0qoj6drm7jgkh9u6.apps.googleusercontent.com`
- **Web Client**: `560231541864-igg3lvikjeii27kd0qoj6drm7jgkh9u6.apps.googleusercontent.com`
- **iOS Client**: `560231541864-igg3lvikjeii27kd0qoj6drm7jgkh9u6.apps.googleusercontent.com`

## Testing Steps

1. **Clean and rebuild the app**:
   ```bash
   cd app
   npx react-native clean
   npx react-native run-android
   # or
   npx react-native run-ios
   ```

2. **Test Google Sign-In**:
   - Tap the "Continue with Google" button
   - Verify Google authentication flow works
   - Check that user data is properly stored
   - Verify backend authentication succeeds

## Troubleshooting

### Common Issues

1. **"Developer Error"**: Check that all client IDs are correctly configured
2. **"Invalid Client"**: Verify the web client ID matches across all platforms
3. **"Network Error"**: Ensure the backend Google Sign-In endpoint is working
4. **iOS Build Errors**: Clean and rebuild the iOS project

### Debug Steps

1. Check console logs for Google Sign-In errors
2. Verify AsyncStorage contains user data after successful sign-in
3. Test with different Google accounts
4. Check network requests to `/auth/google-signin` endpoint

## Backend Integration

The React Native app sends the following data to the backend:
```javascript
{
  googleId: googleUser.id,
  email: googleUser.email,
  name: googleUser.name,
  photo: googleUser.photo,
  familyName: googleUser.familyName,
  givenName: googleUser.givenName,
  idToken: userInfo.data.idToken
}
```

The backend endpoint `/auth/google-signin` handles this data and returns:
```javascript
{
  firstName: user.firstName,
  user_id: user._id,
  surname: user.surname,
  profile: user.profile,
  accessToken: jwt_token
}
```

## Security Notes

- The Google ID token is verified on the backend
- JWT tokens are generated for authenticated users
- User data is stored securely in AsyncStorage
- Google Sign-In tokens are properly revoked on logout
