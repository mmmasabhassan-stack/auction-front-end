'use client';

import { useEffect, useState } from 'react';

const THEME_KEY = 'theme';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  // Read initial theme
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
    const initial = stored === 'dark';
    setIsDark(initial);
    if (initial) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, []);

  // Apply on toggle
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((v) => !v);

  return { isDark, toggleTheme };
}

