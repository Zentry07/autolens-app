/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PROXY_URL: string;
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_REVENUECAT_API_KEY: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@revenuecat/purchases-capacitor' {
  export const Purchases: {
    configure(config: { apiKey: string }): Promise<void>;
    getCustomerInfo(): Promise<{ customerInfo: any }>;
    getOfferings(): Promise<{ offerings: any }>;
    purchasePackage(config: { aPackage: any }): Promise<{ customerInfo: any }>;
    restorePurchases(): Promise<{ customerInfo: any }>;
  };
}
