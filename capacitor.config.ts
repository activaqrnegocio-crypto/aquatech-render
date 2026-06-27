import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquatech.crm',
  appName: 'Aquatech CRM',
  webDir: '.next',
  
  // LOCAL - para pruebas con npm run start (mantener comentado para producción)
  // PRODUCCIÓN - APK carga la UI desde el VPS
  server: {
    url: 'https://178.238.238.158.sslip.io',
    cleartext: false,
    appStartPath: '/admin',
  },
  
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#036BB2',
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#036BB2',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    // v418: Plugin nativo para deep linking desde notificaciones
    PendingNavPlugin: {
      // No necesita configuración - se registra en MainActivity
    },
    // v451: Plugin nativo para SharedPreferences
    NativePreferences: {
      // No necesita configuración
    },

    // FASE 3: Background Runner para sync offline
    BackgroundRunner: {
      label: 'com.aquatech.crm.background',
      src: 'runners/background.js',
      event: 'outboxSync',
      repeat: true,
      interval: 15, // minutos
      autoStart: true,
    },
  },
};

export default config;
