import { isWorkOrderPhotoCategoryMime, WO_ATTACHMENT_MAX_BYTES } from "@/lib/work-orders/work-order-tab-data"
import type { WorkOrder } from "@/lib/mock-data"
import {
  getWorkOrderOfflineRecordForScope,
  putWorkOrderPendingPhotoBlob,
  deletePendingPhotoBlob,
  deleteWorkOrderOfflineForScope,
} from "./idb-store"
import { putOfflineBundleMergePatch } from "./concurrency-put"
import { makeWorkOrderOfflineScopeKey, type WorkOrderOfflinePendingPhotoMeta } from "./types"

/** Safer default than server max — keeps offline queue smaller on shared tablets. */
export const WO_OFFLINE_QUEUED_PHOTO_MAX_BYTES = 10 * 1024 * 1024

/** Cap queued images per work order / user scope. */
export const WO_OFFLINE_MAX_PENDING_PHOTOS_PER_SCOPE = 24

export function validateOfflineQueuedWorkOrderPhoto(file: File): string | null {
  if (!isWorkOrderPhotoCategoryMime(file.type)) {
    return "Only photos can be saved offline (JPEG, PNG, WebP, GIF). PDFs and documents need a connection."
  }
  if (file.size > WO_OFFLINE_QUEUED_PHOTO_MAX_BYTES) {
    return `Photo too large for offline queue (max ${Math.round(WO_OFFLINE_QUEUED_PHOTO_MAX_BYTES / (1024 * 1024))} MB).`
  }
  if (file.size > WO_ATTACHMENT_MAX_BYTES) {
    return `File exceeds work order attachment limit (${Math.round(WO_ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB).`
  }
  return null
}

export async function appendWorkOrderOfflinePhotoQueue(args: {
  organizationId: string
  userId: string
  workOrder: WorkOrder
  dbNotes: string
  files: File[]
}): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const { organizationId, userId, workOrder, dbNotes, files } = args
  if (files.length === 0) return { ok: false, message: "No files selected." }

  const scopeKey = makeWorkOrderOfflineScopeKey(organizationId, userId, workOrder.id)
  const existing = await getWorkOrderOfflineRecordForScope(scopeKey)
  const currentCount = existing?.payload.pendingPhotos?.length ?? 0

  for (const file of files) {
    const err = validateOfflineQueuedWorkOrderPhoto(file)
    if (err) return { ok: false, message: err }
  }

  if (currentCount + files.length > WO_OFFLINE_MAX_PENDING_PHOTOS_PER_SCOPE) {
    return {
      ok: false,
      message: `Too many photos in the offline queue (max ${WO_OFFLINE_MAX_PENDING_PHOTOS_PER_SCOPE} per job). Sync or discard some first.`,
    }
  }

  const metas: WorkOrderOfflinePendingPhotoMeta[] = []
  const storedLocalIds: string[] = []

  for (const file of files) {
    const localId = crypto.randomUUID()
    const stored = await putWorkOrderPendingPhotoBlob({ scopeKey, localId, blob: file })
    if (!stored) {
      for (const id of storedLocalIds) {
        await deletePendingPhotoBlob(scopeKey, id)
      }
      return {
        ok: false,
        message:
          "Could not store photos on this device (storage unavailable or full). Stay online to upload, or free space and try again.",
      }
    }
    storedLocalIds.push(localId)
    metas.push({
      localId,
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      sizeBytes: file.size,
      queuedAtIso: new Date().toISOString(),
    })
  }

  const put = await putOfflineBundleMergePatch({
    organizationId,
    userId,
    workOrder,
    dbNotes,
    patch: { appendPendingPhotos: metas },
  })

  if (!put.ok) {
    for (const id of storedLocalIds) {
      await deletePendingPhotoBlob(scopeKey, id)
    }
    const message =
      put.reason === "syncing"
        ? "Sync is in progress — wait for it to finish, then add photos again."
        : put.reason === "conflict"
          ? "Resolve the server conflict before adding more offline photos."
          : "Could not update offline draft."
    return { ok: false, message }
  }

  return { ok: true, count: metas.length }
}

export async function removeWorkOrderOfflineQueuedPhoto(args: {
  organizationId: string
  userId: string
  workOrder: WorkOrder
  dbNotes: string
  localId: string
}): Promise<void> {
  const scopeKey = makeWorkOrderOfflineScopeKey(args.organizationId, args.userId, args.workOrder.id)
  const put = await putOfflineBundleMergePatch({
    organizationId: args.organizationId,
    userId: args.userId,
    workOrder: args.workOrder,
    dbNotes: args.dbNotes,
    patch: { removePendingPhotoLocalIds: [args.localId] },
  })
  if (put.ok) {
    await deletePendingPhotoBlob(scopeKey, args.localId)
    return
  }
  if (put.reason === "no_changes") {
    await deleteWorkOrderOfflineForScope(scopeKey)
    await deletePendingPhotoBlob(scopeKey, args.localId)
  }
}
