import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface Notification {
  _id: string;
  text: string;
  icon?: string;
  link?: string;
  isSeen: boolean;
  timestamp: string;
  __v: number;
}

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  loading: false,
  error: null,
};

// Create async thunk for fetching notifications
export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async (profileId: string) => {
    // This would typically call an API endpoint
    // For now, we'll return an empty array
    return [];
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
    },
    addNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
    },
    markNotificationAsSeen: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n._id === action.payload);
      if (notification) {
        notification.isSeen = true;
      }
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action: PayloadAction<Notification[]>) => {
        state.loading = false;
        state.notifications = action.payload;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notifications';
      });
  },
});

export const { 
  addNotification, 
  addNotifications, 
  markNotificationAsSeen, 
  clearNotifications 
} = notificationSlice.actions;

export default notificationSlice.reducer;
