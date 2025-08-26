import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatAPI } from '../lib/api';

interface ChatPerson {
  _id: string;
  fullName: string;
  profilePic: string;
  isActive: boolean;
  bio?: string;
  username?: string;
  nickname?: string;
  workPlaces?: any[];
  schools?: any[];
  blockedUsers?: string[];
  friends?: string[];
  friendReqs?: string[];
  following?: string[];
  user: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  coverPic?: string;
  displayName?: string;
  lastEmotion?: string;
  permanentAddress?: string;
  presentAddress?: string;
}

interface ChatMessage {
  _id: string;
  room: string;
  senderId: string;
  receiverId: string;
  message: string;
  attachment: string | boolean;
  reacts: any[];
  isSeen: boolean;
  timestamp: string;
  __v: number;
}

interface Chat {
  person: ChatPerson;
  messages: ChatMessage[];
}

interface ChatState {
  chats: Chat[];
  loading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  chats: [],
  loading: false,
  error: null,
};

// Create async thunk for fetching chat list
export const fetchChatList = createAsyncThunk(
  'chat/fetchChatList',
  async (profileId: string) => {
    const response = await chatAPI.getChatList(profileId);
    console.log('🔍 Chat list response:', response);
    return response.data;
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearChatList: (state) => {
      state.chats = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChatList.fulfilled, (state, action: PayloadAction<Chat[]>) => {
        state.loading = false;
        state.chats = action.payload;
        state.error = null;
      })
      .addCase(fetchChatList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch chat list';
      });
  },
});

export const { clearChatList } = chatSlice.actions;
export default chatSlice.reducer; 