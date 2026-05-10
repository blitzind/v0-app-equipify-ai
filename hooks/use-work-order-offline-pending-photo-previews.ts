"use client"

import { useEffect, useRef, useState } from "react"
import { WORK_ORDER_OFFLINE_BUMP_EVENT } from "@/lib/work-orders/offline/broadcast"
import { getWorkOrderOfflineRecordForScope, getWorkOrderPendingPhotoBlob } from "@/lib/work-orders/offline/idb-store"
import { makeWorkOrderOfflineScopeKey } from "@/lib/work-orders/offline/types"

export type OfflinePendingPhotoPreview = {
  localId: string
  url: string
  name: string
}

/**
 * Object URLs for pending offline work-order photos (IndexedDB blobs).
 * Revokes URLs on dependency change / unmount.
 */
export function useWorkOrderOfflinePendingPhotoPreviews(
  organizationId: string | null | undefined,
  userId: string | null | undefined,
  workOrderId: string | null | undefined,
): OfflinePendingPhotoPreview[] {
  const [rows, setRows] = useState<OfflinePendingPhotoPreview[]>([])
  const urlsRef = useRef<string[]>([])

  useEffect(() => {
    if (!organizationId || !userId || !workOrderId) {
      urlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u)
        } catch {
          // ignore
        }
      })
      urlsRef.current = []
      setRows([])
      return
    }
    const scopeKey = makeWorkOrderOfflineScopeKey(organizationId, userId, workOrderId)
    let alive = true

    const load = async () => {
      urlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u)
        } catch {
          // ignore
        }
      })
      urlsRef.current = []

      const rec = await getWorkOrderOfflineRecordForScope(scopeKey)
      const metas = rec?.payload.pendingPhotos ?? []
      const newUrls: string[] = []
      const next: OfflinePendingPhotoPreview[] = []
      for (const m of metas) {
        const blob = await getWorkOrderPendingPhotoBlob(scopeKey, m.localId)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        newUrls.push(url)
        next.push({ localId: m.localId, url, name: m.fileName })
      }
      if (!alive) {
        newUrls.forEach((u) => {
          try {
            URL.revokeObjectURL(u)
          } catch {
            // ignore
          }
        })
        return
      }
      urlsRef.current = newUrls
      setRows(next)
    }

    void load()
    const onBump = () => void load()
    window.addEventListener(WORK_ORDER_OFFLINE_BUMP_EVENT, onBump)
    return () => {
      alive = false
      window.removeEventListener(WORK_ORDER_OFFLINE_BUMP_EVENT, onBump)
      urlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u)
        } catch {
          // ignore
        }
      })
      urlsRef.current = []
    }
  }, [organizationId, userId, workOrderId])

  return rows
}
