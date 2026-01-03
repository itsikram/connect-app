# Codemagic Quick Start Checklist

## ✅ Pre-Build Checklist

- [ ] Codemagic account created
- [ ] Repository connected to Codemagic
- [ ] Keystore file (`connect-app.keystore`) ready
- [ ] Keystore credentials available (password, alias, key password)

## 🔧 Setup Steps (5 minutes)

### 1. Upload Keystore File
- Go to Codemagic → Your App → Environment variables
- Add variable: `CM_KEYSTORE_PATH`
- Upload your `connect-app.keystore` file
- Mark as **Secure**
- Copy the file path shown by Codemagic

### 2. Add Environment Variables
Create these 4 variables (all marked as **Secure**):

| Variable | Description | Example |
|----------|-------------|---------|
| `CM_KEYSTORE_PATH` | Path to uploaded keystore | `/tmp/keystore/connect-app.keystore` |
| `CM_KEYSTORE_PASSWORD` | Keystore password | `your-keystore-password` |
| `CM_KEY_ALIAS` | Key alias name | `connect-app` |
| `CM_KEY_PASSWORD` | Key password | `your-key-password` |

### 3. Create Environment Group (Optional but Recommended)
- Create group: `keystore_credentials`
- Add all 4 variables above to this group
- This makes management easier

### 4. Update Email in codemagic.yaml
Edit `codemagic.yaml` line 123:
```yaml
recipients:
  - your-email@example.com  # Replace this
```

## 🚀 Start Your First Build

1. Go to Codemagic → Your App
2. Click **Start new build**
3. Select branch (usually `main` or `master`)
4. Click **Start build**
5. Wait for build to complete (~10-15 minutes)
6. Download APK/AAB from build artifacts

## 📦 Build Outputs

After successful build, you'll get:
- **APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

## ❓ Common Issues

**Build fails with keystore error?**
- Verify all 4 environment variables are set
- Check keystore file was uploaded correctly
- Ensure passwords match your keystore

**Build succeeds but not signed?**
- Check build logs for signing warnings
- Verify `CM_KEYSTORE_PATH` points to correct file location
- Ensure all credentials are correct

**Need help?**
- See detailed guide: `CODEMAGIC_SETUP.md`
- Codemagic docs: https://docs.codemagic.io

