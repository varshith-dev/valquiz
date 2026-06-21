import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Player } from '../types/game';

interface PlayerSliceState {
  nickname: string;
  score: number;
  streak: number;
  rank: number;
  isCorrect: boolean | null;
  lastScore: number;
  hasAnswered: boolean;
}

const getInitialNickname = (): string => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('valquiz_nickname') || '';
  }
  return '';
};

const initialState: PlayerSliceState = {
  nickname: getInitialNickname(),
  score: 0,
  streak: 0,
  rank: 0,
  isCorrect: null,
  lastScore: 0,
  hasAnswered: false,
};

export const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setNickname: (state, action: PayloadAction<string>) => {
      state.nickname = action.payload;
    },
    updatePlayerStats: (state, action: PayloadAction<Partial<Player>>) => {
      if (action.payload.score !== undefined) {
        state.lastScore = state.score;
        state.score = action.payload.score;
      }
      if (action.payload.streak !== undefined) state.streak = action.payload.streak;
      if (action.payload.rank !== undefined) state.rank = action.payload.rank;
      if (action.payload.isCorrect !== undefined) state.isCorrect = action.payload.isCorrect;
    },
    setHasAnswered: (state, action: PayloadAction<boolean>) => {
      state.hasAnswered = action.payload;
    },
    resetPlayer: () => initialState,
  },
});

export const {
  setNickname,
  updatePlayerStats,
  setHasAnswered,
  resetPlayer,
} = playerSlice.actions;

export default playerSlice.reducer;
