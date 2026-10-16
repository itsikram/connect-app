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
    // Merge { [profileId]: { isActive, lastSeen } } from the server's
    // presence_snapshot / presence_update.
    applyPresenceStatuses: (
      state,
      action: PayloadAction<Record<string, { isActive?: boolean; lastSeen?: string | number | null }>>,
    ) => {
      const statuses = action.payload || {};
      const online = new Set(state.activeConnects);
      Object.keys(statuses).forEach((id) => {
        const status = statuses[id] || {};
        if (status.isActive) online.add(id);
        else online.delete(id);
        if (status.lastSeen) {
          const date = new Date(status.lastSeen as any);
          if (!Number.isNaN(date.getTime())) state.lastSeen[id] = date.toISOString();
        }
      });
      state.activeConnects = Array.from(online);
    },
    clearPresence: (state) => {
      state.activeConnects = [];
      state.lastSeen = {};
    }
  },
});

export const { setConnectOnline, setConnectOffline, setConnectLastSeen, setPresenceBulk, applyPresenceStatuses, clearPresence } = presenceSlice.actions;
export default presenceSlice.reducer;

