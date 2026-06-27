// runners/background.js
// Este archivo corre en un entorno JavaScript headless (SIN WebView)
// background-runner plugin lo ejecuta automáticamente según la config en capacitor.config.ts

// ============================================
// STORE SYNC DATA - Recibe datos de la app y los guarda en CapacitorKV
// ============================================
addEventListener('storeSyncData', async (resolve, reject, args) => {
  console.log('[BackgroundRunner] storeSyncData event fired');
  
  try {
    // Guardar pendingOutbox en CapacitorKV
    if (args.pendingOutbox) {
      await CapacitorKV.set({ key: 'pendingOutbox', value: args.pendingOutbox });
      const items = JSON.parse(args.pendingOutbox);
      console.log(`[BackgroundRunner] 📦 ${items.length} items guardados en CapacitorKV`);
    }
    
    // Guardar authToken en CapacitorKV
    if (args.authToken) {
      await CapacitorKV.set({ key: 'authToken', value: args.authToken });
      console.log('[BackgroundRunner] 🔑 Token guardado en CapacitorKV');
    }
    
    // Guardar apiUrl en CapacitorKV
    if (args.apiUrl) {
      await CapacitorKV.set({ key: 'apiUrl', value: args.apiUrl });
      console.log('[BackgroundRunner] 🌐 API URL guardada en CapacitorKV');
    }
    
    resolve();
  } catch (err) {
    console.error('[BackgroundRunner] Error en storeSyncData:', err);
    reject(err);
  }
});

// ============================================
// GET SYNC RESULTS - Devuelve los resultados de sync a la app
// ============================================
addEventListener('getSyncResults', async (resolve, reject, args) => {
  console.log('[BackgroundRunner] getSyncResults event fired');
  
  try {
    // Leer resultados de CapacitorKV
    const resultData = await CapacitorKV.get({ key: 'bgSyncResults' });
    
    if (!resultData?.value) {
      resolve([]);
      return;
    }
    
    const results = JSON.parse(resultData.value);
    
    // Limpiar resultados después de leerlos
    await CapacitorKV.remove({ key: 'bgSyncResults' });
    
    console.log(`[BackgroundRunner] 📋 ${results.length} resultados devueltos a la app`);
    resolve(results);
  } catch (err) {
    console.error('[BackgroundRunner] Error en getSyncResults:', err);
    reject([]);
  }
});

