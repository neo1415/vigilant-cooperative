'use client';

import { useEffect } from 'react';
import { applyTheme, getThemePreference } from '@/lib/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme on mount
    applyTheme(getThemePreference());

    // Re-check theme every minute (for auto mode time-based switching)
    const interval = setInterval(() => {
      const preference = getThemePreference();
      if (preference === 'auto') {
        applyTheme('auto');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
