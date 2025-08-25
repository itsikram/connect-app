# Profile Data System

This document explains how the profile data is automatically saved to the Redux store when the app opens.

## Overview

The profile data system automatically fetches and stores user profile information in the Redux store whenever:
- The app starts with an existing logged-in user
- A user logs in
- A user registers

## How It Works

### 1. Automatic Profile Fetching

The system uses a custom hook `useProfileData` that:
- Fetches profile data from the API when the app opens
- Stores the data in Redux using the `setProfile` action
- Updates AsyncStorage with fresh profile data
- Handles errors gracefully by falling back to stored data

### 2. Redux Store Structure

The profile data is stored in the Redux store under the `profile` slice:

```typescript
// Store structure
{
  profile: {
    username: string,
    fullName: string,
    bio: string,
    profilePic: string,
    coverPic: string,
    friends: string[],
    // ... other profile fields
  }
}
```

### 3. Available Actions

- `setProfile(profileData)`: Sets the profile data in the store
- `clearProfile()`: Clears the profile data from the store

## Usage

### Accessing Profile Data in Components

```typescript
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const MyComponent = () => {
  const profile = useSelector((state: RootState) => state.profile);
  
  return (
    <View>
      <Text>Welcome, {profile.fullName}!</Text>
      <Text>Bio: {profile.bio}</Text>
    </View>
  );
};
```

### Manual Profile Data Refresh

```typescript
import { useDispatch } from 'react-redux';
import { setProfile } from '../reducers/profileReducer';

const MyComponent = () => {
  const dispatch = useDispatch();
  
  const refreshProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      if (response.data) {
        dispatch(setProfile(response.data));
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };
  
  return (
    <Button title="Refresh Profile" onPress={refreshProfile} />
  );
};
```

## API Endpoints

The system uses the following API endpoints:

- `GET /user/profile`: Fetches the current user's profile data
- The API automatically includes the user's authentication token

## Error Handling

- If the API call fails, the system falls back to stored profile data
- Network errors are logged but don't crash the app
- The user experience remains smooth even with API failures

## Performance Considerations

- Profile data is fetched once when the app opens
- Data is cached in both Redux and AsyncStorage
- Subsequent profile updates should use the manual refresh method
- The system is designed to minimize unnecessary API calls

## Integration Points

The profile system integrates with:
- **AuthContext**: Automatically fetches profile data on login/registration
- **Redux Store**: Provides global access to profile data
- **AsyncStorage**: Persists profile data between app sessions
- **Navigation**: Profile data is available throughout the app

## Example Components

See `ProfileDisplay.tsx` for a complete example of how to display profile data from the Redux store.
