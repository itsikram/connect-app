# Device Apps in Menu - Usage Guide

## ✅ Current Implementation

Your Menu screen now shows device apps! Here are the different ways you can display them:

### Option 1: Separate Sections (Currently Active)
```tsx
// Custom apps section
<AppGrid 
  apps={sampleApps.map(app => ({
    ...app,
    onPress: () => handleAppPress(app)
  }))} 
  title="Quick Apps"
  columns={4}
/>

// Device apps section
<DeviceAppsGrid 
  title="Installed Apps"
  columns={4}
/>
```

**Result:** Two separate sections - "Quick Apps" and "Installed Apps"

### Option 2: Mixed Apps with Tabs
To use this approach, comment out Option 1 and uncomment Option 2 in Menu.tsx:

```tsx
<MixedAppsGrid 
  title="Apps"
  columns={4}
  showCustomApps={true}
  showDeviceApps={true}
  maxDeviceApps={24}
/>
```

**Result:** Single section with tabs: "All Apps", "Quick Apps", "Installed"

## 🚀 Quick Switch Between Options

### To switch to Mixed Apps with tabs:
1. Comment out the current Option 1 code (lines 94-106)
2. Uncomment Option 2 code (lines 109-117)

### To switch back to separate sections:
1. Comment out Option 2 code
2. Uncomment Option 1 code

## 📱 What Users Will See

### With Current Setup (Separate Sections):
- **Quick Apps**: Your custom apps (Ludu, WhatsApp, Instagram, etc.)
- **Installed Apps**: All device apps with proper icons and colors

### With Mixed Apps:
- **All Apps tab**: Both custom and device apps together
- **Quick Apps tab**: Only your custom apps
- **Installed tab**: Only device apps

## 🎨 Features Available

- ✅ Device apps show with proper icons and colors
- ✅ Tap any device app to launch it
- ✅ Permission handling with error messages
- ✅ Loading states while fetching apps
- ✅ Filtering (excludes system apps and your app)
- ✅ Alphabetical sorting
- ✅ Responsive grid layout

## 🔧 Customization

You can customize the display by modifying:

1. **Number of columns**: Change `columns={4}` to `columns={3}` or `columns={5}`
2. **Titles**: Change `title="Installed Apps"` to your preferred text
3. **Max device apps**: Change `maxDeviceApps={24}` to limit how many device apps show

## 🚨 Important Notes

- The app needs the `QUERY_ALL_PACKAGES` permission (already added to AndroidManifest.xml)
- On Android 11+, this permission is required
- If permission is denied, users will see an error message with a retry button
- Device apps are limited to prevent UI overload (default: 24 apps max)

## 🔄 Testing

To test the functionality:
1. Run the app on an Android device
2. Navigate to the Menu screen
3. Scroll down to see both "Quick Apps" and "Installed Apps" sections
4. Tap any device app to launch it
5. If you get permission errors, grant the permission and retry

Your device apps should now be visible and launchable from the Menu screen!
