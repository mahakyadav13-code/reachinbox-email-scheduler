import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'reachinbox.theme';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStored(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

/** Adds or removes the `dark` class that drives every themed token. */
function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * Light / dark / system theme, persisted to localStorage.
 *
 * `system` keeps following the OS after the fact, so a user who never picks a
 * preference gets their machine's setting including later changes to it.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : readStored()
  );

  useEffect(() => {
    applyTheme(preference);
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  // Follow OS changes while the preference is `system`.
  useEffect(() => {
    if (preference !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  const isDark =
    preference === 'dark' || (preference === 'system' && typeof window !== 'undefined' && systemPrefersDark());

  const toggle = useCallback(() => {
    setPreference((current) => {
      const currentlyDark =
        current === 'dark' || (current === 'system' && systemPrefersDark());
      return currentlyDark ? 'light' : 'dark';
    });
  }, []);

  return { preference, setPreference, isDark, toggle };
}

/**
 * Applies the stored theme as early as possible.
 *
 * Called from main.tsx before React renders so the first paint is already in the
 * right theme - otherwise a dark-mode user sees a white flash.
 */
export function initTheme() {
  try {
    applyTheme(readStored());
  } catch {
    // localStorage unavailable (private mode); fall back to light.
  }
}
