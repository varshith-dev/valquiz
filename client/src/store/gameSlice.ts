import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { GameState, GameStatus, Question, Player } from '../types/game';

const getInitialPin = (): string => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('valquiz_pin') || '';
  }
  return '';
};

const getInitialQuestions = (pin: string): Question[] => {
  if (typeof window !== 'undefined' && pin) {
    const sessionRaw = localStorage.getItem(`valquiz_game_session_${pin}`);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        return session.questions || [];
      } catch (e) {
        console.error('Failed to parse initial questions from localStorage', e);
      }
    }
  }
  return [];
};

const initialPin = getInitialPin();
const initialQuestions = getInitialQuestions(initialPin);

const initialState: GameState = {
  pin: initialPin,
  status: 'idle',
  mode: 'classic',
  currentQuestionIndex: -1,
  questions: initialQuestions,
  players: [],
  timer: 0,
  totalQuestions: initialQuestions.length,
  isHintRevealed: false,
};

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setPin: (state, action: PayloadAction<string>) => {
      state.pin = action.payload;
      if (typeof window !== 'undefined' && action.payload) {
        const sessionRaw = localStorage.getItem(`valquiz_game_session_${action.payload}`);
        if (sessionRaw) {
          try {
            const session = JSON.parse(sessionRaw);
            if (session.questions) {
              state.questions = session.questions;
              state.totalQuestions = session.questions.length;
            }
          } catch (e) {
            console.error('Failed to parse game session questions in setPin', e);
          }
        }
      }
    },
    setStatus: (state, action: PayloadAction<GameStatus>) => {
      state.status = action.payload;
    },
    setMode: (state, action: PayloadAction<'classic' | 'balanced' | 'accuracy'>) => {
      state.mode = action.payload;
    },
    setQuestions: (state, action: PayloadAction<Question[]>) => {
      state.questions = action.payload;
      state.totalQuestions = action.payload.length;
    },
    setCurrentQuestionIndex: (state, action: PayloadAction<number>) => {
      state.currentQuestionIndex = action.payload;
      state.isHintRevealed = false; // Reset hint lock on new question
    },
    setPlayers: (state, action: PayloadAction<Player[]>) => {
      state.players = action.payload;
    },
    setTimer: (state, action: PayloadAction<number>) => {
      state.timer = action.payload;
    },
    tickTimer: (state) => {
      if (state.timer > 0) {
        state.timer -= 1;
      }
    },
    setHintRevealed: (state, action: PayloadAction<boolean>) => {
      state.isHintRevealed = action.payload;
    },
    resetGame: () => initialState,
  },
});

export const {
  setPin,
  setStatus,
  setMode,
  setQuestions,
  setCurrentQuestionIndex,
  setPlayers,
  setTimer,
  tickTimer,
  setHintRevealed,
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
