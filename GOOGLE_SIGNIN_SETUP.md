# Google Sign-In Setup Guide

This guide will help you configure Google Sign-In for your React Native app.

## Prerequisites

1. A Google Cloud Console project
2. Firebase project (already configured)
3. Android and iOS apps registered in Firebase

## Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `connect-2c209`
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

## Step 2: Configure OAuth 2.0 Client IDs

### For Android:

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Select "Android" as application type
4. Enter the following details:
   - **Package name**: `com.connect.app`
   - **SHA-1 certificate fingerprint**: Get this by running:
     ```bash
     cd android
     ./gradlew signingReport
     ```
     Look for the SHA-1 fingerprint in the debug keystore section
5. Click "Create"
6. Copy the generated Client ID

### For iOS:

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Select "iOS" as application type
4. Enter the following details:
   - **Bundle ID**: `com.connect.app`
5. Click "Create"
6. Copy the generated Client ID

### For Web (Server-side verification):

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Select "Web application" as application type
4. Enter the following details:
   - **Name**: `Connect Web Client`
   - **Authorized redirect URIs**: Add your server domain if needed
5. Click "Create"
6. Copy the generated Client ID

## Step 3: Update Configuration Files

### Android Configuration:

1. Update `app/google-services.json` with OAuth client IDs:
   ```json
   {
     "project_info": {
       "project_number": "1081252279410",
       "project_id": "connect-2c209",
       "storage_bucket": "connect-2c209.firebasestorage.app"
     },
     "client": [
       {
         "client_info": {
           "mobilesdk_app_id": "1:1081252279410:android:57917ff2248eebc1d5feeb",
           "android_client_info": {
             "package_name": "com.connect.app"
           }
         },
         "oauth_client": [
           {
             "client_id": "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
             "client_type": 1,
             "android_info": {
               "package_name": "com.connect.app",
               "certificate_hash": "YOUR_SHA1_FINGERPRINT"
             }
           },
           {
             "client_id": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
             "client_type": 3
           }
         ],
         "api_key": [
           {
             "current_key": "AIzaSyDVQnlVNHHlgfh9vtNX_rV9aFSaC3Vd8sw"
           }
         ],
         "services": {
           "appinvite_service": {
             "other_platform_oauth_client": []
           }
         }
       }
     ],
     "configuration_version": "1"
   }
   ```

2. Update `app/src/services/googleAuth.ts`:
   ```typescript
   GoogleSignin.configure({
     webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with your web client ID
     offlineAccess: true,
     hostedDomain: '',
     forceCodeForRefreshToken: true,
   });
   ```

### iOS Configuration:

1. Update `app/ios/Connect/GoogleService-Info.plist`:
   - Replace `YOUR_IOS_CLIENT_ID` with your actual iOS OAuth client ID
   - Replace `YOUR_IOS_APP_ID` with your actual iOS app ID

2. Add the GoogleService-Info.plist to your Xcode project:
   - Open `ios/Connect.xcworkspace` in Xcode
   - Right-click on the "Connect" folder
   - Select "Add Files to Connect"
   - Choose the `GoogleService-Info.plist` file
   - Make sure "Copy items if needed" is checked
   - Click "Add"

3. Update `app/ios/Connect/Info.plist` to add URL schemes:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLName</key>
       <string>REVERSED_CLIENT_ID</string>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>com.googleusercontent.apps.1081252279410-YOUR_IOS_CLIENT_ID</string>
       </array>
     </dict>
   </array>
   ```

## Step 4: Environment Variables

Add the following environment variables to your server:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

## Step 5: Test the Implementation

1. Build and run your app on both Android and iOS
2. Try the Google Sign-In button on both Login and Register screens
3. Check the server logs for any authentication errors
4. Verify that user accounts are created correctly in your database

## Troubleshooting

### Common Issues:

1. **"Sign-in failed" error**: Check that OAuth client IDs are correctly configured
2. **"Invalid client" error**: Verify the web client ID in the Google configuration
3. **iOS build errors**: Ensure GoogleService-Info.plist is properly added to Xcode project
4. **Android SHA-1 mismatch**: Make sure the SHA-1 fingerprint matches the one in Google Console

### Debug Steps:

1. Check console logs for detailed error messages
2. Verify network connectivity
3. Ensure Firebase project is properly configured
4. Check that all required APIs are enabled in Google Cloud Console

## Security Notes

- Never commit OAuth client IDs to public repositories
- Use environment variables for sensitive configuration
- Regularly rotate API keys and certificates
- Monitor authentication logs for suspicious activity

## Next Steps

After successful setup:
1. Test with multiple Google accounts
2. Implement proper error handling
3. Add loading states for better UX
4. Consider implementing Google Sign-In for existing users
5. Set up proper logging and monitoring
