import type { Session, JournalEntry, ResetRecord } from '../types';

const DB = 'optiflow-db'; const VERSION = 1;
const STORES = ['sessions', 'journal', 'resets', 'demoSessions'] as const;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put<T extends { id: string }>(store: string, value: T): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
async function all<T>(store: string): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => reject(req.error);
  });
}
async function remove(storeName: string, id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
async function clear(store: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export const store = {
  saveSession: (s: Session) => put(s.isDemo ? 'demoSessions' : 'sessions', s),
  deleteSession: (id: string) => remove('sessions', id),
  sessions: () => all<Session>('sessions'),
  demoSessions: () => all<Session>('demoSessions'),
  saveJournal: (e: JournalEntry) => put('journal', e),
  journal: () => all<JournalEntry>('journal'),
  saveReset: (r: ResetRecord) => put('resets', r),
  resets: () => all<ResetRecord>('resets'),
  clearPersonal: async () => { await clear('sessions'); await clear('journal'); await clear('resets'); },
  clearDemo: () => clear('demoSessions'),
};

export async function exportAll(): Promise<string> {
  const data = {
    exportedAt: new Date().toISOString(), app: 'OptiFlow',
    note: 'Session summaries, voluntary responses, preferences and notes only. No raw video or face images are stored.',
    sessions: await store.sessions(), journal: await store.journal(), resets: await store.resets(),
  };
  return JSON.stringify(data, null, 2);
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
