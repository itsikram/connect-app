import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PresenceState {
  activeConnects: string[];
  lastSeen: Record<string, string | undefined>;
}

const initialState: PresenceState = {
  activeConnects: [],
  lastSeen: {},
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setConnectOnline: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.activeConnects.includes(id)) {
        state.activeConnects.push(id);
      }
    },
    setConnectOffline: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.activeConnects = state.activeConnects.filter(fid => fid !== id);
    },
    setConnectLastSeen: (state, action: PayloadAction<{ profileId: string; lastLogin?: string }>) => {
      const { profileId, lastLogin } = action.payload;
      state.lastSeen[profileId] = lastLogin;
    },
    setPresenceBulk: (state, action: PayloadAction<{ onlineIds?: string[]; lastSeen?: Record<string, string | undefined> }>) => {
      const { onlineIds, lastSeen } = action.payload;
      if (Array.isArray(onlineIds)) {
        state.activeConnects = Array.from(new Set(onlineIds));
      }
      if (lastSeen) {
        state.lastSeen = { ...state.lastSeen, ...lastSeen };
      }
    },
    clearPresence: (state) => {
      state.activeConnects = [];
      state.lastSeen = {};
    }
  },
});

export const { setConnectOnline, setConnectOffline, setConnectLastSeen, setPresenceBulk, clearPresence } = presenceSlice.actions;
export default presenceSlice.reducer;

