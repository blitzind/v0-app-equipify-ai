"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarClock, Loader2, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthCalendarConnectionSummary } from "@/lib/growth/calendar/google-calendar-types"
import { GROWTH_GOOGLE_CALENDAR_QA_MARKER } from "@/lib/growth/calendar/google-calendar-types"

function syncHealthTone(health: string | null): "healthy" | "attention" | "neutral" {
  if (health === "healthy") return "healthy"
  if (health === "degraded" || health === "failed") return "attention"
  return "neutral"
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
    <GrowthEngineCard title="Google Calendar" icon={<CalendarClock className="size-4" />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_GOOGLE_CALENDAR_QA_MARKER} tone="healthy" />
          <GrowthBadge label="Human confirm required" tone="neutral" />
          <GrowthBadge label="No auto-scheduling" tone="neutral" />
        </div>
        <p className="text-sm text-muted-foreground">
          Connect your Google account (Workspace or personal) to sync meetings after operator confirmation. No autonomous
          scheduling or attendee additions.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading calendar connection…
          </div>
        ) : (
          <>
            {summary?.setupMessage && !summary.connected ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                {summary.setupMessage}
              </p>
            ) : null}
            {summary?.connected ? (
              <div className="rounded-lg border border-border px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Connected account:</span>{" "}
                  {summary.accountEmail ?? "Google account"}
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Account type:</span> {summary.accountType ?? "unknown"}
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Last sync:</span>{" "}
                  {summary.lastSyncAt ? new Date(summary.lastSyncAt).toLocaleString() : "Not synced yet"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <GrowthBadge
                    label={`Sync health: ${summary.syncHealth ?? "unknown"}`}
                    tone={syncHealthTone(summary.syncHealth)}
                  />
                  {summary.lastSyncError ? (
                    <GrowthBadge label="Check sync errors" tone="attention" />
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {summary?.configured ? (
                <Button asChild size="sm" disabled={working}>
                  <a href="/api/platform/growth/calendar/authorize?returnTo=/admin/growth/settings">
                    Connect Google Calendar
                  </a>
                </Button>
              ) : null}
              {summary?.connected ? (
                <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => void disconnect()}>
                  <Unplug className="mr-1 size-3.5" />
                  Disconnect
                </Button>
              ) : null}
            </div>
          </>
        )}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </GrowthEngineCard>
  )
}
