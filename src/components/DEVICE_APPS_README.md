# Device Apps Integration

This document explains how to use the enhanced AppGrid component to display and launch device apps.

## Overview

The AppGrid component has been enhanced to support displaying all installed apps on the device. This feature allows users to:

- View all installed apps in a grid layout
- Launch apps directly from the grid
- Get proper app icons and colors for popular apps
- Handle permission requests gracefully

## Components

### 1. AppGrid Component

The main component that can display both custom apps and device apps.

**Props:**
- `apps?: AppItem[]` - Array of custom apps (optional when showing device apps)
- `title?: string` - Title for the grid section
- `columns?: number` - Number of columns in the grid (default: 4)
- `showDeviceApps?: boolean` - Whether to show device apps (default: false)

**Example Usage:**

```tsx
// Show custom apps
<AppGrid
  apps={sampleApps}
  title="Quick Apps"
  columns={4}
/>

// Show device apps
<AppGrid
  showDeviceApps={true}
  title="Installed Apps"
  columns={4}
/>
```

### 2. DeviceAppsGrid Component

A specialized wrapper component that automatically shows device apps.

**Props:**
- `title?: string` - Title for the grid section
- `columns?: number` - Number of columns in the grid

**Example Usage:**

```tsx
<DeviceAppsGrid
  title="My Apps"
  columns={3}
/>
```

### 3. DeviceAppsService

A service class that handles fetching and managing device apps.

**Key Methods:**
- `getInstalledApps()` - Get all installed apps
- `convertToAppItem(deviceApp)` - Convert device app to AppItem format
- `launchApp(packageName)` - Launch an app by package name
- `getDeviceAppsForGrid()` - Get formatted apps for the grid
- `hasPermission()` - Check if permission is granted

## AppItem Interface

The AppItem interface has been extended to support device apps:

```typescript
interface AppItem {
  id: string;
  name: string;
  icon?: string;
  logo?: string;
  color?: string;
  onPress?: () => void;
  packageName?: string; // For device apps
  isDeviceApp?: boolean; // Flag to identify device apps
}
```

## Features

### 1. App Icon Mapping

Popular apps have predefined icons and colors for better visual representation:

- WhatsApp: Message icon, green color
- Instagram: Camera icon, pink color
- YouTube: Play icon, red color
- And many more...

### 2. Permission Handling

The component gracefully handles permission requests:

- Shows loading state while checking permissions
- Displays error message if permission is denied
- Provides retry button to request permission again

### 3. App Launching

Device apps can be launched directly:

- Tapping a device app launches it using the package name
- Custom apps use their defined onPress handlers
- Error handling for failed app launches

## Permissions

### Android

Add the following permission to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
```

**Note:** This permission is required for Android 11+ to query installed packages.

## Installation

The following package is required:

```bash
npm install react-native-installed-apps
```

## Usage Examples

### Basic Device Apps Grid

```tsx
import DeviceAppsGrid from './components/DeviceAppsGrid';

const MyScreen = () => {
  return (
    <DeviceAppsGrid
      title="My Apps"
      columns={4}
    />
  );
};
```

### Combined Custom and Device Apps

```tsx
import AppGrid from './components/AppGrid';
import { sampleApps } from './data/appData';

const MyScreen = () => {
  return (
    <View>
      {/* Custom apps */}
      <AppGrid
        apps={sampleApps}
        title="Quick Apps"
        columns={4}
      />
      
      {/* Device apps */}
      <AppGrid
        showDeviceApps={true}
        title="Installed Apps"
        columns={4}
      />
    </View>
  );
};
```

### Dynamic App Loading

```tsx
import React, { useState, useEffect } from 'react';
import { DeviceAppsService } from './services/DeviceAppsService';

const MyScreen = () => {
  const [deviceApps, setDeviceApps] = useState([]);

  useEffect(() => {
    const loadApps = async () => {
      const apps = await DeviceAppsService.getDeviceAppsForGrid();
      setDeviceApps(apps);
    };
    
    loadApps();
  }, []);

  return (
    <AppGrid
      apps={deviceApps}
      title="My Device Apps"
      columns={4}
    />
  );
};
```

## Troubleshooting

### Permission Issues

If you're getting permission errors:

1. Ensure `QUERY_ALL_PACKAGES` permission is added to AndroidManifest.xml
2. For Android 11+, this permission is required
3. The app will show an error message and retry button if permission is denied

### App Not Launching

If apps are not launching:

1. Check if the app is installed on the device
2. Verify the package name is correct
3. Some system apps may not be launchable

### Performance

For devices with many installed apps:

1. Consider limiting the number of apps displayed
2. Add pagination or search functionality
3. Cache the app list to avoid repeated fetching

## Customization

### Custom App Icons

To add custom icons for specific apps, modify the `APP_ICON_MAP` in `DeviceAppsService.ts`:

```typescript
const APP_ICON_MAP: { [key: string]: string } = {
  'com.your.custom.app': 'your-icon-name',
  // ... existing mappings
};
```

### Custom App Colors

To add custom colors for specific apps, modify the `APP_COLOR_MAP` in `DeviceAppsService.ts`:

```typescript
const APP_COLOR_MAP: { [key: string]: string } = {
  'com.your.custom.app': '#your-hex-color',
  // ... existing mappings
};
```
