"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Loader2, RefreshCw, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_MEETING_INBOX_VIEWS,
  GROWTH_MEETING_PROVIDER_LABELS,
  GROWTH_MEETING_PROVIDERS,
  GROWTH_MEETING_STATUS_LABELS,
  GROWTH_MEETING_STATUSES,
  type GrowthMeeting,
  type GrowthMeetingInboxView,
  type GrowthMeetingIntelligenceDashboard,
  type GrowthMeetingProvider,
  type GrowthMeetingStatus,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

const VIEW_LABELS: Record<GrowthMeetingInboxView, string> = {
  upcoming: "Upcoming",
  meeting_requests: "Meeting Requests",
  outcomes_missing: "Outcomes Missing",
  no_shows: "No-shows",
  followups_due: "Follow-ups Due",
  completed: "Completed",
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString()
}

export function GrowthMeetingIntelligenceDashboard() {
  const [dashboard, setDashboard] = useState<GrowthMeetingIntelligenceDashboard | null>(null)
  const [items, setItems] = useState<GrowthMeeting[]>([])
  const [view, setView] = useState<GrowthMeetingInboxView>("upcoming")
  const [statusFilter, setStatusFilter] = useState<GrowthMeetingStatus | "">("")
  const [providerFilter, setProviderFilter] = useState<GrowthMeetingProvider | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthMeetingInboxView) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: activeView, limit: "50" })
      if (statusFilter) params.set("status", statusFilter)
      if (providerFilter) params.set("provider", providerFilter)
      const [dashRes, inboxRes] = await Promise.all([
        fetch("/api/platform/growth/meetings/dashboard", { cache: "no-store" }),
        fetch(`/api/platform/growth/meetings/inbox?${params.toString()}`, { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        dashboard?: GrowthMeetingIntelligenceDashboard | null
        message?: string
      }
      const inboxData = (await inboxRes.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: GrowthMeeting[] }
        message?: string
      }
      if (!dashRes.ok || !dashData.ok) {
        throw new Error(dashData.message ?? "Could not load meeting dashboard.")
      }
      if (dashData.meta?.schemaReady === false) {
        setSetupMessage(dashData.meta.setupMessage ?? null)
        setDashboard(null)
        setItems([])
        return
      }
      if (!inboxRes.ok || !inboxData.ok) {
        throw new Error(inboxData.message ?? "Could not load meetings.")
      }
      setSetupMessage(null)
      setDashboard(dashData.dashboard ?? null)
      setItems(inboxData.feed?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [providerFilter, statusFilter])

  useEffect(() => {
    void load(view)
  }, [load, view])

  if (loading && !dashboard && !setupMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading meeting intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_MEETING_INBOX_VIEWS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option ? "default" : "outline"}
              onClick={() => setView(option)}
            >
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GrowthMeetingStatus | "")}
        >
          <option value="">All statuses</option>
          {GROWTH_MEETING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {GROWTH_MEETING_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value as GrowthMeetingProvider | "")}
        >
          <option value="">All providers</option>
          {GROWTH_MEETING_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {GROWTH_MEETING_PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {setupMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {setupMessage}
        </p>
      ) : null}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={`View: ${VIEW_LABELS[view]}`} tone="neutral" />
          </div>
          {!dashboard.calendarSyncReady && dashboard.calendarSetupMessage ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
              {dashboard.calendarSetupMessage}{" "}
              <Link href="/admin/growth/settings" className="font-medium text-indigo-700 hover:underline">
                Connect in Settings
              </Link>
            </p>
          ) : null}
          {dashboard.calendarSyncReady ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <GrowthBadge label="Google Calendar connected" tone="healthy" />
              {dashboard.calendarAccountEmail ? (
                <span className="text-muted-foreground">{dashboard.calendarAccountEmail}</span>
              ) : null}
              {dashboard.calendarSyncHealth ? (
                <GrowthBadge label={`Sync: ${dashboard.calendarSyncHealth}`} tone="neutral" />
              ) : null}
              {dashboard.calendarLastSyncAt ? (
                <span className="text-xs text-muted-foreground">
                  Last sync {new Date(dashboard.calendarLastSyncAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<CalendarClock className="size-3.5" />} label="Upcoming" value={dashboard.upcomingCount} />
            <StatTile label="Meeting requests" value={dashboard.meetingRequestCount} />
            <StatTile label="Outcomes missing" value={dashboard.outcomesMissingCount} />
            <StatTile label="No-shows" value={dashboard.noShowCount} />
            <StatTile label="Follow-ups due" value={dashboard.followUpsDueCount} />
            <StatTile label="Starting soon" value={dashboard.startingSoonCount} />
            <StatTile label="Completed today" value={dashboard.completedTodayCount} />
          </div>
        </>
      ) : null}

      <GrowthEngineCard title="Meetings">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {setupMessage ? "Meeting tracking unavailable until migrations are applied." : "No meetings in this view."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((meeting) => (
              <li key={meeting.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-medium">{meeting.companyName ?? "Lead"}</p>
                  <p className="text-sm text-foreground">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(meeting.startAt)} · {GROWTH_MEETING_STATUS_LABELS[meeting.status]}
                    {meeting.provider ? ` · ${GROWTH_MEETING_PROVIDER_LABELS[meeting.provider]}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/growth/leads?open=${meeting.leadId}&focus=meetings&highlight=${meeting.id}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Open lead
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
