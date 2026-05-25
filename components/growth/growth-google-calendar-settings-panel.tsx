"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarClock, Loader2, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import type { GrowthCalendarConnectionSummary } from "@/lib/growth/calendar/google-calendar-types"
import { GROWTH_GOOGLE_CALENDAR_QA_MARKER } from "@/lib/growth/calendar/google-calendar-types"

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

export function GrowthGoogleCalendarSettingsPanel() {
  const searchParams = useSearchParams()
  const [summary, setSummary] = useState<GrowthCalendarConnectionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/calendar/connection", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; summary?: GrowthCalendarConnectionSummary }
      if (res.ok && data.ok) setSummary(data.summary ?? null)
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

  return (
    <GrowthSettingsCard title="Google Calendar" icon={<CalendarClock className="size-4" />}>
      <div className={GROWTH_SETTINGS_INNER_GAP}>
        <p className="text-xs text-muted-foreground">
          Connect Google (Workspace or personal) for human-confirmed meeting sync. No autonomous scheduling.
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
                      {summary.lastSyncAt ? new Date(summary.lastSyncAt).toLocaleString() : "Not synced yet"}
                    </dd>
                  </div>
                </dl>
                <div className="flex shrink-0 gap-2">
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

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 dark:border-[#25324C]">
              <GrowthSettingsBadge label={GROWTH_GOOGLE_CALENDAR_QA_MARKER} tone="neutral" />
              <GrowthSettingsBadge label="Human confirm required" tone="neutral" />
              <GrowthSettingsBadge label="No auto-scheduling" tone="neutral" />
              {summary?.connected ? (
                <>
                  <GrowthSettingsBadge
                    label={`Sync: ${summary.syncHealth ?? "unknown"}`}
                    tone={syncHealthTone(summary.syncHealth)}
                  />
                  {summary.lastSyncError ? (
                    <GrowthSettingsBadge label="Sync errors" tone="attention" />
                  ) : null}
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
