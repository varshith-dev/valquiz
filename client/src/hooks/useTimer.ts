import { useState, useEffect, useRef } from 'react';

export const useTimer = (initialSeconds: number, onComplete?: () => void, isPaused: boolean = false) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const callbackRef = useRef(onComplete);

  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      if (callbackRef.current) {
        callbackRef.current();
      }
      return;
    }

    if (isPaused) {
      return;
    }

    const intervalId = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          if (callbackRef.current) {
            callbackRef.current();
          }
          return 0;
        }
        
        // Play beep in last 5 seconds if audio context is available
        if (prev <= 6) {
          playBeep(440, 0.1);
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [seconds, isPaused]);

  return seconds;
};

// Web Audio API beep generator
function playBeep(frequency: number, duration: number) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context initialization blocked or unsupported
  }
}

export default useTimer;
