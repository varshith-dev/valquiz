import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import playerReducer from './playerSlice';
import socketReducer from './socketSlice';
import { quizApi } from './quizApi';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    player: playerReducer,
    socket: socketReducer,
    [quizApi.reducerPath]: quizApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(quizApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
