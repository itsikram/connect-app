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
  unreadMessageCount: number;
}

const initialState: ChatState = {
  chats: [],
  loading: false,
  error: null,
  unreadMessageCount: 0,
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
      state.unreadMessageCount = 0;
    },
    updateUnreadMessageCount: (state, action: PayloadAction<string>) => {
      // Calculate unread message count from all chats
      const currentUserId = action.payload;
      const totalUnread = state.chats.reduce((count, chat) => {
        const unreadInChat = chat.messages.filter(message => 
          !message.isSeen && message.receiverId === currentUserId
        ).length;
        return count + unreadInChat;
      }, 0);
      state.unreadMessageCount = totalUnread;
    },
    markMessagesAsRead: (state, action: PayloadAction<{chatId: string, currentUserId: string}>) => {
      // Mark messages as read for a specific chat
      const { chatId, currentUserId } = action.payload;
      const chat = state.chats.find(c => c.person._id === chatId);
      if (chat) {
        chat.messages.forEach(message => {
          if (message.receiverId === currentUserId) {
            message.isSeen = true;
          }
        });
      }
      // Recalculate unread count
      const totalUnread = state.chats.reduce((count, chat) => {
        const unreadInChat = chat.messages.filter(message => 
          !message.isSeen && message.receiverId === currentUserId
        ).length;
        return count + unreadInChat;
      }, 0);
      state.unreadMessageCount = totalUnread;
    },
    addNewMessage: (state, action: PayloadAction<{chatId: string, message: ChatMessage, currentUserId: string}>) => {
      const { chatId, message, currentUserId } = action.payload;
      const chat = state.chats.find(c => c.person._id === chatId);
      if (chat) {
        chat.messages.unshift(message);
        // Increment unread count if message is not seen and is for current user
        if (!message.isSeen && message.receiverId === currentUserId) {
          state.unreadMessageCount += 1;
        }
      }
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
        // Calculate unread message count after fetching chats
        // Note: We'll need to call updateUnreadMessageCount separately with current user ID
      })
      .addCase(fetchChatList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch chat list';
      });
  },
});

export const { 
  clearChatList, 
  updateUnreadMessageCount, 
  markMessagesAsRead, 
  addNewMessage 
} = chatSlice.actions;
export default chatSlice.reducer; 