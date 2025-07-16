# Theme System

This project uses a centralized theme system for consistent colors, spacing, and typography.

## Primary Color

The primary color is set to `#007AFF` (iOS blue) and can be accessed through the theme system.

## How to Use

### 1. Import Colors
```typescript
import { colors } from '../theme/colors';
```

### 2. Use Primary Color
```typescript
// In components
<View style={{ backgroundColor: colors.primary }} />

// In styles
const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    color: colors.white,
  },
});
```

### 3. Available Colors

#### Primary Colors
- `colors.primary` - Main primary color (#007AFF)
- `colors.primaryLight` - Lighter variant (#4DA3FF)
- `colors.primaryDark` - Darker variant (#0056CC)

#### Secondary Colors
- `colors.secondary` - Secondary color (#5856D6)
- `colors.secondaryLight` - Lighter secondary (#8A8AFF)
- `colors.secondaryDark` - Darker secondary (#3A3A8C)

#### Neutral Colors
- `colors.white` - Pure white (#FFFFFF)
- `colors.black` - Pure black (#000000)
- `colors.gray` - Gray scale (50-900)

#### Status Colors
- `colors.success` - Success green (#34C759)
- `colors.warning` - Warning orange (#FF9500)
- `colors.error` - Error red (#FF3B30)
- `colors.info` - Info blue (#007AFF)

### 4. Changing Primary Color

To change the primary color for your entire app, simply update the `primary` value in `src/theme/colors.ts`:

```typescript
export const colors = {
  primary: '#YOUR_NEW_COLOR', // Change this line
  // ... rest of colors
};
```

### 5. Using with Components

The Logo component now uses the theme system:
```typescript
<Logo color={colors.primary} />
<Logo color={colors.secondary} />
```

### 6. Theme Export

For complete theme access (colors, spacing, typography, etc.):
```typescript
import theme from '../theme/theme';
```

## Benefits

- **Consistency**: All colors are defined in one place
- **Maintainability**: Easy to change colors across the entire app
- **Type Safety**: TypeScript support for color names
- **Scalability**: Easy to add new colors and theme properties 