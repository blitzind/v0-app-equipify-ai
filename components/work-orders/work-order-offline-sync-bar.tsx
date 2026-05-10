"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw, Trash2, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { subscribeWorkOrderOfflineBump } from "@/lib/work-orders/offline/broadcast"
import {
  deleteWorkOrderOfflineForScope,
  filterPendingOfflineRecords,
  getWorkOrderOfflineRecordForScope,
  putWorkOrderOfflineRecord,
} from "@/lib/work-orders/offline/idb-store"
import { makeWorkOrderOfflineScopeKey } from "@/lib/work-orders/offline/types"
import { replayWorkOrderOfflineBundle } from "@/lib/work-orders/offline/replay-drawer"
import { formatWorkOrderOfflineReplayError } from "@/lib/work-orders/offline/replay-errors"
import { withWorkOrderOfflineReplayLock } from "@/lib/work-orders/offline/sync-lock"
import type { WorkOrder } from "@/lib/mock-data"
import { useToast } from "@/hooks/use-toast"

export type WorkOrderOfflineSyncBarProps = {
  organizationId: string | null
  userId: string | null
  workOrderId: string | null
  workOrder: WorkOrder | null
  usesTasksTable: boolean
  usesPartsLineItems: boolean
  canEdit: boolean
  /** After successful replay or discard */
  onAfterChange?: () => void
  /** Open conflict review (drawer/page provides dialog). */
  onConflict?: (message?: string) => void
  className?: string
}

function formatLocalSyncAttempt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

