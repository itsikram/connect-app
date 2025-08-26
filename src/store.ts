import { configureStore } from '@reduxjs/toolkit';
import postsReducer from './reducers/postsReducer';
import profileReducer from './reducers/profileReducer';
import chatReducer from './reducers/chatReducer';

const store = configureStore({
    reducer: {
        posts: postsReducer,
        profile: profileReducer,
        chat: chatReducer,
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store; 