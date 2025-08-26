# UserToast Component Documentation

A professional, user-focused toast notification system that displays user profile pictures, full names, and messages with beautiful animations and interactive features.

## Features

- 👤 **User Profile Display**: Shows profile picture, full name, and message
- 🎨 **Multiple Types**: Message, Friend Request, Notification, and Custom toasts
- ✨ **Smooth Animations**: Slide-in/out with scale and opacity transitions
- 🎯 **Interactive**: Tap to navigate to relevant screens
- 🖼️ **Image Handling**: Profile picture with fallback for missing images
- ⏱️ **Auto-dismiss**: Configurable duration with manual override
- 🔒 **Status Bar Aware**: Automatically adjusts for status bar height
- 🎭 **Theme Integration**: Uses your app's color scheme
- 📱 **Responsive Design**: Works on all screen sizes

## Quick Start

### 1. Basic Usage

```tsx
import { useUserToast } from '../contexts/UserToastContext';

const MyComponent = () => {
  const { showMessageToast } = useUserToast();
  
  const handleNewMessage = () => {
    showMessageToast({
      userProfilePic: 'https://example.com/profile.jpg',
      fullName: 'John Doe',
      message: 'Hey! How are you doing?',
      onPress: () => {
        // Navigate to chat
        navigation.navigate('Chat', { userId: '123' });
      },
    });
  };
};
```

### 2. Different Toast Types

```tsx
const { 
  showMessageToast, 
  showFriendRequestToast, 
  showNotificationToast 
} = useUserToast();

// Message toast
showMessageToast({
  userProfilePic: user.profilePic,
  fullName: user.name,
  message: user.message,
  onPress: () => navigateToChat(user.id),
});

// Friend request toast
showFriendRequestToast({
  userProfilePic: user.profilePic,
  fullName: user.name,
  onPress: () => navigateToFriendRequests(),
});

// Notification toast
showNotificationToast({
  userProfilePic: user.profilePic,
  fullName: user.name,
  message: `${user.name} liked your post`,
  onPress: () => navigateToPost(postId),
});
```

## API Reference

### useUserToast Hook

The `useUserToast` hook provides the following methods:

#### `showUserToast(userData)`
Shows a custom user toast with full configuration options.

**Parameters:**
- `userData.userProfilePic?: string` - User's profile picture URL
- `userData.fullName: string` - User's full name
- `userData.message: string` - Toast message
- `userData.type?: 'message' | 'friend' | 'notification' | 'custom'` - Toast type
- `userData.duration?: number` - Auto-dismiss duration in milliseconds
- `userData.onPress?: () => void` - Callback when toast is tapped

#### `showMessageToast(userData)`
Shows a message toast optimized for chat notifications.

**Parameters:**
- `userData.userProfilePic?: string` - User's profile picture URL
- `userData.fullName: string` - User's full name
- `userData.message: string` - Message content
- `userData.onPress?: () => void` - Callback when toast is tapped

#### `showFriendRequestToast(userData)`
Shows a friend request toast with appropriate styling.

**Parameters:**
- `userData.userProfilePic?: string` - User's profile picture URL
- `userData.fullName: string` - User's full name
- `userData.message?: string` - Optional custom message
- `userData.onPress?: () => void` - Callback when toast is tapped

#### `showNotificationToast(userData)`
Shows a notification toast for general user notifications.

**Parameters:**
- `userData.userProfilePic?: string` - User's profile picture URL
- `userData.fullName: string` - User's full name
- `userData.message: string` - Notification message
- `userData.onPress?: () => void` - Callback when toast is tapped

#### `hideUserToast()`
Manually hides the current user toast.

## Toast Types and Styling

### Message Toast
- **Background**: Primary color (`colors.primary`)
- **Icon**: Message icon
- **Duration**: 5 seconds
- **Use Case**: New messages, chat notifications

### Friend Request Toast
- **Background**: Secondary color (`colors.secondary`)
- **Icon**: Person-add icon
- **Duration**: 6 seconds
- **Use Case**: Friend requests, connection requests

### Notification Toast
- **Background**: Info color (`colors.info`)
- **Icon**: Notifications icon
- **Duration**: 4 seconds
- **Use Case**: Likes, comments, general notifications

