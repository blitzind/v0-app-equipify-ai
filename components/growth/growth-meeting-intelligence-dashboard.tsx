"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { CalendarClock, Loader2, RefreshCw, Video, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthMeetingCalendarIntelligenceInline } from "@/components/growth/growth-meeting-calendar-intelligence-inline"
import { GrowthMeetingPrepPanel } from "@/components/growth/growth-meeting-prep-panel"
import { GrowthOpportunityDraftPanel } from "@/components/growth/growth-opportunity-draft-panel"
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
import type { GrowthCalendarEventIntelligence } from "@/lib/growth/meeting-intelligence/calendar-event-intelligence-types"
import { cn } from "@/lib/utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

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

function leadDrawerHref(meeting: GrowthMeeting, pathname: string): string {
  return `${growthFeaturePath(pathname, "leads/crm")}?open=${meeting.leadId}&focus=meetings&highlight=${meeting.id}`
}

export function GrowthMeetingIntelligenceDashboard() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const deepLinkMeetingId = searchParams.get("meetingId") ?? searchParams.get("highlight")

  const [dashboard, setDashboard] = useState<GrowthMeetingIntelligenceDashboard | null>(null)
  const [items, setItems] = useState<GrowthMeeting[]>([])
  const [intelligenceByMeetingId, setIntelligenceByMeetingId] = useState<
    Record<string, GrowthCalendarEventIntelligence>
  >({})
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [view, setView] = useState<GrowthMeetingInboxView>("upcoming")
  const [statusFilter, setStatusFilter] = useState<GrowthMeetingStatus | "">("")
  const [providerFilter, setProviderFilter] = useState<GrowthMeetingProvider | "">("")
  const [loading, setLoading] = useState(true)
  const [intelligenceLoading, setIntelligenceLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)

  const selectedMeeting = useMemo(
    () => items.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [items, selectedMeetingId],
  )

  const loadIntelligence = useCallback(async (meetings: GrowthMeeting[]) => {
    if (meetings.length === 0) {
      setIntelligenceByMeetingId({})
      return
    }
    setIntelligenceLoading(true)
    try {
      const params = new URLSearchParams({
        meetingIds: meetings.map((meeting) => meeting.id).join(","),
      })
      const res = await fetch(`/api/platform/growth/meetings/calendar-intelligence?${params.toString()}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: GrowthCalendarEventIntelligence[] }
      }
      if (!res.ok || !data.ok || !data.feed?.items) {
        setIntelligenceByMeetingId({})
        return
      }
      const next: Record<string, GrowthCalendarEventIntelligence> = {}
      for (const item of data.feed.items) {
        next[item.meetingId] = item
      }
      setIntelligenceByMeetingId(next)
    } catch {
      setIntelligenceByMeetingId({})
    } finally {
      setIntelligenceLoading(false)
    }
  }, [])

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
        setIntelligenceByMeetingId({})
        return
      }
      if (!inboxRes.ok || !inboxData.ok) {
        throw new Error(inboxData.message ?? "Could not load meetings.")
      }
      setSetupMessage(null)
      setDashboard(dashData.dashboard ?? null)
      const nextItems = inboxData.feed?.items ?? []
      setItems(nextItems)
      void loadIntelligence(nextItems)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [loadIntelligence, providerFilter, statusFilter])

  useEffect(() => {
    void load(view)
  }, [load, view])

  useEffect(() => {
    if (deepLinkMeetingId && items.some((meeting) => meeting.id === deepLinkMeetingId)) {
      setSelectedMeetingId(deepLinkMeetingId)
    }
  }, [deepLinkMeetingId, items])

  if (loading && !dashboard && !setupMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading meeting intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qa-marker="growth-calendar-intelligence-dashboard-v1">
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
            {intelligenceLoading ? (
              <span className="text-xs text-muted-foreground">Loading calendar intelligence…</span>
            ) : null}
          </div>
          {!dashboard.calendarSyncReady && dashboard.calendarSetupMessage ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
              {dashboard.calendarSetupMessage}{" "}
              <Link href="/admin/growth/settings/communications" className="font-medium text-indigo-700 hover:underline">
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

      {selectedMeeting ? (
        <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{selectedMeeting.companyName ?? "Lead"}</p>
              <p className="text-xs text-muted-foreground">
                {selectedMeeting.title} · {formatWhen(selectedMeeting.startAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={leadDrawerHref(selectedMeeting, pathname)} className="text-xs text-indigo-600 hover:underline">
                Open lead drawer
              </Link>
              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => setSelectedMeetingId(null)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
          {intelligenceByMeetingId[selectedMeeting.id] ? (
            <GrowthMeetingCalendarIntelligenceInline intelligence={intelligenceByMeetingId[selectedMeeting.id]} />
          ) : null}
          <GrowthMeetingPrepPanel meetingId={selectedMeeting.id} meetingStatus={selectedMeeting.status} />
          <GrowthOpportunityDraftPanel meetingId={selectedMeeting.id} meetingStatus={selectedMeeting.status} />
        </div>
      ) : null}

      <GrowthEngineCard title="Meetings">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {setupMessage ? "Meeting tracking unavailable until migrations are applied." : "No meetings in this view."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((meeting) => {
              const intelligence = intelligenceByMeetingId[meeting.id]
              const selected = selectedMeetingId === meeting.id
              return (
                <li key={meeting.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-wrap items-start justify-between gap-3 py-3 text-left first:pt-0",
                      selected ? "bg-indigo-50/40 dark:bg-indigo-500/10" : "hover:bg-muted/20",
                    )}
                    onClick={() => setSelectedMeetingId(meeting.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{meeting.companyName ?? "Lead"}</p>
                        {intelligence ? (
                          <GrowthBadge
                            label={`${intelligence.meetingReadiness}% ready`}
                            tone={intelligence.meetingReadiness >= 70 ? "healthy" : intelligence.meetingReadiness >= 50 ? "medium" : "attention"}
                          />
                        ) : null}
                        {meeting.calendarEventId ? <GrowthBadge label="Calendar" tone="healthy" /> : null}
                        {meeting.meetingUrl ? (
                          <a
                            href={meeting.meetingUrl}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Video className="size-3" />
                            Join
                          </a>
                        ) : null}
                      </div>
                      <p className="text-sm text-foreground">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(meeting.startAt)} · {GROWTH_MEETING_STATUS_LABELS[meeting.status]}
                        {meeting.provider ? ` · ${GROWTH_MEETING_PROVIDER_LABELS[meeting.provider]}` : ""}
                      </p>
                      {intelligence ? (
                        <GrowthMeetingCalendarIntelligenceInline intelligence={intelligence} compact />
                      ) : null}
                    </div>
                    <span className="text-xs text-indigo-600">View prep</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
