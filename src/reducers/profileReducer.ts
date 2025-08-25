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
      console.log('setProfile', action.payload);
      return { ...action.payload };
    },
    clearProfile: (state: Profile) => ({}),
  },
});

export const { setProfile, clearProfile } = profileSlice.actions;
export default profileSlice.reducer; 