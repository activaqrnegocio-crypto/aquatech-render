package com.aquatech.crm;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeWebViewClient;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.community.database.sqlite.CapacitorSQLitePlugin;
import java.io.File;
import java.io.FileWriter;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    private static final String PREF_NAME = "aquatech_push";
    private static final String KEY_PUSH_ROUTE = "pending_push_route";
    private static final String PENDING_NAV_FILE = "pending_nav.json";
    private boolean notificationHandled = false;
    private String pendingRoute = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register SQLite plugin
        registerPlugin(CapacitorSQLitePlugin.class);
        // Register BackgroundRunner plugin
        registerPlugin(io.ionic.backgroundrunner.plugin.BackgroundRunnerPlugin.class);

        // ── INTERCEPTAR NAVEGACIONES http:// → https:// ──────────────────────
        // Problema: Capacitor configura el WebView para https://, pero algunas
        // URLs internas (FCM, pending-nav, NextAuth redirects) usan http://.
        // Capacitor's BridgeWebViewClient abre Chrome para http:// que no
        // coincide con el server URL (https://). La solución correcta es:
        //   1. Extender BridgeWebViewClient (preserva toda la lógica nativa)
        //   2. Solo interceptar http:// → convertir a https:// con view.loadUrl()
        //   3. NO hacer soft-navigation (history.pushState) — rompe cookies de auth
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                            String url = request.getUrl().toString();
                            String scheme = request.getUrl().getScheme();

                            // Interceptar SOLO http:// (no https://).
                            // Convertir a https:// y cargar como navegación completa
                            // dentro del WebView. Esto preserva cookies, redireciones
                            // y el flujo de autenticación de NextAuth correctamente.
                            if ("http".equals(scheme)) {
                                String httpsUrl = url.replaceFirst("^http://", "https://");
                                Log.d(TAG, "🔄 http→https (navegación completa): " + httpsUrl);
                                view.loadUrl(httpsUrl);
                                return true; // Nosotros lo manejamos
                            }

                            // Para https://, capacitor://, etc. usar la lógica
                            // de Capacitor (incluye permitir nuestro server URL)
                            return super.shouldOverrideUrlLoading(view, request);
                        }
                    });
                    Log.d(TAG, "✅ BridgeWebViewClient con http→https instalado");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error instalando WebViewClient: " + e.getMessage());
            }
        }, 800); // Esperar 800ms a que el bridge esté listo
        // ─────────────────────────────────────────────────────────────────────
        
        // Manejar el intent de notificación
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    /**
     * Maneja el Intent cuando la notificación es tocada.
     * v440: SIEMPRE procesar - quitar notificationHandled
     */
    private void handleNotificationIntent(Intent intent) {
        Log.d(TAG, "handleNotificationIntent llamado");
        
        // v440: NO verificar notificationHandled - siempre procesar
        //if (notificationHandled) {
        //    Log.d(TAG, "Ya procesado, ignorando");
        //    return;
        //}
        
        if (intent == null) {
            Log.w(TAG, "Intent es null");
            return;
        }
        
        Bundle extras = intent.getExtras();
        if (extras != null) {
            Log.d(TAG, "Extras size: " + extras.size());
            for (String key : extras.keySet()) {
                Log.d(TAG, "Extra: " + key + " = " + extras.get(key));
            }
        }
        
        String pushUrl = intent.getStringExtra("push_url");
        if (pushUrl == null) {
            pushUrl = intent.getStringExtra("url");
        }
        
        Log.d(TAG, "pushUrl: " + (pushUrl != null ? pushUrl : "NULL"));
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            // v440: NO setear notificationHandled - siempre procesar
            pendingRoute = pushUrl;
            Log.d(TAG, "Notificación tocada - guardando: " + pushUrl);
            
            // v438: GUARDAR EN ARCHIVO JSON (para PendingNavPlugin)
            saveToJsonFile(pushUrl);
            
            // También en SharedPreferences
            saveToSharedPreferences(pushUrl);
            
            // GUARDAR en Capacitor Preferences - usar el mismo mecanismo que el plugin
            saveToCapacitorPreferences(pushUrl);
            
            // v452: Guardar en variable global (mas confiable)
            saveToGlobalVar(pushUrl);
        }
    }
    
    /**
     * Guarda en archivo JSON - leído por PendingNavPlugin
     */
    private void saveToJsonFile(String route) {
        if (route == null || route.isEmpty()) return;
        
        try {
            File file = new File(getFilesDir(), PENDING_NAV_FILE);
            FileWriter writer = new FileWriter(file);
            writer.write("{\"url\":\"" + route.replace("\"", "\\\"") + "\",\"tag\":\"\"}");
            writer.flush();
            writer.close();
            Log.d(TAG, "✅ Guardado en JSON: " + route);
        } catch (Exception e) {
            Log.e(TAG, "Error guardando JSON: " + e.getMessage());
        }
    }
    
    /**
     * Guarda en SharedPreferences
     */
    private void saveToSharedPreferences(String route) {
        if (route == null || route.isEmpty()) return;
        
        try {
            SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            prefs.edit().putString(KEY_PUSH_ROUTE, route).apply();
            Log.d(TAG, "✅ Guardado en SharedPreferences: " + route);
        } catch (Exception e) {
            Log.e(TAG, "Error SharedPreferences: " + e.getMessage());
        }
    }
    
    /**
     * Guarda en Capacitor Preferences - este es el storage que usa el plugin Preferences
     * v439: Guardar donde Capacitor puede encontrar
     */
    private void saveToCapacitorPreferences(String route) {
        if (route == null || route.isEmpty()) return;
        
        try {
            // Usar SharedPreferences con el nombre que Capacitor Preferences usa
            SharedPreferences prefs = getSharedPreferences("CapacitorPreferences", MODE_PRIVATE);
            prefs.edit().putString("pending_push_route", route).apply();
            Log.d(TAG, "✅ Guardado en CapacitorPreferences: " + route);
        } catch (Exception e) {
            Log.e(TAG, "Error CapacitorPreferences: " + e.getMessage());
        }
    }
    
    /**
     * Intenta guardar en variable global (mas confiable que localStorage).
     * v453: Tambien guardar en localStorage para cold start
     */
    private void saveToGlobalVar(String route) {
        if (route == null || route.isEmpty()) return;
        
        String safeRoute = route.replace("'", "\\'");
        // Guardar en variable global + dispatch event + localStorage para cold start
        String js = "window.__pendingPushRoute = '" + safeRoute + "'; " +
            "try { localStorage.setItem('pending_push_route', '" + safeRoute + "'); } catch(e) {} " +
            "console.log('[Native] Guardado en variable global:', '" + safeRoute + "'); " +
            "window.dispatchEvent(new CustomEvent('pushRoute',{detail:'" + safeRoute + "'}));";
        
        Log.d(TAG, "JS para guardar: " + js);
        attemptSave(0, js);
    }
    
    private void attemptSave(final int attempt, final String js) {
        if (attempt >= 3) {
            Log.w(TAG, "Máximo de intentos alcanzado");
            return;
        }
        
        final int[] delays = {500, 1000, 2000};
        final int delay = delays[attempt];
        
        Log.d(TAG, "Intento " + (attempt + 1) + " en " + delay + "ms");
        
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().post(() -> {
                        try {
                            bridge.getWebView().evaluateJavascript(js, null);
                            Log.d(TAG, "✅ Guardado en intento " + (attempt + 1));
                        } catch (Exception e) {
                            Log.e(TAG, "Error evaluateJavascript: " + e.getMessage());
                            if (attempt < 2) attemptSave(attempt + 1, js);
                        }
                    });
                } else {
                    Log.w(TAG, "WebView null, retry en " + delay + "ms");
                    if (attempt < 2) attemptSave(attempt + 1, js);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error en intento " + attempt + ": " + e.getMessage());
                if (attempt < 2) attemptSave(attempt + 1, js);
            }
        }, delay);
    }
}