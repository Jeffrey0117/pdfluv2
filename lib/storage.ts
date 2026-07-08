import type { PageTranslation } from "@/lib/types";

const DB_NAME = "pdflove";
const STORE_NAME = "sessions";
const SESSION_KEY = "current";

export interface SavedSession {
  fileName: string;
  savedAt: number;
  pages: PageTranslation[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: SavedSession): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await requestToPromise(tx.objectStore(STORE_NAME).put(session, SESSION_KEY));
  } finally {
    db.close();
  }
}

export async function loadSession(): Promise<SavedSession | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const result = await requestToPromise(
      tx.objectStore(STORE_NAME).get(SESSION_KEY) as IDBRequest<SavedSession | undefined>
    );
    return result ?? null;
  } finally {
    db.close();
  }
}

export async function clearSession(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await requestToPromise(tx.objectStore(STORE_NAME).delete(SESSION_KEY));
  } finally {
    db.close();
  }
}
