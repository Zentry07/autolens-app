/**
 * Subscription payments service.
 * Uses RevenueCat for iOS/Android subscription management.
 * Provides a no-op implementation for web development.
 */

import { Capacitor } from '@capacitor/core';

let rc: any = null;
let initialized = false;

export interface SubscriptionStatus {
  isPremium: boolean;
  expirationDate?: string;
  productId?: string;
  willRenew?: boolean;
}

/**
 * Initialize RevenueCat.
 * Call once at app startup.
 */
export async function initPayments(): Promise<void> {
  if (initialized) return;

  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY;
  if (!apiKey || !Capacitor.isNativePlatform()) {
    console.warn('[Payments] RevenueCat not configured or running on web');
    initialized = true;
    return;
  }

  try {
    const mod = '@revenuecat/purchases-capacitor';
    const { Purchases } = await import(/* @vite-ignore */ mod);
    await Purchases.configure({ apiKey });
    rc = Purchases;
    initialized = true;
  } catch (err) {
    console.error('[Payments] Init failed:', err);
    initialized = true;
  }
}

/**
 * Check current subscription status.
 */
export async function checkSubscription(): Promise<SubscriptionStatus> {
  if (!rc) return { isPremium: false };

  try {
    const { customerInfo } = await rc.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active['autolens_pro'];

    if (entitlement) {
      return {
        isPremium: true,
        expirationDate: entitlement.expirationDate,
        productId: entitlement.productIdentifier,
        willRenew: !entitlement.willRenew ? false : true,
      };
    }

    return { isPremium: false };
  } catch (err) {
    console.error('[Payments] Check subscription failed:', err);
    return { isPremium: false };
  }
}

/**
 * Get available subscription packages.
 */
export async function getOfferings(): Promise<any[]> {
  if (!rc) return [];

  try {
    const { offerings } = await rc.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch (err) {
    console.error('[Payments] Get offerings failed:', err);
    return [];
  }
}

/**
 * Purchase a subscription package.
 */
export async function purchasePackage(pkg: any): Promise<SubscriptionStatus> {
  if (!rc) return { isPremium: false };

  try {
    const { customerInfo } = await rc.purchasePackage({ aPackage: pkg });
    const entitlement = customerInfo.entitlements.active['autolens_pro'];

    return {
      isPremium: !!entitlement,
      expirationDate: entitlement?.expirationDate,
      productId: entitlement?.productIdentifier,
    };
  } catch (err: any) {
    if (err.code === 'PURCHASE_CANCELLED') {
      return { isPremium: false };
    }
    console.error('[Payments] Purchase failed:', err);
    throw err;
  }
}

/**
 * Restore previous purchases.
 */
export async function restorePurchases(): Promise<SubscriptionStatus> {
  if (!rc) return { isPremium: false };

  try {
    const { customerInfo } = await rc.restorePurchases();
    const entitlement = customerInfo.entitlements.active['autolens_pro'];

    return {
      isPremium: !!entitlement,
      expirationDate: entitlement?.expirationDate,
      productId: entitlement?.productIdentifier,
    };
  } catch (err) {
    console.error('[Payments] Restore failed:', err);
    return { isPremium: false };
  }
}
