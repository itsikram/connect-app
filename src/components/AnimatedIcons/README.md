# Animated Tab Icons

This directory contains animated SVG icons for your bottom tab bar, providing smooth transitions and engaging visual feedback.

## Features

- **Smooth Animations**: Scale, rotate, and pulse effects
- **Dynamic Colors**: Icons change color based on active/inactive state
- **Glow Effects**: Subtle glow and ripple animations for active tabs
- **Performance Optimized**: Uses native driver for smooth 60fps animations
- **Theme Integration**: Automatically adapts to your app's theme colors

## Available Icons

- **Home**: `home.svg` - House icon with door and windows
- **Friends**: `friends.svg` - Two people figures with heart connection
- **Videos**: `videos.svg` - Play button with recording indicator
- **Message**: `message.svg` - Chat bubble with typing dots
- **Menu**: `menu.svg` - Circle with hamburger menu lines

## Usage

The animated icons are automatically integrated into your `ProfessionalTabBar` component. Here's how they work:

### Automatic Integration

```tsx
// In your ProfessionalTabBar.tsx
import AnimatedTabIcon from './AnimatedIcons/AnimatedTabIcon';
import HomeIcon from '../assets/icons/home.svg';
import FriendsIcon from '../assets/icons/friends.svg';
// ... other imports

// Icons are automatically mapped by tab name
const getAnimatedIcon = (tabName: string) => {
  switch (tabName) {
    case 'Home': return HomeIcon;
    case 'Friends': return FriendsIcon;
    // ... other cases
  }
};
```

### Manual Usage

You can also use the animated icons directly:

```tsx
import AnimatedTabIcon from './AnimatedIcons/AnimatedTabIcon';
import HomeIcon from '../assets/icons/home.svg';

const MyComponent = () => {
  const [isActive, setIsActive] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  return (
    <AnimatedTabIcon
      iconSource={HomeIcon}
      size={24}
      isActive={isActive}
      animatedValue={animatedValue}
    />
  );
};
```

## Animation Properties

### Scale Animation
- Inactive: 1.0x scale
- Active: 1.15x scale
- Pulse: 1.0x ↔ 1.1x (when active)

### Rotation Animation
- Inactive: 0° rotation
- Active: 5° rotation (subtle tilt effect)

### Opacity Animation
- Inactive: 60% opacity
- Active: 100% opacity

### Color Animation
- Inactive: Theme gray color
- Active: Theme primary color

## Customization

### Adding New Icons

1. Create your SVG file in `src/assets/icons/`
2. Import it in `ProfessionalTabBar.tsx`
3. Add it to the `getAnimatedIcon` mapping

Example:
```tsx
import NewIcon from '../assets/icons/new-icon.svg';

const getAnimatedIcon = (tabName: string) => {
  switch (tabName) {
    // ... existing cases
    case 'NewTab': return NewIcon;
  }
};
```

### Modifying Animations

Edit `AnimatedTabIcon.tsx` to customize:

- **Animation Duration**: Change `duration` values in timing animations
- **Scale Values**: Modify `outputRange` in scale interpolation
- **Colors**: Adjust theme color references
- **Effects**: Add/remove glow, ripple, or pulse effects

## Performance Notes

- All animations use `useNativeDriver: true` for optimal performance
- SVG icons are lightweight and scalable
- Animation cleanup is handled automatically
- Memory efficient with proper cleanup in useEffect

## Troubleshooting

### Icons Not Showing
1. Ensure `react-native-svg` is installed
2. Check metro.config.js has SVG transformer configured
3. Verify SVG files exist in correct directory

### Animation Issues
1. Check that `animatedValue` prop is provided
2. Ensure `isActive` state updates correctly
3. Verify theme context is available

### TypeScript Errors
1. Check `src/types/svg.d.ts` exists
2. Ensure SVG module declarations are correct
3. Verify import paths are accurate

## Dependencies

- `react-native-svg` (v15.12.1)
- `react-native-svg-transformer` (configured in metro.config.js)
- Theme context for color integration
