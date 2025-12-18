# Floating Overlay Button with Menu

This feature adds a floating button with your app logo that appears outside of your React Native app on Android. When clicked, it displays a menu with customizable options.

## Features

- ✅ Floating button with app logo
- ✅ Draggable button (can be moved around the screen)
- ✅ Click to show/hide menu
- ✅ Customizable menu options
- ✅ Menu item click events sent to React Native
- ✅ Smooth animations
- ✅ Works even when app is in background

## Setup

The floating overlay is already integrated. Here's how to use it:

### Option 1: Using the FloatingOverlayManager Component (Recommended)

Simply add the `FloatingOverlayManager` component to your `App.tsx`:

```tsx
import FloatingOverlayManager from './src/components/FloatingOverlayManager';

// Inside your App component
<AppWithTopProgress />
<FloatingOverlayManager enabled={true} />
```

### Option 2: Using the Hook Directly

If you need more control, use the `useFloatingOverlay` hook:

```tsx
import { useFloatingOverlay, MenuOption } from './src/hooks/useFloatingOverlay';

function MyComponent() {
  const menuOptions: MenuOption[] = [
    { id: 'home', label: 'Home' },
    { id: 'message', label: 'Messages' },
    { id: 'friends', label: 'Friends' },
    { id: 'profile', label: 'Profile' },
  ];

  const { start, stop, updateMenuOptions } = useFloatingOverlay({
    menuOptions,
    onMenuOptionClick: (optionId) => {
      console.log('Menu item clicked:', optionId);
      // Handle menu item clicks
      switch (optionId) {
        case 'home':
          navigation.navigate('Home');
          break;
        case 'message':
          navigation.navigate('Message');
          break;
        // ... other cases
      }
    },
    enabled: true,
  });

  useEffect(() => {
    start();
    return () => stop();
  }, []);
}
```

## Customizing Menu Options

You can customize the menu options by passing them to `FloatingOverlayManager`:

```tsx
const customMenuOptions: MenuOption[] = [
  { id: 'home', label: 'Home' },
  { id: 'videos', label: 'Videos' },
  { id: 'message', label: 'Messages' },
  { id: 'settings', label: 'Settings' },
];

<FloatingOverlayManager 
  enabled={true} 
  menuOptions={customMenuOptions}
/>
```

## Permissions

The app will automatically request the "Display over other apps" permission when you try to start the overlay. The user needs to grant this permission in Android settings.

## API Reference

### `useFloatingOverlay` Hook

```typescript
interface UseFloatingOverlayOptions {
  menuOptions?: MenuOption[];
  onMenuOptionClick?: (optionId: string) => void;
  enabled?: boolean;
}

const { start, stop, updateMenuOptions } = useFloatingOverlay(options);
```

- `start()`: Starts the floating overlay service
- `stop()`: Stops the floating overlay service
- `updateMenuOptions(options)`: Updates the menu options dynamically

### `MenuOption` Type

```typescript
interface MenuOption {
  id: string;      // Unique identifier for the menu item
  label: string;   // Display text for the menu item
  icon?: string;   // Optional icon (not yet implemented in UI)
}
```

## How It Works

1. The floating button appears as a system overlay on Android
2. Users can drag the button to reposition it
3. Tapping the button toggles the menu visibility
4. Menu items can trigger navigation or other actions in your React Native app
5. The overlay works even when the app is in the background

## Notes

- Currently only works on Android (iOS doesn't support system overlays)
- Requires "Display over other apps" permission
- The overlay runs as a foreground service to keep it active
- The button uses your app's launcher icon

## Troubleshooting

If the floating button doesn't appear:
1. Check that overlay permission is granted in Android settings
2. Make sure you called `start()` after permissions are granted
3. Check the console for any error messages
4. Verify the service is running: `adb shell service list | grep FloatingOverlayService`






