import Dexie, { type Table } from 'dexie';

export interface OutboxItem {
  id?: number;
  type: 'MESSAGE' | 'EXPENSE' | 'DAY_START' | 'DAY_END' | 'PHASE_COMPLETE' | 'MEDIA_UPLOAD' | 'GALLERY_UPLOAD' | 'GALLERY_DELETE' | 'QUOTE' | 'MATERIAL' | 'PROJECT' | 'TASK' | 'TASK_STATUS_TOGGLE';
  projectId: number;
  payload: any;
  timestamp: number;
  lat?: number;
  lng?: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

export interface AuthCache {
  id: string; // 'last_session' or 'current'
  username: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'SUBCONTRATISTA' | 'SUPERADMIN' | 'ADMINISTRADORA';
  userId: string;
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
  }
}

export const db = new OfflineDatabase();
