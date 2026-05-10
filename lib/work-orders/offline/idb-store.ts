import { bumpWorkOrderOfflineListeners } from "./broadcast"
import { makeOutboxBundleId, type WorkOrderOfflineOutboxRecord } from "./types"

const DB_NAME = "equipify-work-order-offline-v1"
const DB_VERSION = 2
const STORE = "outbox"
const PHOTO_STORE = "pendingPhotoBlobs"
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

export function pendingPhotoBlobRowId(scopeKey: string, localId: string): string {
  return `${scopeKey}::${localId}`
}

type PendingPhotoBlobRow = {
  id: string
  scopeKey: string
  localId: string
  blob: Blob
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
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const ps = db.createObjectStore(PHOTO_STORE, { keyPath: "id" })
        ps.createIndex("scopeKey", "scopeKey", { unique: false })
      }
    }
  })
}

export async function putWorkOrderPendingPhotoBlob(args: {
  scopeKey: string
  localId: string
  blob: Blob
}): Promise<boolean> {
  try {
    const db = await openWorkOrderOfflineDb()
    if (!db.objectStoreNames.contains(PHOTO_STORE)) {
      db.close()
      return false
    }
    const id = pendingPhotoBlobRowId(args.scopeKey, args.localId)
    const row: PendingPhotoBlobRow = {
      id,
      scopeKey: args.scopeKey,
      localId: args.localId,
      blob: args.blob,
    }
    const tx = db.transaction(PHOTO_STORE, "readwrite")
    tx.objectStore(PHOTO_STORE).put(row)
    await txDone(tx)
    db.close()
    return true
  } catch {
    return false
  }
}

export async function getWorkOrderPendingPhotoBlob(scopeKey: string, localId: string): Promise<Blob | null> {
  try {
    const db = await openWorkOrderOfflineDb()
    if (!db.objectStoreNames.contains(PHOTO_STORE)) {
      db.close()
      return null
    }
    const id = pendingPhotoBlobRowId(scopeKey, localId)
    const tx = db.transaction(PHOTO_STORE, "readonly")
    const row = (await reqToPromise(tx.objectStore(PHOTO_STORE).get(id))) as PendingPhotoBlobRow | undefined
    await txDone(tx)
    db.close()
    return row?.blob ?? null
  } catch {
    return null
  }
}

export async function deletePendingPhotoBlob(scopeKey: string, localId: string): Promise<void> {
  try {
    const db = await openWorkOrderOfflineDb()
    if (!db.objectStoreNames.contains(PHOTO_STORE)) {
      db.close()
      return
    }
    const id = pendingPhotoBlobRowId(scopeKey, localId)
    const tx = db.transaction(PHOTO_STORE, "readwrite")
    tx.objectStore(PHOTO_STORE).delete(id)
    await txDone(tx)
    db.close()
  } catch {
    // ignore
  }
}

export async function deleteAllPendingPhotoBlobsForScope(scopeKey: string): Promise<void> {
  try {
    const db = await openWorkOrderOfflineDb()
    if (!db.objectStoreNames.contains(PHOTO_STORE)) {
      db.close()
      return
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite")
      const store = tx.objectStore(PHOTO_STORE)
      const idx = store.index("scopeKey")
      const req = idx.openCursor(IDBKeyRange.only(scopeKey))
      req.onerror = () => reject(req.error ?? new Error("cursor failed"))
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        cursor.delete()
        cursor.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("tx failed"))
    })
    db.close()
  } catch {
    // ignore
  }
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
  await deleteAllPendingPhotoBlobsForScope(scopeKey)
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
