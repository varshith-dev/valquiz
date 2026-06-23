import { io, Socket } from 'socket.io-client';
import store from '../store';
import { setConnected, setError } from '../store/socketSlice';

class SocketService {
  public socket: Socket | null = null;
  private backendUrl: string;

  constructor() {
    // In dev, Vite proxy handles /socket.io → localhost:3000
    // In production, connect to the same origin or explicit VITE_BACKEND_URL
    let url = import.meta.env.VITE_BACKEND_URL || '';
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        console.warn(`Ignoring localhost backend URL in production: ${url}`);
        url = '';
      }
    }
    this.backendUrl = url;
  }

  public connect() {
    if (this.socket?.connected) {
      return;
    }

    // Disconnect old socket if exists
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    try {
      this.socket = io(this.backendUrl || window.location.origin, {
        transports: ['websocket'],       // WebSocket only — skip long-polling for lowest latency
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 500,          // Faster reconnect (was 1000ms)
        reconnectionDelayMax: 3000,
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        console.log('🔌 Socket connected:', this.socket?.id);
        store.dispatch(setConnected(true));
        store.dispatch(setError(null));
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
        store.dispatch(setConnected(false));
      });

      this.socket.on('connect_error', (err) => {
        console.error('🔌 Socket connection error:', err.message);
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
    if (!this.socket?.connected) {
      console.warn(`Socket not connected, cannot emit '${event}'`);
      return;
    }
    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export default socketService;
