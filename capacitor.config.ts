import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.premiumpulse.calculator',
  appName: 'PremiumPulse',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false },
};

export default config;
