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
      
      // Always update the profile data
      console.log('🔄 Profile reducer: Updating profile state');
      return { ...action.payload };
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