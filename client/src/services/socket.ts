import { io, Socket } from 'socket.io-client';
import store from '../store';
import { setConnected, setError } from '../store/socketSlice';

class SocketService {
  public socket: Socket | null = null;
  private backendUrl: string;

  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  }

  public connect(pin?: string, nickname?: string) {
    if (this.socket) {
      return;
    }

    try {
      this.socket = io(this.backendUrl, {
        autoConnect: true,
        reconnection: true,
        query: {
          pin: pin || '',
          nickname: nickname || '',
        },
      });

      this.socket.on('connect', () => {
        store.dispatch(setConnected(true));
        store.dispatch(setError(null));
      });

      this.socket.on('disconnect', () => {
        store.dispatch(setConnected(false));
      });

      this.socket.on('connect_error', (err) => {
        store.dispatch(setError(err.message));
      });
    } catch (e: any) {
      store.dispatch(setError(e.message || 'Connection failed'));
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      store.dispatch(setConnected(false));
    }
  }

  public emit(event: string, data: any, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
