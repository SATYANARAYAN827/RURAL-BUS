import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ruralbus.driver',
  appName: 'RuralBus Driver',
  webDir: 'dist',
  server: {
    // For Android WebView to reach the local dev server during GPS testing.
    // This is overridden by the bundled web assets in production APKs.
    // Remove or update this URL for any non-LAN build.
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
