import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface SocketSliceState {
  connected: boolean;
  latency: number;
  error: string | null;
}

const initialState: SocketSliceState = {
  connected: false,
  latency: 0,
  error: null,
};

export const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
    setLatency: (state, action: PayloadAction<number>) => {
      state.latency = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setConnected, setLatency, setError } = socketSlice.actions;

export default socketSlice.reducer;
