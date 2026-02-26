import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autolensai.app',
  appName: 'AutoLens',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0a1f38',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK' as any,
    },
    Keyboard: {
      resize: 'body' as any,
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
};

export default config;
