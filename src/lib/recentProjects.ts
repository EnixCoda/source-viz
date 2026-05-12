// Tiny IndexedDB wrapper for persisting recent project handles.
// FileSystemDirectoryHandle is structured-cloneable, so it can be stored
// directly. Handles store the user's permission grant via the browser; we
// re-query/re-request permission before re-using them.

const DB_NAME = "source-viz";
const DB_VERSION = 1;
const STORE = "recent-projects";
const MAX_RECENTS = 5;

export type RecentProject = {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  lastOpenedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: "readonly" | "readwrite" | "versionchange", fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const result = fn(store);
        if (result instanceof Promise) {
          result.then(resolve, reject);
          return;
        }
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      })
  );
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  if (!("indexedDB" in window)) return [];
  try {
    const all = await tx<RecentProject[]>("readonly", (store) => store.getAll() as IDBRequest<RecentProject[]>);
    return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export async function rememberProject(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!("indexedDB" in window)) return;
  try {
    const project: RecentProject = {
      id: handle.name,
      name: handle.name,
      handle,
      lastOpenedAt: Date.now(),
    };
    await tx<void>("readwrite", (store) => {
      const r = store.put(project);
      return new Promise<void>((res, rej) => {
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
    });
    // Trim oldest entries beyond MAX_RECENTS
    const all = await listRecentProjects();
    if (all.length > MAX_RECENTS) {
      const toDelete = all.slice(MAX_RECENTS).map((p) => p.id);
      await tx<void>("readwrite", (store) => {
        for (const id of toDelete) store.delete(id);
        return new Promise<void>((res) => res());
      });
    }
  } catch (err) {
    console.warn("[recentProjects] rememberProject failed:", err);
  }
}

export async function forgetProject(id: string): Promise<void> {
  try {
    await tx<void>("readwrite", (store) => {
      const r = store.delete(id);
      return new Promise<void>((res, rej) => {
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
    });
  } catch (err) {
    console.warn("[recentProjects] forgetProject failed:", err);
  }
}

export type HandlePermission = "granted" | "prompt" | "denied" | "unsupported";

type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<"granted" | "prompt" | "denied">;
  requestPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<"granted" | "prompt" | "denied">;
};

export async function queryHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<HandlePermission> {
  const h = handle as PermissionCapableHandle;
  if (!h.queryPermission) return "unsupported";
  try {
    return (await h.queryPermission({ mode: "read" })) as HandlePermission;
  } catch {
    return "unsupported";
  }
}

export async function requestHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<HandlePermission> {
  const h = handle as PermissionCapableHandle;
  if (!h.requestPermission) return "unsupported";
  try {
    return (await h.requestPermission({ mode: "read" })) as HandlePermission;
  } catch {
    return "denied";
  }
}
