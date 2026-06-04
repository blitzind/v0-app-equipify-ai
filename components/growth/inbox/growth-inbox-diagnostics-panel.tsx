"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthInboxDashboard } from "@/lib/growth/inbox/inbox-types"
import {
  GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER,
  type GrowthInboxSyncDashboard,
  inboxSyncStatusLabel,
} from "@/lib/growth/inbox-sync/inbox-sync-types"
import { formatInboxDate, sanitizeInboxUiErrorMessage } from "@/components/growth/inbox/growth-inbox-shared-ui"

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxDashboard
  message?: string
}

type SyncDashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxSyncDashboard
  message?: string
}

type GrowthInboxDiagnosticsPanelProps = {
  /** When true, hide sections when dashboard counts are unavailable (legacy empty-state coupling). */
  hideWhenEmpty?: boolean
  showHonestEmptyState?: boolean
}

export function GrowthInboxDiagnosticsPanel({
  hideWhenEmpty = false,
  showHonestEmptyState = false,
}: GrowthInboxDiagnosticsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthInboxDashboard | null>(null)
  const [syncDashboard, setSyncDashboard] = useState<GrowthInboxSyncDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardResponse, syncResponse] = await Promise.all([
        fetch("/api/platform/growth/inbox/dashboard"),
        fetch("/api/platform/growth/inbox/sync/dashboard"),
      ])
      const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
      const syncPayload = (await syncResponse.json()) as SyncDashboardPayload
      if (!dashboardResponse.ok) {
        throw new Error(sanitizeInboxUiErrorMessage(dashboardPayload.message) ?? "Could not load inbox dashboard.")
      }
      setDashboard(dashboardPayload.dashboard ?? null)
      if (syncResponse.ok && syncPayload.dashboard) setSyncDashboard(syncPayload.dashboard)
      else setSyncDashboard(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? sanitizeInboxUiErrorMessage(loadError.message) ?? "Could not load inbox diagnostics."
          : "Could not load inbox diagnostics.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading inbox diagnostics…
      </div>
    )
  }

  const suppressOperationalCards = hideWhenEmpty && showHonestEmptyState

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      {!suppressOperationalCards ? (
        <GrowthEngineCard title="Inbox Health">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Open" value={String(dashboard?.open_count ?? 0)} />
            <StatTile label="Needs Review" value={String(dashboard?.needs_review_count ?? 0)} />
            <StatTile label="Waiting" value={String(dashboard?.waiting_count ?? 0)} />
            <StatTile label="Critical Priority" value={String(dashboard?.critical_priority_count ?? 0)} />
          </div>
        </GrowthEngineCard>
      ) : null}

      {!suppressOperationalCards ? (
        <GrowthEngineCard title="Sync Health">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <GrowthBadge label={GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER} tone="neutral" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Last Sync" value={formatInboxDate(syncDashboard?.lastSyncAt)} />
            <StatTile label="Imported 24h" value={String(syncDashboard?.imported24h ?? 0)} />
            <StatTile label="Duplicates Skipped" value={String(syncDashboard?.duplicatesSkipped24h ?? 0)} />
            <StatTile label="Failed Runs" value={String(syncDashboard?.failedRuns24h ?? 0)} />
            <StatTile label="Thread Match Rate" value={`${syncDashboard?.threadMatchRate ?? 0}%`} />
          </div>
        </GrowthEngineCard>
      ) : null}

      {!suppressOperationalCards ? (
        <GrowthEngineCard title="Sync Runs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Mailbox</th>
                  <th className="px-2 py-2 font-medium">Provider</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Seen</th>
                  <th className="px-2 py-2 font-medium">Imported</th>
                  <th className="px-2 py-2 font-medium">Matched</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Duplicates</th>
                  <th className="px-2 py-2 font-medium">Started</th>
                  <th className="px-2 py-2 font-medium">Completed</th>
                  <th className="px-2 py-2 font-medium">Failure</th>
                </tr>
              </thead>
              <tbody>
                {(syncDashboard?.runs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">
                      No sync runs yet. Run inbox sync from platform API or cron when mailboxes are connected.
                    </td>
                  </tr>
                ) : (
                  (syncDashboard?.runs ?? []).slice(0, 20).map((run) => (
                    <tr key={run.id} className="border-b">
                      <td className="px-2 py-2">{run.mailboxLabel}</td>
                      <td className="px-2 py-2">{run.providerFamily}</td>
                      <td className="px-2 py-2">{inboxSyncStatusLabel(run.status)}</td>
                      <td className="px-2 py-2">{run.messagesSeen}</td>
                      <td className="px-2 py-2">{run.messagesImported}</td>
                      <td className="px-2 py-2">{run.threadsMatched}</td>
                      <td className="px-2 py-2">{run.threadsCreated}</td>
                      <td className="px-2 py-2">{run.duplicatesSkipped}</td>
                      <td className="px-2 py-2">{formatInboxDate(run.startedAt)}</td>
                      <td className="px-2 py-2">{formatInboxDate(run.completedAt)}</td>
                      <td className="max-w-[160px] truncate px-2 py-2 text-destructive" title={run.failureReason ?? undefined}>
                        {run.failureReason ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Provider Mailbox Controls">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            Archive provider thread
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Mark read/unread provider thread
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
