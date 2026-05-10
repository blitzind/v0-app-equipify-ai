"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Trash2, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { WORK_ORDER_OFFLINE_BUMP_EVENT } from "@/lib/work-orders/offline/broadcast"
import {
  deleteWorkOrderOfflineForScope,
  filterPendingOfflineRecords,
  getWorkOrderOfflineRecordForScope,
  putWorkOrderOfflineRecord,
} from "@/lib/work-orders/offline/idb-store"
import { makeWorkOrderOfflineScopeKey } from "@/lib/work-orders/offline/types"
import { replayWorkOrderOfflineBundle } from "@/lib/work-orders/offline/replay-drawer"
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

  useEffect(() => {
    const onBump = () => void refresh()
    window.addEventListener(WORK_ORDER_OFFLINE_BUMP_EVENT, onBump)
    return () => window.removeEventListener(WORK_ORDER_OFFLINE_BUMP_EVENT, onBump)
  }, [refresh])

  if (!scopeKey || !canEdit || !workOrder) return null

  const pending = record ? filterPendingOfflineRecords([record]) : []
  const hasPending = pending.length > 0
  const status = record?.status
  const showBar = !online || hasPending || status === "conflict" || status === "failed"

  if (!showBar) return null

  const label = (() => {
    if (!online) return "Offline"
    if (status === "conflict") return "Review conflict"
    if (status === "failed") return "Sync failed"
    if (status === "syncing") return "Syncing…"
    if (hasPending) return "Sync pending"
    return "Saved locally"
  })()

  async function handleSyncNow() {
    if (!organizationId || !workOrder || !scopeKey || !online) return
    const rec = await getWorkOrderOfflineRecordForScope(scopeKey)
    if (!rec || !filterPendingOfflineRecords([rec]).length) return
    setSyncBusy(true)
    await putWorkOrderOfflineRecord({ ...rec, status: "syncing", updatedAtIso: new Date().toISOString() })
    await refresh()
    const supabase = createBrowserSupabaseClient()
    const latest = { ...rec, status: "syncing" as const }
    const result = await replayWorkOrderOfflineBundle({
      supabase,
      organizationId,
      workOrder,
      usesTasksTable,
      usesPartsLineItems,
      record: latest,
    })
    if (result.ok) {
      await deleteWorkOrderOfflineForScope(scopeKey)
      await refresh()
      toast({ title: "Synced", description: "Local draft was applied to the work order." })
      onAfterChange?.()
    } else if (result.conflict) {
      await putWorkOrderOfflineRecord({
        ...rec,
        status: "conflict",
        conflictServerUpdatedAt: result.serverUpdatedAt,
        updatedAtIso: new Date().toISOString(),
        lastError: null,
      })
      await refresh()
      onConflict?.("Server copy changed since this draft started.")
      toast({
        variant: "destructive",
        title: "Sync paused — conflict",
        description: "Review local vs server, then discard or retry after resolving.",
      })
    } else {
      await putWorkOrderOfflineRecord({
        ...rec,
        status: "failed",
        lastError: result.message,
        updatedAtIso: new Date().toISOString(),
      })
      await refresh()
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: result.message,
      })
    }
    setSyncBusy(false)
  }

  async function handleDiscard() {
    if (!scopeKey) return
    await deleteWorkOrderOfflineForScope(scopeKey)
    await refresh()
    toast({ title: "Local draft discarded" })
    onAfterChange?.()
  }

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
      {hasPending && online && status !== "conflict" ? (
        <span className="text-muted-foreground">· Local technician draft queued ({pending.length})</span>
      ) : null}
      {record?.lastError && status === "failed" ? (
        <span className="min-w-0 truncate text-destructive">{record.lastError}</span>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {status === "conflict" ? (
          <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => onConflict?.()}>
            Review conflict
          </Button>
        ) : null}
        {hasPending && online && status !== "conflict" ? (
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
        {hasPending || status === "conflict" || status === "failed" ? (
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
