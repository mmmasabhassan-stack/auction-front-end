'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAuctionTimer(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // keep config seconds in sync if initialSeconds changes
  useEffect(() => setSeconds(initialSeconds), [initialSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => {
    setTimeRemaining((prev) => (prev > 0 ? prev : seconds));
    setIsRunning(true);
  }, [seconds]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeRemaining(0);
  }, []);

  return {
    seconds,
    setSeconds,
    timeRemaining,
    setTimeRemaining,
    isRunning,
    start,
    pause,
    reset,
  };
}

