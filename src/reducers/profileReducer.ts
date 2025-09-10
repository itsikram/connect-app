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
      
      // Only update if the profile ID has actually changed
      if (state?._id !== action.payload?._id) {
        console.log('🔄 Profile reducer: Profile ID changed, updating state');
        return { ...action.payload };
      } else {
        console.log('🔄 Profile reducer: Profile ID unchanged, skipping update');
        return state;
      }
    },
    clearProfile: (state: Profile) => ({}),
  },
});

export const { setProfile, clearProfile } = profileSlice.actions;
export default profileSlice.reducer; 