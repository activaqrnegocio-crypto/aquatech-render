import Dexie, { type Table } from 'dexie';

export interface OutboxItem {
  id?: number;
  type: 'MESSAGE' | 'EXPENSE' | 'DAY_START' | 'DAY_END' | 'PHASE_COMPLETE' | 'MEDIA_UPLOAD' | 'QUOTE' | 'MATERIAL';
  projectId: number;
  payload: any;
  timestamp: number;
  lat?: number;
  lng?: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

export interface AuthCache {
  id: string; // 'last_session'
  username: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
  userId: string;
  lastLogin: number;
}

export class OfflineDatabase extends Dexie {
  outbox!: Table<OutboxItem>;
  auth!: Table<AuthCache>;

  constructor() {
    super('AquatechOfflineDB');
    this.version(2).stores({
      outbox: '++id, projectId, status, timestamp',
      auth: 'id'
    });
  }
}

export const db = new OfflineDatabase();
