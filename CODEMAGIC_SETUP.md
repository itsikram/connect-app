# Codemagic Cloud Build Setup Guide

This guide will help you set up Codemagic for cloud building your React Native Android app.

## Prerequisites

1. A Codemagic account (sign up at https://codemagic.io)
2. Your Android keystore file (`connect-app.keystore`)
3. Keystore credentials (password, key alias, key password)

## Step 1: Upload Keystore to Codemagic

1. Log in to your Codemagic account
2. Go to your app settings (or team settings for shared variables)
3. Navigate to **Environment variables** section
4. Upload your `connect-app.keystore` file:
   - Click **Add variable**
   - Name: `CM_KEYSTORE_PATH`
   - Value: Click **Upload file** and select your `connect-app.keystore` file
   - Codemagic will store the file and provide a path (usually something like `/tmp/keystore/connect-app.keystore`)
   - Mark as **Secure** (this encrypts the file)
   - **Important**: After uploading, Codemagic will show you the file path. Use this exact path as the value for `CM_KEYSTORE_PATH`

## Step 2: Set Up Environment Variables

Create the following environment variables in Codemagic UI:

### Required Environment Variables

1. **CM_KEYSTORE_PATH**
   - Value: The path where Codemagic stores your uploaded keystore file
   - Usually: `/tmp/keystore/connect-app.keystore` or similar
   - Mark as **Secure**

2. **CM_KEYSTORE_PASSWORD**
   - Value: Your keystore password
   - Mark as **Secure**

3. **CM_KEY_ALIAS**
   - Value: Your key alias (e.g., `connect-app` or the alias you used when creating the keystore)
   - Mark as **Secure**

4. **CM_KEY_PASSWORD**
   - Value: Your key password (may be the same as keystore password)
   - Mark as **Secure**

### Optional Environment Variables

- **ANDROID_PACKAGE**: `com.connect.app` (already set in codemagic.yaml)
- **NODE_ENV**: `production` (already set in codemagic.yaml)

## Step 3: Create Environment Variable Group

1. In Codemagic UI, go to **Teams** → **Groups**
2. Create a new group called `keystore_credentials`
3. Add all four keystore-related variables to this group:
   - `CM_KEYSTORE_PATH`
   - `CM_KEYSTORE_PASSWORD`
   - `CM_KEY_ALIAS`
   - `CM_KEY_PASSWORD`
4. This group is referenced in `codemagic.yaml` for easy management

## Step 4: Configure Build Settings

1. Connect your repository to Codemagic:
   - Go to **Applications** → **Add application**
   - Select your Git provider (GitHub, GitLab, Bitbucket, etc.)
   - Choose your repository

2. Codemagic will automatically detect the `codemagic.yaml` file in the `app` directory

3. Make sure the build configuration points to the correct directory:
   - The `codemagic.yaml` is located in the `app` directory
   - Codemagic should automatically detect it

## Step 5: Update Email Notification

Edit `codemagic.yaml` and replace the email address:

```yaml
publishing:
  email:
    recipients:
      - your-email@example.com  # Replace with your email
```

## Step 6: Build Configuration Details

The current setup includes:

- **Node.js**: 18.20.0
- **Java**: Temurin 11
- **Instance**: Mac Mini M1 (for Android builds)
- **Build outputs**:
  - APK: `android/app/build/outputs/apk/release/app-release.apk`
  - AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Step 7: Running Your First Build

1. Go to your app in Codemagic
2. Click **Start new build**
3. Select the branch you want to build
4. Click **Start build**

The build will:
- Install dependencies
- Set up Android SDK
- Configure keystore signing
- Build both APK and AAB files
- Send email notification on completion

## Troubleshooting

### Build Fails with "Keystore not found"

- Verify that `CM_KEYSTORE_PATH` points to the correct location
- Check that the keystore file was uploaded correctly
- Ensure the path in the environment variable matches where Codemagic stores the file

### Build Fails with "Invalid keystore password"

- Double-check `CM_KEYSTORE_PASSWORD` value
- Ensure there are no extra spaces or special characters
- Verify the password matches the one used when creating the keystore

### Build Fails with "Key alias not found"

- Verify `CM_KEY_ALIAS` matches the alias used when creating the keystore
- You can check your keystore aliases using:
  ```bash
  keytool -list -v -keystore connect-app.keystore
  ```

### Build Succeeds but APK/AAB Not Signed

- Check that all four keystore environment variables are set
- Verify the keystore file is accessible at the specified path
- Review build logs for signing-related errors

## Google Play Publishing (Optional)

To automatically publish to Google Play, uncomment and configure the `google_play` section in `codemagic.yaml`:

1. Create a Google Play service account
2. Download the JSON credentials
3. Add it as an environment variable `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` in Codemagic
4. Uncomment the `google_play` section in `codemagic.yaml`

## Additional Notes

- The build uses release signing configuration from `android/app/build.gradle`
- Both APK and AAB files are generated for maximum compatibility
- Build artifacts are automatically saved and can be downloaded from Codemagic UI
- Email notifications are sent on both success and failure

## Support

For more information, visit:
- Codemagic Documentation: https://docs.codemagic.io
- React Native Android Build: https://reactnative.dev/docs/signed-apk-android

