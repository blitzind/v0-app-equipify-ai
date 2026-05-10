import { bumpWorkOrderOfflineListeners } from "./broadcast"
import { makeOutboxBundleId, type WorkOrderOfflineOutboxRecord } from "./types"

const DB_NAME = "equipify-work-order-offline-v1"
const DB_VERSION = 1
const STORE = "outbox"
const LS_PREFIX = "equipify-wo-offline-v1::"

function lsKeyForScope(scopeKey: string): string {
  return `${LS_PREFIX}${scopeKey}`
}

function safeParseRecord(raw: string | null): WorkOrderOfflineOutboxRecord | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as WorkOrderOfflineOutboxRecord
  } catch {
    return undefined
  }
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"))
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"))
  })
}

export async function openWorkOrderOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.")
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" })
        store.createIndex("scopeKey", "scopeKey", { unique: false })
        store.createIndex("status", "status", { unique: false })
      }
    }
  })
}

export async function putWorkOrderOfflineRecord(record: WorkOrderOfflineOutboxRecord): Promise<void> {
  try {
    const db = await openWorkOrderOfflineDb()
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(record)
    await txDone(tx)
    db.close()
  } catch {
    try {
      localStorage.setItem(lsKeyForScope(record.scopeKey), JSON.stringify(record))
    } catch {
      // ignore quota / private mode
    }
  }
  bumpWorkOrderOfflineListeners()
}

export async function getWorkOrderOfflineRecordForScope(scopeKey: string): Promise<WorkOrderOfflineOutboxRecord | undefined> {
  const id = makeOutboxBundleId(scopeKey)
  try {
    const db = await openWorkOrderOfflineDb()
    const tx = db.transaction(STORE, "readonly")
    const rec = await reqToPromise(tx.objectStore(STORE).get(id))
    await txDone(tx)
    db.close()
    if (rec) return rec as WorkOrderOfflineOutboxRecord
  } catch {
    // fall through to localStorage
  }
  return safeParseRecord(
    typeof localStorage !== "undefined" ? localStorage.getItem(lsKeyForScope(scopeKey)) : null,
  )
}

export async function deleteWorkOrderOfflineForScope(scopeKey: string): Promise<void> {
  const id = makeOutboxBundleId(scopeKey)
  try {
    const db = await openWorkOrderOfflineDb()
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(id)
    await txDone(tx)
    db.close()
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(lsKeyForScope(scopeKey))
  } catch {
    // ignore
  }
  bumpWorkOrderOfflineListeners()
}

export async function listWorkOrderOfflineRecordsForScope(scopeKey: string): Promise<WorkOrderOfflineOutboxRecord[]> {
  const one = await getWorkOrderOfflineRecordForScope(scopeKey)
  return one ? [one] : []
}

/** Pending / actionable rows for UI and replay. */
export function filterPendingOfflineRecords(rows: WorkOrderOfflineOutboxRecord[]): WorkOrderOfflineOutboxRecord[] {
  return rows.filter((r) => ["draft", "queued", "failed", "conflict"].includes(r.status))
}
