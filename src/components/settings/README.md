# Settings Components

This directory contains all the individual settings components for the React Native app, matching the functionality from the web version.

## Components Overview

### 1. ProfileSettings
- **Purpose**: Manage profile information including personal details, education, and work experience
- **Features**:
  - Basic information (name, username, nickname, display name)
  - Address information (present and permanent)
  - Dynamic education history (schools and degrees)
  - Dynamic work experience (companies and designations)
  - Add/remove multiple entries for schools and workplaces

### 2. PrivacySettings
- **Purpose**: Control content visibility and privacy settings
- **Features**:
  - Post visibility (Only Me, Friends of Friends, Public)
  - Friend request visibility settings
  - Timeline post permissions
  - Privacy information and tips

### 3. NotificationSettings
- **Purpose**: Manage all notification preferences
- **Features**:
  - Push notifications for various events
  - Email notification preferences
  - Friend requests, messages, posts, stories, and watch content
  - Notification tips and information

### 4. AccountSettings
- **Purpose**: Manage account security and credentials
- **Features**:
  - Email address management (editable)
  - Password change functionality
  - Current password validation
  - Account deletion with confirmation
  - Password requirements and security tips

### 5. PreferenceSettings
- **Purpose**: Customize app appearance and behavior
- **Features**:
  - Theme mode selection (Default, Dark, Light)
  - Language preferences
  - Timezone settings
  - Date and time format options
  - Detailed information about each setting

### 6. MessageSettings
- **Purpose**: Control messaging behavior and privacy
- **Features**:
  - Typing indicators
  - Read receipts
  - Message previews
  - Face mode sharing (camera access)
  - Auto-save drafts
  - Detailed explanations for each feature

### 7. SoundSettings
- **Purpose**: Manage audio experience and notifications
- **Features**:
  - Call ringtones selection
  - Notification sound preferences
  - Message sound options
  - Vibration controls
  - Silent mode toggle
  - Volume control visualization
  - Sound tips and device integration info

## Usage

All settings components are automatically integrated into the main `Settings.tsx` screen with tab navigation. Users can switch between different setting categories using the horizontal tab bar at the top.

## Styling

All components use:
- Consistent color scheme from `../../theme/colors`
- Dark/light mode support via `useColorScheme()`
- Responsive design with proper spacing and typography
- Material Design icons from `react-native-vector-icons/MaterialIcons`

## State Management

Each component manages its own local state and provides save functionality. In a production app, you would:
1. Connect these to your global state management (Redux, Context, etc.)
2. Implement API calls to persist settings
3. Add loading states and error handling
4. Implement validation and user feedback

## Dependencies

- `@react-native-picker/picker` - For dropdown selections
- `react-native-vector-icons/MaterialIcons` - For icons
- Built-in React Native components (View, Text, Switch, etc.)

## Customization

Each component is designed to be easily customizable:
- Colors can be modified in the theme file
- Layout and spacing can be adjusted in the StyleSheet
- Additional settings can be added by extending the interfaces
- Validation logic can be enhanced as needed

## Integration Notes

The main Settings screen automatically renders the appropriate component based on the selected tab. All components follow the same design pattern for consistency and maintainability.
