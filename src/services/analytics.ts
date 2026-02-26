/**
 * Analytics service.
 * Wraps Firebase Analytics for event tracking.
 * No-op when Firebase is not configured.
 */

let analyticsInstance: any = null;
let initialized = false;

/**
 * Initialize Firebase Analytics.
 * Call once at app startup.
 */
export async function initAnalytics(): Promise<void> {
  if (initialized) return;

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    console.warn('[Analytics] Firebase not configured — analytics disabled');
    initialized = true;
    return;
  }

  try {
    const { initializeApp } = await import(/* @vite-ignore */ 'firebase/app');
    const { getAnalytics } = await import(/* @vite-ignore */ 'firebase/analytics');

    const app = initializeApp({
      apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    });

    analyticsInstance = getAnalytics(app);
    initialized = true;
  } catch (err) {
    console.error('[Analytics] Init failed:', err);
    initialized = true;
  }
}

/**
 * Log a custom event.
 */
export function logEvent(name: string, params?: Record<string, any>): void {
  if (!analyticsInstance) {
    console.log('[Analytics]', name, params);
    return;
  }

  try {
    import(/* @vite-ignore */ 'firebase/analytics').then(({ logEvent: fbLogEvent }) => {
      fbLogEvent(analyticsInstance, name, params);
    });
  } catch { /* no-op */ }
}

// --- Typed event helpers ---

export function trackScan(result: any, method: string): void {
  logEvent('scan_car', { make: result?.make, model: result?.model, method });
}

export function trackDiagnose(symptom: string, hasCar: boolean): void {
  logEvent('diagnose', { symptom, has_car: hasCar });
}

export function trackPaywallView(trigger: string): void {
  logEvent('paywall_shown', { trigger });
}

export function trackPurchaseStart(plan: string): void {
  logEvent('purchase_start', { plan });
}

export function trackScreenView(screenName: string): void {
  logEvent('screen_view', { screen_name: screenName });
}

export function trackFeatureUsed(feature: string): void {
  logEvent('feature_used', { feature });
}

export function trackShare(make: string, model: string): void {
  logEvent('share_car', { make, model });
}
