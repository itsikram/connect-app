import { configureStore } from '@reduxjs/toolkit';
import postsReducer from './reducers/postsReducer';
import profileReducer from './reducers/profileReducer';
import chatReducer from './reducers/chatReducer';
import notificationReducer from './reducers/notificationReducer';
import presenceReducer from './reducers/presenceReducer';

const store = configureStore({
    reducer: {
        posts: postsReducer,
        profile: profileReducer,
        chat: chatReducer,
        notification: notificationReducer,
        presence: presenceReducer,
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store; 