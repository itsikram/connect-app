# Toast Component Documentation

A professional, animated toast notification system for React Native with multiple types, smooth animations, and easy-to-use API.

## Features

- 🎨 **Multiple Types**: Success, Error, Warning, and Info toasts
- ✨ **Smooth Animations**: Slide-in/out with scale and opacity transitions
- 🎯 **Flexible Positioning**: Top or bottom positioning
- ⏱️ **Auto-dismiss**: Configurable duration with manual override
- 🔒 **Status Bar Aware**: Automatically adjusts for status bar height
- 🎭 **Theme Integration**: Uses your app's color scheme
- 📱 **Responsive Design**: Works on all screen sizes
- 🎪 **Easy API**: Simple hook-based usage

## Quick Start

### 1. Basic Usage

```tsx
import { useToast } from '../contexts/ToastContext';

const MyComponent = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleSuccess = () => {
    showSuccess('Operation completed successfully!');
  };

  const handleError = () => {
    showError('Something went wrong!');
  };

  return (
    <View>
      <Button onPress={handleSuccess} title="Show Success" />
      <Button onPress={handleError} title="Show Error" />
    </View>
  );
};
```

### 2. Advanced Usage

```tsx
const { showToast } = useToast();

// Custom toast with specific type and duration
showToast('Custom message', 'warning', 5000);

// Show toast without auto-dismiss
showToast('Important message', 'info', 0);
```

## API Reference

### useToast Hook

The `useToast` hook provides the following methods:

#### `showSuccess(message: string, duration?: number)`
Shows a success toast with green background and check icon.

#### `showError(message: string, duration?: number)`
Shows an error toast with red background and error icon.

#### `showWarning(message: string, duration?: number)`
Shows a warning toast with orange background and warning icon.

#### `showInfo(message: string, duration?: number)`
Shows an info toast with blue background and info icon.

#### `showToast(message: string, type: ToastType, duration?: number)`
Shows a custom toast with specified type and duration.

#### `hideToast()`
Manually hides the current toast.

### Toast Types

```tsx
type ToastType = 'success' | 'error' | 'warning' | 'info';
```

### Duration

- **Default**: 3000ms (3 seconds)
- **Success**: 3000ms
- **Error**: 4000ms (4 seconds)
- **Warning**: 3500ms (3.5 seconds)
- **Info**: 3000ms
- **Custom**: Any value in milliseconds
- **0**: No auto-dismiss (manual close only)

## Toast Component Props

```tsx
interface ToastProps {
  visible: boolean;           // Controls toast visibility
  message: string;            // Toast message text
  type?: ToastType;           // Toast type (default: 'info')
  duration?: number;          // Auto-dismiss duration in ms
  onHide?: () => void;       // Callback when toast hides
  position?: 'top' | 'bottom'; // Toast position (default: 'top')
  showIcon?: boolean;         // Show/hide icon (default: true)
  showCloseButton?: boolean;  // Show/hide close button (default: false)
}
```

## Examples

### Success Toast
```tsx
showSuccess('Profile updated successfully!');
```

### Error Toast with Custom Duration
```tsx
showError('Network connection failed. Please check your internet.', 6000);
```

### Warning Toast
```tsx
showWarning('Please save your changes before leaving.');
```

### Info Toast
```tsx
showInfo('New message received from John.');
```

### Custom Toast
```tsx
showToast('This is a custom message', 'warning', 8000);
```

## Integration Examples

### In Login Screen
```tsx
const handleLogin = async () => {
  try {
    await loginUser(credentials);
    showSuccess('Welcome back!');
    // Navigate to home
  } catch (error) {
    showError('Login failed. Please check your credentials.');
  }
};
```

### In Form Submission
```tsx
const handleSubmit = async () => {
  if (!isFormValid()) {
    showWarning('Please fill in all required fields.');
    return;
  }

  try {
    await submitForm(formData);
    showSuccess('Form submitted successfully!');
  } catch (error) {
    showError('Submission failed. Please try again.');
  }
};
```

### In API Calls
```tsx
const fetchData = async () => {
  try {
    const data = await api.getData();
    showSuccess('Data loaded successfully!');
    setData(data);
  } catch (error) {
    showError('Failed to load data. Please check your connection.');
  }
};
```

## Styling

The toast automatically uses your app's theme colors:

- **Success**: `colors.success` (#34C759)
- **Error**: `colors.error` (#FF3B30)
- **Warning**: `colors.warning` (#FF9500)
- **Info**: `colors.info` (#007AFF)

## Customization

### Modify Toast Appearance
Edit the `Toast.tsx` component to customize:
- Colors and themes
- Animation timing
- Shadow and elevation
- Border radius and padding
- Icon sizes and positioning

### Modify Toast Behavior
Edit the `ToastContext.tsx` to customize:
- Default durations
- Toast positioning
- Icon and close button visibility
- Animation behavior

## Best Practices

1. **Keep messages concise** - Toast messages should be brief and clear
2. **Use appropriate types** - Match the toast type to the message context
3. **Set reasonable durations** - Don't make toasts disappear too quickly
4. **Handle errors gracefully** - Always show error toasts for user feedback
5. **Don't overuse** - Reserve toasts for important notifications

## Troubleshooting

### Toast not showing?
- Ensure `ToastProvider` wraps your app
- Check that `useToast` is called within a component tree
- Verify the toast context is properly imported

### Toast positioning issues?
- The toast automatically adjusts for status bar height
- Check if your app has custom status bar handling
- Ensure proper z-index values

### Animation not working?
- Verify `useNativeDriver: true` is set in animations
- Check for any conflicting animation libraries
- Ensure React Native version compatibility

## Dependencies

- `react-native-vector-icons` - For toast icons
- Your app's theme colors (`../theme/colors`)

## Browser Compatibility

This component is designed for React Native and may not work in web environments without modifications.
