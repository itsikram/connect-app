import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PresenceState {
  activeFriends: string[];
  lastSeen: Record<string, string | undefined>;
}

const initialState: PresenceState = {
  activeFriends: [],
  lastSeen: {},
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setFriendOnline: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.activeFriends.includes(id)) {
        state.activeFriends.push(id);
      }
    },
    setFriendOffline: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.activeFriends = state.activeFriends.filter(fid => fid !== id);
    },
    setFriendLastSeen: (state, action: PayloadAction<{ profileId: string; lastLogin?: string }>) => {
      const { profileId, lastLogin } = action.payload;
      state.lastSeen[profileId] = lastLogin;
    },
    setPresenceBulk: (state, action: PayloadAction<{ onlineIds?: string[]; lastSeen?: Record<string, string | undefined> }>) => {
      const { onlineIds, lastSeen } = action.payload;
      if (onlineIds) {
        state.activeFriends = Array.from(new Set(onlineIds));
      }
      if (lastSeen) {
        state.lastSeen = { ...state.lastSeen, ...lastSeen };
      }
    },
    clearPresence: (state) => {
      state.activeFriends = [];
      state.lastSeen = {};
    }
  },
});

export const { setFriendOnline, setFriendOffline, setFriendLastSeen, setPresenceBulk, clearPresence } = presenceSlice.actions;
export default presenceSlice.reducer;


