/**
 * Haptic feedback service.
 * Uses Capacitor Haptics on native, no-op on web.
 */

import { Capacitor } from '@capacitor/core';

let HapticsPlugin: any = null;

async function getHaptics() {
  if (HapticsPlugin) return HapticsPlugin;

  if (Capacitor.isNativePlatform()) {
    const mod = await import('@capacitor/haptics');
    HapticsPlugin = mod.Haptics;
  }
  return HapticsPlugin;
}

/** Light tap — button press, selection change */
export async function tapLight(): Promise<void> {
  try {
    const haptics = await getHaptics();
    if (haptics) await haptics.impact({ style: 'LIGHT' });
  } catch { /* no-op on web */ }
}

/** Medium tap — scan success, save action */
export async function tapMedium(): Promise<void> {
  try {
    const haptics = await getHaptics();
    if (haptics) await haptics.impact({ style: 'MEDIUM' });
  } catch { /* no-op on web */ }
}

/** Heavy tap — score reveal, excellent result */
export async function tapHeavy(): Promise<void> {
  try {
    const haptics = await getHaptics();
    if (haptics) await haptics.impact({ style: 'HEAVY' });
  } catch { /* no-op on web */ }
}

/** Success notification — purchase completed */
export async function notifySuccess(): Promise<void> {
  try {
    const haptics = await getHaptics();
    if (haptics) await haptics.notification({ type: 'SUCCESS' });
  } catch { /* no-op on web */ }
}

/** Warning notification */
export async function notifyWarning(): Promise<void> {
  try {
    const haptics = await getHaptics();
    if (haptics) await haptics.notification({ type: 'WARNING' });
  } catch { /* no-op on web */ }
}

/** Error notification — scan failed */
export async function notifyError(): Promise<void> {
  try {
    const haptics = await getHaptics();
    if (haptics) await haptics.notification({ type: 'ERROR' });
  } catch { /* no-op on web */ }
}
