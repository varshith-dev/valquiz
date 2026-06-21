import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import socketService from '../services/socket';
import { setLatency } from '../store/socketSlice';

export const useLatency = (intervalMs = 3000) => {
  const dispatch = useDispatch();
  const [latencyVal, setLatencyVal] = useState(0);

  useEffect(() => {
    let active = true;
    let timerId: any;

    const measure = () => {
      const start = Date.now();
      
      socketService.emit('ping-check', {}, () => {
        if (!active) return;
        const diff = Date.now() - start;
        setLatencyVal(diff);
        dispatch(setLatency(diff));
        
        timerId = setTimeout(measure, intervalMs);
      });
    };

    // Listen for custom 'pong-check' if callback is not used
    const handlePong = () => {
      if (!active) return;
      const diff = Date.now() - startTimestamp;
      setLatencyVal(diff);
      dispatch(setLatency(diff));
    };

    let startTimestamp = 0;
    socketService.on('pong-check', handlePong);

    const triggerPing = () => {
      startTimestamp = Date.now();
      socketService.emit('ping-check', {});
    };

    const intervalId = setInterval(triggerPing, intervalMs);

    return () => {
      active = false;
      clearInterval(intervalId);
      clearTimeout(timerId);
      socketService.off('pong-check');
    };
  }, [dispatch, intervalMs]);

  return latencyVal;
};

export default useLatency;