export function WorkOrderOfflineSyncBar({
  organizationId,
  userId,
  workOrderId,
  workOrder,
  usesTasksTable,
  usesPartsLineItems,
  canEdit,
  onAfterChange,
  onConflict,
  className,
}: WorkOrderOfflineSyncBarProps) {
  const { online } = useNetworkStatus()
  const { toast } = useToast()
  const [record, setRecord] = useState<Awaited<ReturnType<typeof getWorkOrderOfflineRecordForScope>>>(undefined)
  const [syncBusy, setSyncBusy] = useState(false)
  const syncInFlightRef = useRef(false)

  const scopeKey =
    organizationId && userId && workOrderId ? makeWorkOrderOfflineScopeKey(organizationId, userId, workOrderId) : null

  const refresh = useCallback(async () => {
    if (!scopeKey) {
      setRecord(undefined)
      return
    }
    const r = await getWorkOrderOfflineRecordForScope(scopeKey)
    setRecord(r)
  }, [scopeKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => subscribeWorkOrderOfflineBump(() => void refresh()), [refresh])

  if (!scopeKey || !canEdit || !workOrder) return null

  const pending = record ? filterPendingOfflineRecords([record]) : []
  const status = record?.status
  const isReplayInProgress = status === "syncing"
  const hasActionablePending = pending.length > 0
  const pendingPhotoCount = record?.payload.pendingPhotos?.length ?? 0
  const showBar =
    !online || hasActionablePending || status === "conflict" || status === "failed" || isReplayInProgress

  if (!showBar) return null

  const label = (() => {
    if (!online) return "Offline"
    if (status === "conflict") return "Review conflict"
    if (status === "failed") return "Sync failed"
    if (isReplayInProgress) return "Syncing…"
    if (hasActionablePending) return "Sync pending"
    return "Saved locally"
  })()

  async function handleSyncNow() {
    if (!organizationId || !workOrder || !scopeKey || !online) return
    if (syncInFlightRef.current || syncBusy) return

    const rec0 = await getWorkOrderOfflineRecordForScope(scopeKey)
    if (!rec0 || !filterPendingOfflineRecords([rec0]).length) return

    syncInFlightRef.current = true
    setSyncBusy(true)
    try {
      await withWorkOrderOfflineReplayLock(scopeKey, async () => {
        const rec = await getWorkOrderOfflineRecordForScope(scopeKey)
        if (!rec || !filterPendingOfflineRecords([rec]).length) return

        const attemptIso = new Date().toISOString()
        await putWorkOrderOfflineRecord({
          ...rec,
          status: "syncing",
          updatedAtIso: attemptIso,
          lastSyncAttemptAtIso: attemptIso,
          lastError: null,
        })

        const recForReplay = await getWorkOrderOfflineRecordForScope(scopeKey)
        if (!recForReplay || recForReplay.status !== "syncing") return

        const supabase = createBrowserSupabaseClient()
        const result = await replayWorkOrderOfflineBundle({
          supabase,
          organizationId,
          workOrder,
          usesTasksTable,
          usesPartsLineItems,
          record: recForReplay,
        })

        if (result.ok) {
          await deleteWorkOrderOfflineForScope(scopeKey)
          toast({ title: "Synced", description: "Local draft was applied to the work order." })
          onAfterChange?.()
        } else if (result.conflict) {
          const base = (await getWorkOrderOfflineRecordForScope(scopeKey)) ?? recForReplay
          await putWorkOrderOfflineRecord({
            ...base,
            status: "conflict",
            conflictServerUpdatedAt: result.serverUpdatedAt,
            updatedAtIso: new Date().toISOString(),
            lastError: null,
          })
          onConflict?.("Server copy changed since this draft started.")
          toast({
            variant: "destructive",
            title: "Sync paused — conflict",
            description: "Review local vs server, then discard or retry after resolving.",
          })
        } else {
          const fresh = (await getWorkOrderOfflineRecordForScope(scopeKey)) ?? recForReplay
          if (fresh.status === "syncing") {
            await putWorkOrderOfflineRecord({
              ...fresh,
              status: "failed",
              lastError: result.message,
              updatedAtIso: new Date().toISOString(),
            })
          }
          toast({
            variant: "destructive",
            title: "Sync failed",
            description: formatWorkOrderOfflineReplayError(result.message),
          })
        }
      })
    } finally {
      syncInFlightRef.current = false
      setSyncBusy(false)
      await refresh()
    }
  }

  async function handleDiscard() {
    if (!scopeKey || isReplayInProgress) return
    await deleteWorkOrderOfflineForScope(scopeKey)
    await refresh()
    toast({ title: "Local draft discarded" })
    onAfterChange?.()
  }

  const canSyncNow = hasActionablePending && online && status !== "conflict" && !isReplayInProgress
  const canDiscard = (hasActionablePending || status === "conflict" || status === "failed") && !isReplayInProgress

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {!online ? <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden /> : null}
      <span className="font-semibold text-foreground">{label}</span>
      {hasActionablePending && !online && pendingPhotoCount > 0 ? (
        <span className="text-muted-foreground">· {pendingPhotoCount} photo(s) pending upload</span>
      ) : null}
      {hasActionablePending && online && status !== "conflict" ? (
        <span className="text-muted-foreground">
          · Stored on this device — local technician draft ({pending.length}
          {pendingPhotoCount > 0 ? ` · ${pendingPhotoCount} photo(s) pending upload` : ""})
        </span>
      ) : null}
      {isReplayInProgress ? (
        <span className="text-muted-foreground">· Finishing sync — please keep this tab open</span>
      ) : null}
      {record?.lastSyncAttemptAtIso && status === "failed" ? (
        <span className="text-muted-foreground">
          · Last sync attempt: {formatLocalSyncAttempt(record.lastSyncAttemptAtIso)}
        </span>
      ) : null}
      {record?.lastError && status === "failed" ? (
        <span className="min-w-0 truncate text-destructive" title={record.lastError}>
          {record.lastError}
        </span>
      ) : null}
      {status === "failed" && online ? (
        <span className="text-muted-foreground">· Fix the issue if you can, then tap Sync now again</span>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {status === "conflict" ? (
          <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => onConflict?.()}>
            Review conflict
          </Button>
        ) : null}
        {canSyncNow ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-7 text-[11px] gap-1"
            disabled={syncBusy}
            onClick={() => void handleSyncNow()}
          >
            {syncBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Sync now
          </Button>
        ) : null}
        {canDiscard ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1"
            disabled={syncBusy}
            onClick={() => void handleDiscard()}
          >
            <Trash2 className="h-3 w-3" />
            Discard
          </Button>
        ) : null}
      </div>
    </div>
  )
}
