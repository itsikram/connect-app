import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Profile {
  [key: string]: any;
}

const initialState: Profile = {};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile: (state: Profile, action: PayloadAction<Profile>) => {
      console.log('🔄 Profile reducer: setProfile called with:', action.payload?._id);
      console.log('🔄 Profile reducer: Previous profile ID:', state?._id);
      
      // Only update if the profile ID is different or if it's a new profile
      if (action.payload?._id && action.payload._id !== state?._id) {
        console.log('🔄 Profile reducer: Updating profile state (different ID)');
        return { ...action.payload };
      } else if (!state?._id && action.payload?._id) {
        console.log('🔄 Profile reducer: Updating profile state (new profile)');
        return { ...action.payload };
      } else {
        console.log('🔄 Profile reducer: Skipping update (same profile ID)');
        return state;
      }
    },
    updateProfilePic: (state: Profile, action: PayloadAction<string>) => {
      console.log('🔄 Profile reducer: updateProfilePic called with:', action.payload);
      return { ...state, profilePic: action.payload };
    },
    updateCoverPic: (state: Profile, action: PayloadAction<string>) => {
      console.log('🔄 Profile reducer: updateCoverPic called with:', action.payload);
      return { ...state, coverPic: action.payload };
    },
    updateProfileField: (state: Profile, action: PayloadAction<{ field: string; value: any }>) => {
      const { field, value } = action.payload;
      console.log('🔄 Profile reducer: updateProfileField called with:', field, value);
      return { ...state, [field]: value };
    },
    clearProfile: (state: Profile) => ({}),
  },
});

export const { setProfile, clearProfile, updateProfilePic, updateCoverPic, updateProfileField } = profileSlice.actions;
export default profileSlice.reducer; 