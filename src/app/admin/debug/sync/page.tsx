'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { db, type SyncLog } from '@/lib/db';

import { 
  Terminal, 
  RefreshCw, 
  Trash2, 
  Info, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Activity,
  Wifi,
  WifiOff,
  Package,
  Clock
} from 'lucide-react';

const formatLogDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false
  }).format(new Date(timestamp));
};

const timeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'ahora mismo';
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
};


export default function SyncLogPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // v333: Robot status
  const [robotStatus, setRobotStatus] = useState<{
    alive: boolean;
    lastHeartbeat: number | null;
    swVersion: string;
    pendingItems: number;
    lastSync: number | null;
    isOnline: boolean;
  }>({
    alive: false,
    lastHeartbeat: null,
    swVersion: '',
    pendingItems: 0,
    lastSync: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
  });

  const fetchRobotStatus = useCallback(async () => {
    try {
      // Last heartbeat
      const lastHeartbeat = await db.syncLogs
        .where('type').equals('heartbeat')
        .reverse()
        .first();
      
      // Pending outbox items
      const pendingItems = await db.outbox
        .where('status')
        .anyOf(['pending', 'failed'])
        .count();

      // Last successful sync
      const lastSyncLog = await db.syncLogs
        .where('level').equals('success')
        .reverse()
        .first();

      // SW version
      let swVersion = '';
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        swVersion = navigator.serviceWorker.controller.scriptURL.match(/v=([^&]+)/)?.[1] || '';
      }

      const isAlive = lastHeartbeat 
        ? (Date.now() - lastHeartbeat.timestamp) < 90000 // alive if heartbeat < 90s
        : false;

      setRobotStatus({
        alive: isAlive,
        lastHeartbeat: lastHeartbeat?.timestamp || null,
        swVersion,
        pendingItems,
        lastSync: lastSyncLog?.timestamp || null,
        isOnline: navigator.onLine
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await db.syncLogs.orderBy('timestamp').reverse().toArray();
      setLogs(allLogs);
      await fetchRobotStatus();
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Refresh every 3 seconds for heartbeat responsiveness
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Also refresh on online/offline
  useEffect(() => {
    const update = () => fetchRobotStatus();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const clearLogs = async () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los logs?')) {
      await db.syncLogs.clear();
      fetchLogs();
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'success': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'error': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'warn': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Terminal className="w-8 h-8 text-blue-500" />
              Logs del Robot (PWA)
            </h1>
            <p className="text-slate-400 mt-2">
              Monitoreo en tiempo real de la sincronización en segundo plano.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button 
              onClick={clearLogs}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/20"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar
            </button>
          </div>
        </div>

        {/* v333: Robot Status Panel */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {/* Robot Alive */}
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${
            robotStatus.alive 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-rose-500/5 border-rose-500/20'
          }`}>
            <Activity className={`w-5 h-5 ${robotStatus.alive ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Robot</div>
              <div className={`text-sm font-bold ${robotStatus.alive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {robotStatus.alive ? 'VIVO' : 'DORMIDO'}
              </div>
            </div>
          </div>

          {/* Last Heartbeat */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Latido</div>
              <div className="text-sm font-bold text-white">
                {robotStatus.lastHeartbeat ? timeAgo(robotStatus.lastHeartbeat) : '—'}
              </div>
            </div>
          </div>

          {/* Pending Items */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-3">
            <Package className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Pendientes</div>
              <div className={`text-sm font-bold ${robotStatus.pendingItems > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {robotStatus.pendingItems}
              </div>
            </div>
          </div>

          {/* Connection */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-3">
            {robotStatus.isOnline ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-rose-400" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Red</div>
              <div className={`text-sm font-bold ${robotStatus.isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                {robotStatus.isOnline ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>
          </div>

          {/* SW Version */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-3">
            <Terminal className="w-5 h-5 text-violet-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Versión SW</div>
              <div className="text-sm font-bold text-violet-400 font-mono">
                {robotStatus.swVersion || '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Nivel</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Fecha/Hora</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Tipo</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensaje</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                      No hay logs registrados todavía. El robot está durmiendo.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedId === log.id ? 'bg-slate-800/50' : ''}`}
                        onClick={() => log.details ? setExpandedId(expandedId === log.id ? null : log.id!) : null}
                      >
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center justify-center p-1.5 rounded-md border ${getLevelClass(log.level)}`}>
                            {getLevelIcon(log.level)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-400 whitespace-nowrap">
                          {formatLogDate(log.timestamp)}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-tight ${
                            log.type === 'heartbeat' ? 'bg-violet-500/15 text-violet-400' :
                            log.type === 'network' ? 'bg-blue-500/15 text-blue-400' :
                            log.type === 'bulk-sync' ? 'bg-cyan-500/15 text-cyan-400' :
                            log.type === 'outbox' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {log.type || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {log.message}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {log.details && (
                            <button className="text-slate-500 hover:text-white transition-colors">
                              {expandedId === log.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === log.id && log.details && (
                        <tr className="bg-slate-900/80 border-l-2 border-l-blue-500">
                          <td colSpan={5} className="px-8 py-4">
                            <pre className="text-xs font-mono text-blue-300 whitespace-pre-wrap break-all bg-black/40 p-4 rounded-lg border border-slate-800">
                              {log.details}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${robotStatus.alive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {robotStatus.alive ? 'Robot activo — actualización cada 3s' : 'Robot inactivo'}
          </div>
          <div className="text-slate-600">|</div>
          <div>Mostrando últimos eventos</div>
        </div>
      </div>
    </div>
  );
}