// ============================================
// SYNC EVENT - Procesa el outbox en background
// ============================================
addEventListener('outboxSync', async (resolve, reject) => {
  console.log('[BackgroundRunner] outboxSync event fired');
  
  try {
    // Obtener sesión desde CapacitorKV
    const sessionData = await CapacitorKV.get({ key: 'authToken' });
    if (!sessionData?.value) {
      console.log('[BackgroundRunner] No hay sesión, omitiendo sync');
      resolve();
      return;
    }
    
    const session = JSON.parse(sessionData.value);
    
    // Obtener outbox pendiente desde CapacitorKV
    const outboxData = await CapacitorKV.get({ key: 'pendingOutbox' });
    if (!outboxData?.value) {
      console.log('[BackgroundRunner] No hay items pendientes');
      resolve();
      return;
    }
    
    const outboxItems = JSON.parse(outboxData.value);
    if (!Array.isArray(outboxItems) || outboxItems.length === 0) {
      console.log('[BackgroundRunner] Outbox vacío');
      resolve();
      return;
    }
    
    console.log(`[BackgroundRunner] Procesando ${outboxItems.length} items...`);
    
    // Obtener API URL desde CapacitorKV (lo escribe la app al exportar outbox)
    const apiUrlData = await CapacitorKV.get({ key: 'apiUrl' });
    const apiUrl = apiUrlData?.value || 'https://aquatech-crm.onrender.com';
    let processedCount = 0;
    let failedCount = 0;
    const failedItems = [];
    
    for (const item of outboxItems) {
      try {
        const result = await processItem(item, apiUrl, session.token);
        if (result.success) {
          processedCount++;
        } else {
          failedCount++;
          // No es un error crítico, dejar para siguiente ciclo
          failedItems.push(item);
        }
      } catch (err) {
        console.error(`[BackgroundRunner] Error procesando item ${item.id}:`, err);
        failedCount++;
        failedItems.push(item);
      }
    }
    
    // Guardar items fallidos de vuelta en KV (con límite de reintentos)
    const maxRetries = 3;
    const remainingItems = failedItems.filter(item => (item.retries || 0) < maxRetries);
    const deadItems = failedItems.filter(item => (item.retries || 0) >= maxRetries);
    
    if (remainingItems.length > 0) {
      // Incrementar retries
      const retriedItems = remainingItems.map(item => ({
        ...item,
        retries: (item.retries || 0) + 1
      }));
      await CapacitorKV.set({
        key: 'pendingOutbox',
        value: JSON.stringify(retriedItems)
      });
    } else {
      await CapacitorKV.remove({ key: 'pendingOutbox' });
    }
    
    if (deadItems.length > 0) {
      console.warn(`[BackgroundRunner] ${deadItems.length} items descartados tras ${maxRetries} intentos`);
    }
    
    console.log(`[BackgroundRunner] Sync completado: ${processedCount} ok, ${failedCount} fallidos, ${remainingItems.length} pendientes`);
    
    // Guardar resultados para que la app los lea al reabrir
    const syncResults = [];
    const processedIds = outboxItems
      .filter(item => !failedItems.some(f => f.id === item.id))
      .map(item => ({
        id: item.id,
        syncId: item.syncId || item.id,
        success: true,
        resultId: `bg_${Date.now()}_${item.id}`
      }));
    if (processedIds.length > 0) {
      // Escribir resultados a CapacitorKV para que la app los procese
      await CapacitorKV.set({
        key: 'bgSyncResults',
        value: JSON.stringify(processedIds)
      });
    }
    
    // Limpiar outbox procesado de CapacitorKV (solo quedan los fallidos)
    if (failedItems.length === 0) {
      await CapacitorKV.remove({ key: 'pendingOutbox' });
    }
    
    // Notificar al usuario si hubo cambios
    if (processedCount > 0) {
      await CapacitorNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title: 'Aquatech CRM',
          body: `${processedCount} cambio${processedCount > 1 ? 's' : ''} sincronizado${processedCount > 1 ? 's' : ''}`,
          autoCancel: true,
        }]
      });
    }
    
    resolve();
  } catch (err) {
    console.error('[BackgroundRunner] Error en outboxSync:', err);
    reject(err);
  }
});

// ============================================
// HELPER: Procesar un item individual
// ============================================
async function processItem(item, apiUrl, token) {
  const headers = {
    'Content-Type': 'application/json',
    'x-sync-id': item.syncId || item.id,
    'Cookie': `next-auth.session-token=${token}`,
  };
  
  const { type, payload, id } = item;
  
  switch (type) {
    case 'MESSAGE': {
      const { projectId, ...msgPayload } = payload;
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(msgPayload),
      });
      if (!res.ok) throw new Error(`MESSAGE: ${res.status}`);
      return { success: true };
    }
    
    case 'EXPENSE': {
      const res = await fetch(`${apiUrl}/api/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`EXPENSE: ${res.status}`);
      return { success: true };
    }
    
    case 'DAY_START': {
      const res = await fetch(`${apiUrl}/api/day-records`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`DAY_START: ${res.status}`);
      return { success: true };
    }
    
    case 'DAY_END': {
      const res = await fetch(`${apiUrl}/api/day-records`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`DAY_END: ${res.status}`);
      return { success: true };
    }
    
    case 'PHASE_COMPLETE': {
      const { projectId, phaseId, ...phasePayload } = payload;
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/phases/${phaseId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(phasePayload),
      });
      if (!res.ok) throw new Error(`PHASE_COMPLETE: ${res.status}`);
      return { success: true };
    }
    
    case 'TEAM_UPDATE': {
      const { projectId, ...teamPayload } = payload;
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/team`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(teamPayload),
      });
      if (!res.ok) throw new Error(`TEAM_UPDATE: ${res.status}`);
      return { success: true };
    }
    
    default:
      throw new Error(`Tipo no soportado en background: ${type}`);
  }
}
