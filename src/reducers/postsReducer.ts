import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Post {
  _id: string;
  [key: string]: any;
}

const initialState: Post[] = [];

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setPosts: (state: Post[], action: PayloadAction<Post[]>) => action.payload,
    addPost: (state: Post[], action: PayloadAction<Post>) => [action.payload, ...state],
    updatePost: (state: Post[], action: PayloadAction<Post>) => state.map((post: Post) => post._id === action.payload._id ? action.payload : post),
    deletePost: (state: Post[], action: PayloadAction<string>) => state.filter((post: Post) => post._id !== action.payload),
  },
});

export const { setPosts, addPost, updatePost, deletePost } = postsSlice.actions;
export default postsSlice.reducer; 