'use client';

/**
 * Крошечный IndexedDB-стор для черновиков сессий психолога.
 * Офлайн-патч (UC-2): незавершённая запись не теряется при потере сети/перезагрузке.
 */
const DB = 'eSPSMS';
const STORE = 'session_drafts';
const AUDIO = 'audio_drafts'; // UC-2 шаг 2: незавершённое аудио не теряется при потере сети

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    // версия 2: добавлен store для аудио-blob
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(AUDIO)) db.createObjectStore(AUDIO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export type SessionDraft = { rawNote: string; dapData: string; dapAssessment: string; dapPlan: string; type: string };

export const saveDraft = (caseId: string, d: SessionDraft) => tx(STORE, 'readwrite', (s) => s.put(d, caseId));
export const loadDraft = (caseId: string) => tx<SessionDraft>(STORE, 'readonly', (s) => s.get(caseId));
export const clearDraft = (caseId: string) => tx(STORE, 'readwrite', (s) => s.delete(caseId));

// Аудио-черновик (Blob) — IndexedDB хранит Blob нативно.
export const saveAudio = (caseId: string, blob: Blob) => tx(AUDIO, 'readwrite', (s) => s.put(blob, caseId));
export const loadAudio = (caseId: string) => tx<Blob>(AUDIO, 'readonly', (s) => s.get(caseId));
export const clearAudio = (caseId: string) => tx(AUDIO, 'readwrite', (s) => s.delete(caseId));