### Custom Toast
- **Background**: Dark gray (`colors.gray[800]`)
- **Icon**: Info icon
- **Duration**: Configurable
- **Use Case**: Custom user notifications

## Integration Examples

### In Chat/Messaging System

```tsx
const handleNewMessage = (message: any) => {
  showMessageToast({
    userProfilePic: message.sender.profilePic,
    fullName: message.sender.fullName,
    message: message.content,
    onPress: () => {
      navigation.navigate('Chat', { 
        userId: message.sender.id,
        chatId: message.chatId 
      });
    },
  });
};
```

### In Friend Request System

```tsx
const handleFriendRequest = (request: any) => {
  showFriendRequestToast({
    userProfilePic: request.sender.profilePic,
    fullName: request.sender.fullName,
    onPress: () => {
      navigation.navigate('FriendRequests');
    },
  });
};
```

### In Social Media Notifications

```tsx
const handlePostLike = (like: any) => {
  showNotificationToast({
    userProfilePic: like.user.profilePic,
    fullName: like.user.fullName,
    message: `${like.user.fullName} liked your post`,
    onPress: () => {
      navigation.navigate('Post', { postId: like.postId });
    },
  });
};
```

### In Socket/Real-time Events

```tsx
useEffect(() => {
  socket.on('newMessage', (data) => {
    showMessageToast({
      userProfilePic: data.sender.profilePic,
      fullName: data.sender.fullName,
      message: data.message,
      onPress: () => navigateToChat(data.sender.id),
    });
  });

  socket.on('friendRequest', (data) => {
    showFriendRequestToast({
      userProfilePic: data.sender.profilePic,
      fullName: data.sender.fullName,
      onPress: () => navigateToFriendRequests(),
    });
  });
}, []);
```

## Profile Picture Handling

### With Profile Picture
```tsx
showMessageToast({
  userProfilePic: 'https://example.com/profile.jpg',
  fullName: 'John Doe',
  message: 'Hello!',
});
```

### Without Profile Picture (Fallback)
```tsx
showMessageToast({
  fullName: 'John Doe', // No profilePic - will show default avatar
  message: 'Hello!',
});
```

The component automatically handles missing profile pictures by showing a default avatar with the user's initial.

## Customization

### Modify Toast Appearance
Edit the `UserToast.tsx` component to customize:
- Colors and themes for different types
- Animation timing and easing
- Shadow and elevation effects
- Border radius and padding
- Icon sizes and positioning
- Profile picture dimensions

### Modify Toast Behavior
Edit the `UserToastContext.tsx` to customize:
- Default durations for different types
- Toast positioning
- Close button visibility
- Animation behavior

## Best Practices

1. **Use Appropriate Types**: Match toast type to the notification context
2. **Keep Messages Concise**: Toast messages should be brief and clear
3. **Provide Navigation**: Always include `onPress` for actionable toasts
4. **Handle Missing Data**: The component gracefully handles missing profile pictures
5. **Don't Overuse**: Reserve user toasts for important user interactions
6. **Consistent Timing**: Use appropriate durations for different notification types

## Troubleshooting

### Toast not showing?
- Ensure `UserToastProvider` wraps your app
- Check that `useUserToast` is called within the provider tree
- Verify the context is properly imported

### Profile picture not loading?
- Check the image URL is accessible
- The component will show a default avatar if the image fails to load
- Ensure proper image dimensions and format

### Navigation not working?
- Verify the `onPress` callback is properly defined
- Check that navigation functions are available in the component
- Ensure the callback doesn't throw errors

### Animation issues?
- Verify `useNativeDriver: true` is set in animations
- Check for conflicting animation libraries
- Ensure React Native version compatibility

## Dependencies

- `react-native-vector-icons` - For toast icons
- Your app's theme colors (`../theme/colors`)
- React Native's `Image` component for profile pictures

## Performance Considerations

- Profile pictures are loaded asynchronously
- Animations use native driver for smooth performance
- Toast state is managed efficiently with React hooks
- Automatic cleanup prevents memory leaks

## Accessibility

- Toast content is properly structured for screen readers
- Touch targets meet accessibility guidelines
- High contrast colors for better visibility
- Clear visual hierarchy with user names and messages
