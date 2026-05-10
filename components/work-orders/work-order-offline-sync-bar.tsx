"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react"
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
import { formatOfflineRelativeUpdated } from "@/lib/work-orders/offline/offline-relative-time"
import { makeWorkOrderOfflineScopeKey } from "@/lib/work-orders/offline/types"
import { replayWorkOrderOfflineBundle } from "@/lib/work-orders/offline/replay-drawer"
import { formatWorkOrderOfflineReplayError } from "@/lib/work-orders/offline/replay-errors"
import { withWorkOrderOfflineReplayLock } from "@/lib/work-orders/offline/sync-lock"
import type { WorkOrder } from "@/lib/mock-data"
import { useToast } from "@/hooks/use-toast"
import { SYNC_PREP_COPY } from "@/lib/sync-prep"

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

  const draftUpdatedRel = record?.updatedAtIso ? formatOfflineRelativeUpdated(record.updatedAtIso) : ""

  const label = (() => {
    if (!online) return "No connection"
    if (status === "conflict") return SYNC_PREP_COPY.reviewConflictLabel
    if (status === "failed") return SYNC_PREP_COPY.syncFailedLabel
    if (isReplayInProgress) return SYNC_PREP_COPY.syncInProgressLabel
    if (hasActionablePending) return SYNC_PREP_COPY.syncPendingLabel
    return SYNC_PREP_COPY.savedLocallyLabel
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
          toast({
            title: "Synced",
            description: "Your device draft is now on the work order.",
          })
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
          onConflict?.(SYNC_PREP_COPY.workOrderConflictDialogIntro)
          toast({
            title: SYNC_PREP_COPY.workOrderSyncConflictToastTitle,
            description: SYNC_PREP_COPY.workOrderSyncConflictToastBody,
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
            title: "Couldn’t finish sync",
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
    toast({
      title: "Device draft cleared",
      description: "Local changes were removed from this device. The server work order was not deleted.",
    })
    onAfterChange?.()
  }

  const canSyncNow = hasActionablePending && online && status !== "conflict" && !isReplayInProgress
  const canDiscard = (hasActionablePending || status === "conflict" || status === "failed") && !isReplayInProgress

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-1.5 border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:py-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {online ? (
          <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
        ) : (
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        )}
        <span className="font-semibold text-foreground">{label}</span>
        {hasActionablePending && draftUpdatedRel ? (
          <span className="text-muted-foreground">· Saved on device {draftUpdatedRel}</span>
        ) : null}
        {hasActionablePending && pendingPhotoCount > 0 ? (
          <span className="text-muted-foreground">
            · {pendingPhotoCount === 1 ? "1 photo pending upload" : `${pendingPhotoCount} photos pending upload`}
          </span>
        ) : null}
        {hasActionablePending && online && status !== "conflict" ? (
          <span className="hidden text-muted-foreground sm:inline">
            · Not on the server until you sync
          </span>
        ) : null}
        {!online && hasActionablePending ? (
          <span className="text-muted-foreground">· Will send when you’re back online</span>
        ) : null}
        {isReplayInProgress ? (
          <span className="text-muted-foreground">· Keep this tab open</span>
        ) : null}
        {record?.lastSyncAttemptAtIso && status === "failed" ? (
          <span className="text-muted-foreground">
            · Last try {formatLocalSyncAttempt(record.lastSyncAttemptAtIso)}
          </span>
        ) : null}
        {record?.lastError && status === "failed" ? (
          <span className="min-w-0 basis-full truncate text-amber-900 dark:text-amber-200 sm:basis-auto" title={record.lastError}>
            {record.lastError}
          </span>
        ) : null}
        {status === "failed" && online ? (
          <span className="basis-full text-muted-foreground sm:basis-auto">
            When you’re ready, tap Sync now again — your draft stays on this device.
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        {status === "conflict" ? (
          <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => onConflict?.()}>
            Review
          </Button>
        ) : null}
        {canSyncNow ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-7 text-[11px] gap-1"
            title={SYNC_PREP_COPY.workOrderSyncBarSyncNowTooltip}
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
            title={SYNC_PREP_COPY.workOrderSyncBarDiscardTooltip}
            disabled={syncBusy}
            onClick={() => void handleDiscard()}
          >
            <Trash2 className="h-3 w-3" />
            Clear device draft
          </Button>
        ) : null}
      </div>
    </div>
  )
}
