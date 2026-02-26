/**
 * Persistent storage service.
 * Uses Capacitor Preferences on native, localStorage on web.
 */

import { Capacitor } from '@capacitor/core';

let Preferences: any = null;

async function getPreferences() {
  if (Preferences) return Preferences;

  if (Capacitor.isNativePlatform()) {
    const mod = await import('@capacitor/preferences');
    Preferences = mod.Preferences;
  }
  return Preferences;
}

/**
 * Get a value from storage.
 */
export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const prefs = await getPreferences();

    if (prefs) {
      const { value } = await prefs.get({ key });
      return value ? JSON.parse(value) : null;
    }

    // Fallback to localStorage on web
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('[Storage] getItem failed:', key, err);
    return null;
  }
}

/**
 * Set a value in storage.
 */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    const prefs = await getPreferences();

    if (prefs) {
      await prefs.set({ key, value: serialized });
      return;
    }

    localStorage.setItem(key, serialized);
  } catch (err) {
    console.error('[Storage] setItem failed:', key, err);
  }
}

/**
 * Remove a value from storage.
 */
export async function removeItem(key: string): Promise<void> {
  try {
    const prefs = await getPreferences();

    if (prefs) {
      await prefs.remove({ key });
      return;
    }

    localStorage.removeItem(key);
  } catch (err) {
    console.error('[Storage] removeItem failed:', key, err);
  }
}

/**
 * Clear all storage.
 */
export async function clearAll(): Promise<void> {
  try {
    const prefs = await getPreferences();

    if (prefs) {
      await prefs.clear();
      return;
    }

    localStorage.clear();
  } catch (err) {
    console.error('[Storage] clearAll failed:', err);
  }
}

// Storage keys
export const KEYS = {
  HISTORY: 'al10',
  FAVORITES: 'al10-favs',
  PRO: 'al10-pro',
  SCANS: 'al10-scans',
  ONBOARDING: 'al10-ob',
  AI_CONSENT: 'al10-aic',
  STREAK: 'al10-streak',
  MARKET_ALERTS: 'al10-ma',
} as const;
