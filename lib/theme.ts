'use client';

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'vigilant-theme-preference';

/**
 * Get the current theme based on time of day (6AM-7PM = light, 7PM-6AM = dark)
 * unless user has manually overridden it
 */
export function getAutoTheme(): 'light' | 'dark' {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 19 ? 'light' : 'dark';
}

/**
 * Get the user's theme preference from localStorage
 */
export function getThemePreference(): Theme {
  if (typeof window === 'undefined') return 'auto';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored;
  }
  return 'auto';
}

/**
 * Set the user's theme preference
 */
export function setThemePreference(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Apply the theme to the document
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  const actualTheme = theme === 'auto' ? getAutoTheme() : theme;
  
  if (actualTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Get the current effective theme (resolves 'auto' to 'light' or 'dark')
 */
export function getCurrentTheme(): 'light' | 'dark' {
  const preference = getThemePreference();
  return preference === 'auto' ? getAutoTheme() : preference;
}
