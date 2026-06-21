import { useEffect } from 'react';
import socketService from '../services/socket';

export const useSocket = (event: string, callback: (...args: any[]) => void) => {
  useEffect(() => {
    socketService.on(event, callback);

    return () => {
      socketService.off(event);
    };
  }, [event, callback]);
};

export default useSocket;
