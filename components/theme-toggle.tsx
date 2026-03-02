'use client';

import { useLayoutEffect, useState } from 'react';
import { getCurrentTheme, setThemePreference } from '@/lib/theme';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // useLayoutEffect runs before paint, avoiding hydration mismatch
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    setMounted(true);
    setTheme(getCurrentTheme());

    // Listen for theme changes
    const handleThemeChange = () => {
      setTheme(getCurrentTheme());
    };

    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemePreference(newTheme);
    setTheme(newTheme);
    window.dispatchEvent(new Event('theme-changed'));
  };

  // Prevent hydration mismatch by not rendering icon until mounted
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg glass hover:bg-surface-elevated transition-colors"
        aria-label="Toggle theme"
        disabled
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-lg glass hover:bg-surface-elevated transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}
