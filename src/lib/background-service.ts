// src/lib/background-service.ts
// Background Runner Service para Android - procesa outbox cuando app está cerrada
// FASE 3: Puente entre SQLite nativo y el background runner

import { Capacitor } from '@capacitor/core';
import { BackgroundRunner } from '@capacitor/background-runner';
import * as nativeStorage from './native-storage';

const LABEL = 'com.aquatech.crm.background';
const SYNC_EVENT = 'outboxSync';
const STORE_EVENT = 'storeSyncData';
const GET_RESULTS_EVENT = 'getSyncResults';

// ─── CONFIG ────────────────────────────────────────────────
export function configureBackgroundRunner(): void {
  if (!Capacitor.isNativePlatform()) return;

  try {
    (BackgroundRunner as any).registerBackgroundTask?.({
      runner: {
        label: LABEL,
        src: 'runners/background.js',
        event: SYNC_EVENT,
        repeat: true,
        interval: 15,
        autoStart: true,
      }
    });
    console.log('[BackgroundRunner] ✅ Configurado (cada 15 min)');
  } catch (err) {
    console.warn('[BackgroundRunner] Configuration failed:', err);
  }
}

// ─── DISPARAR EVENTO ───────────────────────────────────────
// Fuerza al background runner a procesar ahora (no esperar 15 min)
export async function triggerBackgroundSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundRunner.dispatchEvent({
      label: LABEL,
      event: SYNC_EVENT,
      details: {}
    });
    console.log('[BackgroundRunner] ⚡ Evento sync disparado');
  } catch {
    // Si no se puede disparar ahora, el runner lo hará en su intervalo
  }
}

// ─── PUENTE: App → Background Runner ────────────────────
// Envía los items pendientes del SQLite nativo al background runner
// via dispatchEvent. El runner los guarda en CapacitorKV internamente.
export async function syncOutboxToKV(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!nativeStorage.isNative()) return;

  try {
    const pending = await nativeStorage.getOutboxPending();
    const auth = await nativeStorage.getAuthCache();

    if (pending.length === 0) return;

    // Obtener la API URL
    const apiUrl = typeof window !== 'undefined'
      ? (window as any).__NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL;

    // Enviar datos al runner via dispatchEvent
    await BackgroundRunner.dispatchEvent({
      label: LABEL,
      event: STORE_EVENT,
      details: {
        pendingOutbox: JSON.stringify(pending),
        authToken: auth ? JSON.stringify({ token: auth.token, userId: auth.userId }) : null,
        apiUrl: apiUrl || null
      }
    });

    console.log(`[BackgroundRunner] 📤 ${pending.length} items enviados al runner`);

    // Disparar sync ahora mismo (Fire & forget)
    triggerBackgroundSync().catch(() => {});
  } catch (err) {
    console.warn('[BackgroundRunner] Error enviando datos al runner:', err);
  }
}

// ─── PUENTE: Background Runner → App (marcar como procesados) ───
// Pide al background runner los resultados via dispatchEvent
// y marca los items como procesados en SQLite
export async function syncKVResultsToSQLite(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  if (!nativeStorage.isNative()) return 0;

  try {
    // Pedir resultados al runner via dispatchEvent
    const results: any = await BackgroundRunner.dispatchEvent({
      label: LABEL,
      event: GET_RESULTS_EVENT,
      details: {}
    });
    
    if (!results || !Array.isArray(results) || results.length === 0) return 0;

    let count = 0;
    for (const item of results) {
      if (item.success && item.id) {
        await nativeStorage.markOutboxProcessed(item.id);
        await nativeStorage.addSyncLog(item.syncId || item.id, item.resultId || 'bg-sync');
        count++;
      }
    }

    console.log(`[BackgroundRunner] 🔄 ${count} items marcados como synced`);
    return count;
  } catch (err) {
    console.warn('[BackgroundRunner] Error leyendo resultados del runner:', err);
    return 0;
  }
}