import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.tvapp',
  appName: 'TV App',
  webDir: 'dist/androidtv',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
