"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarClock, Loader2, RefreshCw, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import type { GrowthCalendarConflictMeeting, GrowthCalendarSyncStatusPanel } from "@/lib/growth/calendar/calendar-sync-types"
import type { GrowthCalendarConnectionSummary } from "@/lib/growth/calendar/google-calendar-types"

function syncHealthTone(health: string | null): "healthy" | "attention" | "neutral" {
  if (health === "healthy") return "healthy"
  if (health === "degraded" || health === "failed") return "attention"
  return "neutral"
}

function formatAccountType(value: string | null | undefined): string {
  if (value === "workspace") return "Workspace"
  if (value === "personal") return "Personal"
  return value ?? "Unknown"
}

type SyncPayload = {
  ok?: boolean
  summary?: GrowthCalendarConnectionSummary
  syncStatus?: GrowthCalendarSyncStatusPanel
  conflicts?: GrowthCalendarConflictMeeting[]
}

export function GrowthGoogleCalendarSettingsPanel() {
  const searchParams = useSearchParams()
  const [summary, setSummary] = useState<GrowthCalendarConnectionSummary | null>(null)
  const [syncStatus, setSyncStatus] = useState<GrowthCalendarSyncStatusPanel | null>(null)
  const [conflicts, setConflicts] = useState<GrowthCalendarConflictMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [connectionRes, syncRes] = await Promise.all([
        fetch("/api/platform/growth/calendar/connection", { cache: "no-store" }),
        fetch("/api/platform/growth/calendar/sync", { cache: "no-store" }),
      ])
      const connectionData = (await connectionRes.json().catch(() => ({}))) as SyncPayload
      const syncData = (await syncRes.json().catch(() => ({}))) as SyncPayload
      if (connectionRes.ok && connectionData.ok) setSummary(connectionData.summary ?? null)
      if (syncRes.ok && syncData.ok) {
        setSyncStatus(syncData.syncStatus ?? null)
        setConflicts(syncData.conflicts ?? [])
        if (syncData.summary) setSummary(syncData.summary)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (searchParams.get("calendar_connected") === "1") {
      setMessage("Google Calendar connected.")
      void load()
    }
    const error = searchParams.get("calendar_error")
    if (error) setMessage(`Calendar connection failed: ${decodeURIComponent(error)}`)
  }, [searchParams, load])

  async function disconnect() {
    setWorking(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/calendar/connection", { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Disconnect failed.")
      setMessage("Google Calendar disconnected.")
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Disconnect failed.")
    } finally {
      setWorking(false)
    }
  }

  async function forceSync() {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        run?: { eventsSynced?: number; conflictsDetected?: number; status?: string }
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Force sync failed.")
      setMessage(
        `Force sync completed — ${data.run?.eventsSynced ?? 0} events synced, ${data.run?.conflictsDetected ?? 0} conflicts.`,
      )
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Force sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  async function resolveConflict(meetingId: string, action: "keep_growth" | "accept_google" | "dismiss") {
    setWorking(true)
    try {
      const res = await fetch(`/api/platform/growth/meetings/${meetingId}/calendar/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not resolve conflict.")
      setMessage("Calendar conflict resolved.")
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not resolve conflict.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <GrowthSettingsCard title="Google Calendar" icon={<CalendarClock className="size-4" />}>
      <div className={GROWTH_SETTINGS_INNER_GAP}>
        <p className="text-xs text-muted-foreground">
          Connect Google (Workspace or personal) for human-confirmed meeting sync and manual pull sync.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading calendar connection…
          </div>
        ) : (
          <>
            {summary?.setupMessage && !summary.connected ? (
              <p className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {summary.setupMessage}
              </p>
            ) : null}

            {summary?.connected ? (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <dl className="grid gap-1 text-xs sm:grid-cols-3 sm:gap-x-4">
                    <div>
                      <dt className="text-muted-foreground">Connected account</dt>
                      <dd className="font-medium text-foreground">{summary.accountEmail ?? "Google account"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Account type</dt>
                      <dd className="font-medium text-foreground">{formatAccountType(summary.accountType)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last sync</dt>
                      <dd className="font-medium text-foreground">
                        {syncStatus?.lastSyncAt
                          ? new Date(syncStatus.lastSyncAt).toLocaleString()
                          : summary.lastSyncAt
                            ? new Date(summary.lastSyncAt).toLocaleString()
                            : "Not synced yet"}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      disabled={syncing || working}
                      onClick={() => void forceSync()}
                    >
                      {syncing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RefreshCw className="mr-1 size-3" />}
                      Force Sync
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                      disabled={working}
                      onClick={() => void disconnect()}
                    >
                      <Unplug className="mr-1 size-3" />
                      Disconnect
                    </Button>
                  </div>
                </div>

                <div className="grid gap-1 rounded-md border border-border/70 px-2.5 py-2 text-xs dark:border-[#25324C] sm:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">Sync status</span>
                    <p className="font-medium capitalize">{syncStatus?.lastSyncStatus ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Events synced</span>
                    <p className="font-medium">{syncStatus?.eventsSynced ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Conflicts</span>
                    <p className="font-medium">{syncStatus?.conflictsDetected ?? conflicts.length}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sync errors</span>
                    <p className="font-medium line-clamp-2">{syncStatus?.lastSyncError ?? summary.lastSyncError ?? "None"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {summary?.configured ? (
                  <Button asChild size="sm" className="h-7 px-2.5 text-xs" disabled={working}>
                    <a href="/api/platform/growth/calendar/authorize?returnTo=/admin/growth/settings">
                      Connect Google Calendar
                    </a>
                  </Button>
                ) : null}
              </div>
            )}

            {conflicts.length > 0 ? (
              <div className="space-y-2 rounded-md border border-amber-200/80 bg-amber-50/40 px-2.5 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-medium text-amber-950 dark:text-amber-100">Sync conflicts — resolve manually</p>
                <ul className="space-y-2">
                  {conflicts.map((conflict) => (
                    <li key={conflict.meetingId} className="rounded border border-border/60 bg-background px-2 py-1.5 text-xs dark:border-[#25324C]">
                      <p className="font-medium">{conflict.title}</p>
                      <p className="text-muted-foreground">
                        {conflict.companyName ?? "Lead"} · {conflict.calendarSyncError ?? "Conflict detected"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          disabled={working}
                          onClick={() => void resolveConflict(conflict.meetingId, "keep_growth")}
                        >
                          Keep Growth
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          disabled={working}
                          onClick={() => void resolveConflict(conflict.meetingId, "accept_google")}
                        >
                          Accept Google
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          disabled={working}
                          onClick={() => void resolveConflict(conflict.meetingId, "dismiss")}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 dark:border-[#25324C]">
              <GrowthSettingsBadge label="Human-triggered sync" tone="neutral" />
              {summary?.connected ? (
                <>
                  <GrowthSettingsBadge
                    label={`Sync: ${summary.syncHealth ?? "unknown"}`}
                    tone={syncHealthTone(summary.syncHealth)}
                  />
                  {summary.lastSyncError ? <GrowthSettingsBadge label="Check sync errors" tone="attention" /> : null}
                </>
              ) : null}
            </div>
          </>
        )}

        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </GrowthSettingsCard>
  )
}
