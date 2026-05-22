import Dexie, { type Table } from 'dexie';

export interface OutboxItem {
  id?: number;
  type: 'MESSAGE' | 'EXPENSE' | 'EXPENSE_DELETE' | 'DAY_START' | 'DAY_END' | 'PHASE_COMPLETE' | 'PHASE_UPDATE' | 'PHASE_CREATE' | 'TEAM_UPDATE' | 'MEDIA_UPLOAD' | 'GALLERY_UPLOAD' | 'GALLERY_DELETE' | 'GALLERY_RENAME' | 'QUOTE' | 'MATERIAL' | 'PROJECT' | 'PROJECT_UPDATE' | 'PROJECT_DELETE' | 'TASK' | 'TASK_STATUS_TOGGLE' | 'LOCATION';
  projectId: number;
  payload: any;
  timestamp: number;
  lat?: number;
  lng?: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  attempts?: number;
  syncId?: string;
  lastAttemptAt?: number;
  failReason?: string; // v373: Motivo del fallo permanente
}

export interface AuthCache {
  id: string; // 'last_session' or 'current'
  username: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'SUBCONTRATISTA' | 'SUPERADMIN' | 'ADMINISTRADORA';
  userId: string;
  permissions?: string | null; // v232: Store permissions for consistent offline UI
  lastLogin: number;
}

export interface MaterialCache {
  id: number;
  code: string;
  name: string;
  description?: string;
  unit?: string;
  unitPrice: number;
  category?: string;
  stock: number;
}

export interface ClientCache {
  id: number;
  name: string;
  ruc?: string;
  address?: string;
  phone?: string;
}

export interface CacheMetadata {
  id: string; // e.g., 'projects_bulk'
  lastSync: number;
  count: number;
  status: 'idle' | 'syncing' | 'error';
}

export interface UserCache {
  id: number | string;
  name: string;
  role: string;
}

export interface SyncLog {
  id?: number;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
  type?: string;
}


export class OfflineDatabase extends Dexie {
  outbox!: Table<OutboxItem>;
  auth!: Table<AuthCache>;
  authShadow!: Table<any>; // For the Service Worker fallback
  materialsCache!: Table<MaterialCache>;
  clientsCache!: Table<ClientCache>;
  quotesCache!: Table<any>;
  projectsCache!: Table<any>;
  appointmentsCache!: Table<any>;
  chatCache!: Table<any>;
  dashboardCache!: Table<any>;
  cacheMetadata!: Table<CacheMetadata>;
  usersCache!: Table<UserCache>;
  syncLogs!: Table<SyncLog>;
  drafts!: Table<{ key: string; value: any }>;


  constructor() {
    super('AquatechOfflineDB');
    this.version(2).stores({
      outbox: '++id, projectId, status, timestamp',
      auth: 'id'
    });
    this.version(3).stores({
      outbox: '++id, projectId, status, timestamp',
      auth: 'id',
      materialsCache: 'id, code, name, category'
    });
    this.version(6).stores({
      outbox: '++id, projectId, status, timestamp, type',
      auth: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc'
    });
    this.version(7).stores({
      outbox: '++id, projectId, status, timestamp, type',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc'
    });
    this.version(8).stores({
      outbox: '++id, projectId, status, timestamp, type',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title',
      appointmentsCache: 'id, projectId',
      chatCache: 'projectId'
    });
    this.version(9).stores({
      outbox: '++id, projectId, status, timestamp, type',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title',
      appointmentsCache: 'id, projectId',
      chatCache: 'projectId',
      dashboardCache: 'id'
    });
    this.version(11).stores({
      outbox: '++id, projectId, status, timestamp, type',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title, lastAccessedAt',
      appointmentsCache: 'id, projectId',
      chatCache: 'projectId',
      dashboardCache: 'id',
      cacheMetadata: 'id'
    });
    this.version(12).stores({
      outbox: '++id, projectId, status, timestamp, type, attempts',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title, lastAccessedAt',
      appointmentsCache: 'id, projectId',
      chatCache: 'projectId',
      dashboardCache: 'id',
      cacheMetadata: 'id'
    });
    this.version(13).stores({
      outbox: '++id, projectId, status, timestamp, type, attempts',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title, lastAccessedAt',
      appointmentsCache: 'id, projectId',
      chatCache: 'projectId',
      dashboardCache: 'id',
      cacheMetadata: 'id',
      usersCache: 'id, name, role'
    });
    this.version(15).stores({
      outbox: '++id, projectId, status, timestamp, type, attempts',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title, lastAccessedAt',
      appointmentsCache: 'id, projectId, userId',
      chatCache: 'projectId',
      dashboardCache: 'id',
      cacheMetadata: 'id',
      usersCache: 'id, name, role',
      syncLogs: '++id, timestamp, level, type'
    });
    // v16: drafts table — stores File objects (IndexedDB structured clone)
    this.version(16).stores({
      outbox: '++id, projectId, status, timestamp, type, attempts',
      auth: 'id',
      authShadow: 'id',
      materialsCache: 'id, code, name, category',
      clientsCache: 'id, name, ruc',
      quotesCache: 'id, clientName, projectId',
      projectsCache: 'id, title, lastAccessedAt',
      appointmentsCache: 'id, projectId, userId',
      chatCache: 'projectId',
      dashboardCache: 'id',
      cacheMetadata: 'id',
      usersCache: 'id, name, role',
      syncLogs: '++id, timestamp, level, type',
      drafts: 'key'  // key-value store for wizard drafts, preserves File objects (structured clone)
    });

  }
}

export const db = new OfflineDatabase();
