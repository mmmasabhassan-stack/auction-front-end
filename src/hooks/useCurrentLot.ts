'use client';

import { useCallback, useMemo, useState } from 'react';

export function useCurrentLot<T>(lots: T[]) {
  const [currentLotIndex, setCurrentLotIndex] = useState<number>(-1);

  const currentLot = useMemo(() => {
    if (currentLotIndex < 0 || lots.length === 0) return null;
    return lots[currentLotIndex % lots.length] ?? null;
  }, [currentLotIndex, lots]);

  const nextLotPreview = useMemo(() => {
    if (lots.length === 0) return null;
    const idx = currentLotIndex < 0 ? 0 : (currentLotIndex + 1) % lots.length;
    return lots[idx] ?? null;
  }, [currentLotIndex, lots]);

  const startAtFirst = useCallback(() => {
    if (lots.length === 0) return;
    setCurrentLotIndex((prev) => (prev < 0 ? 0 : prev));
  }, [lots.length]);

  const next = useCallback(() => {
    if (lots.length === 0) return;
    setCurrentLotIndex((prev) => (prev < 0 ? 0 : prev + 1));
  }, [lots.length]);

  return {
    currentLotIndex,
    setCurrentLotIndex,
    currentLot,
    nextLotPreview,
    startAtFirst,
    next,
  };
}

