# Theme System

This app now includes a comprehensive theme system that allows users to choose from multiple theme options and customize their app experience.

## Available Themes

1. **Default (System)** - Follows your device's system theme (light/dark)
2. **Light** - Clean, bright interface
3. **Dark** - Easy on the eyes in low light
4. **Blue** - Calming blue color scheme
5. **Green** - Natural, eco-friendly theme
6. **Purple** - Creative, artistic theme

## How to Use

### 1. Access Theme Settings
- Navigate to **Menu** → **Settings**
- You'll see a theme selection interface with all available themes

### 2. Change Themes
- Tap on any theme card to select it
- The selected theme will be highlighted with a checkmark
- Use the "Quick Toggle" button to quickly switch between light and dark themes

### 3. Theme Persistence
- Your theme choice is automatically saved and will persist across app restarts
- The theme is stored locally on your device

## For Developers

### Using the Theme Context

```tsx
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { colors: themeColors, isDarkMode, currentTheme, setTheme } = useTheme();
  
  return (
    <View style={{ backgroundColor: themeColors.background.primary }}>
      <Text style={{ color: themeColors.text.primary }}>
        Hello World
      </Text>
    </View>
  );
};
```

### Available Theme Properties

Each theme provides these color categories:

- `primary` - Main brand color
- `secondary` - Secondary brand color
- `background.primary` - Main background
- `background.secondary` - Secondary background
- `background.tertiary` - Tertiary background
- `surface.primary` - Main surface color
- `surface.secondary` - Secondary surface
- `surface.elevated` - Elevated surface
- `text.primary` - Primary text color
- `text.secondary` - Secondary text color
- `text.tertiary` - Tertiary text color
- `text.inverse` - Inverse text color
- `border.primary` - Primary border color
- `border.secondary` - Secondary border color
- `border.focus` - Focus border color
- `status.success` - Success color
- `status.warning` - Warning color
- `status.error` - Error color
- `status.info` - Info color
- `gray[50-900]` - Gray scale colors

### Adding New Themes

To add a new theme, update the `themes` object in `colors.ts`:

```tsx
export const themes = {
  // ... existing themes
  newTheme: {
    primary: '#your-color',
    secondary: '#your-color',
    background: {
      primary: '#your-color',
      secondary: '#your-color',
      tertiary: '#your-color',
    },
    // ... other properties
  },
} as const;
```

### Theme Context API

- `currentTheme` - Current selected theme
- `setTheme(theme)` - Set a specific theme
- `isDarkMode` - Boolean indicating if dark mode is active
- `colors` - Current theme's color palette
- `toggleTheme()` - Toggle between light and dark themes

## Implementation Notes

- The theme system uses React Context for global state management
- Themes are persisted using AsyncStorage
- The system automatically handles system theme changes when using "Default" theme
- All components should use the theme context instead of hardcoded colors
- The theme system is fully compatible with React Native's built-in dark mode detection 