"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Loader2, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  GROWTH_CALENDAR_SYNC_STATUS_LABELS,
} from "@/lib/growth/calendar/google-calendar-types"
import {
  GROWTH_MEETING_LOCATION_HELPER_COPY,
  GROWTH_MEETING_LOCATION_PROVIDER_LABELS,
  GROWTH_MEETING_LOCATION_PROVIDERS,
  meetingLocationNeedsLocationLabel,
  meetingLocationNeedsManualUrl,
  type GrowthMeetingLocationProvider,
} from "@/lib/growth/meeting-location/meeting-location-provider-types"
import {
  GROWTH_MEETING_STATUS_LABELS,
  type GrowthMeeting,
} from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadMeetingIntelligenceProps = {
  lead: GrowthLead
  highlightMeetingId?: string | null
  pendingReplyId?: string | null
  onTimelineRefresh?: () => void
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Not scheduled"
  return new Date(iso).toLocaleString()
}

function meetingLocationWarning(meeting: GrowthMeeting): string | null {
  if (!meeting.providerConnectionRequired) return null
  if (meeting.meetingLocationType === "google_meet") {
    return "Connect Google Calendar in Growth Settings to auto-create Google Meet links."
  }
  if (meeting.meetingLocationType === "zoom") {
    return "Zoom connection required — paste a manual Zoom URL or connect Zoom when available."
  }
  if (meeting.meetingLocationType === "teams") {
    return "Microsoft Teams connection required — paste a manual Teams URL or connect Teams when available."
  }
  return null
}

function meetingLocationProviderLabel(meeting: GrowthMeeting): string {
  if (meeting.meetingLocationType) {
    return GROWTH_MEETING_LOCATION_PROVIDER_LABELS[meeting.meetingLocationType]
  }
  return "Not set"
}

export function GrowthLeadMeetingIntelligence({
  lead,
  highlightMeetingId,
  pendingReplyId,
  onTimelineRefresh,
}: GrowthLeadMeetingIntelligenceProps) {
  const [meetings, setMeetings] = useState<GrowthMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [title, setTitle] = useState(`Meeting with ${lead.companyName}`)
  const [startAt, setStartAt] = useState("")
  const [meetingLocationType, setMeetingLocationType] = useState<GrowthMeetingLocationProvider>("google_meet")
  const [autoCreateMeetingLink, setAutoCreateMeetingLink] = useState<boolean | null>(null)
  const [manualMeetingUrl, setManualMeetingUrl] = useState("")
  const [meetingLocationLabel, setMeetingLocationLabel] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState("")
  const [nextAction, setNextAction] = useState("")
  const [noShowReason, setNoShowReason] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/meetings`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        meetings?: GrowthMeeting[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load meetings.")
      if (data.meta?.schemaReady === false) {
        setSetupMessage(data.meta.setupMessage ?? null)
        setMeetings([])
        return
      }
      setSetupMessage(null)
      setMeetings(data.meetings ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (highlightMeetingId) setSelectedId(highlightMeetingId)
  }, [highlightMeetingId])

  async function saveMeetingLocation(meetingId: string) {
    await patchMeeting(meetingId, {
      meetingLocationType,
      autoCreateMeetingLink,
      manualMeetingUrl: manualMeetingUrl.trim() || null,
      meetingLocationLabel: meetingLocationLabel.trim() || null,
      meetingUrl: manualMeetingUrl.trim() || null,
    })
  }

  async function createMeeting(status: "proposed" | "scheduled") {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          startAt: startAt ? new Date(startAt).toISOString() : null,
          meetingLocationType,
          autoCreateMeetingLink,
          manualMeetingUrl: manualMeetingUrl.trim() || null,
          meetingLocationLabel: meetingLocationLabel.trim() || null,
          outboundReplyId: pendingReplyId ?? null,
          source: pendingReplyId ? "reply_intent" : "manual",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create meeting.")
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setSaving(false)
    }
  }

  async function syncMeetingToCalendar(meetingId: string, action: "create" | "update" | "cancel") {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/meetings/${meetingId}/calendar/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, action }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Calendar sync failed.")
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calendar sync failed.")
    } finally {
      setSaving(false)
    }
  }

  async function patchMeeting(
    meetingId: string,
    patch: Record<string, unknown>,
  ) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not update meeting.")
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setSaving(false)
    }
  }

  const selected = meetings.find((m) => m.id === selectedId) ?? null
  const openCount = meetings.filter((m) => m.status === "proposed" || m.status === "scheduled").length

  useEffect(() => {
    if (!selected) return
    setMeetingLocationType(selected.meetingLocationType ?? "google_meet")
    setAutoCreateMeetingLink(selected.autoCreateMeetingLink)
    setManualMeetingUrl(selected.manualMeetingUrl ?? selected.meetingUrl ?? "")
    setMeetingLocationLabel(selected.meetingLocationLabel ?? "")
  }, [selected?.id, selected?.meetingLocationType, selected?.autoCreateMeetingLink, selected?.manualMeetingUrl, selected?.meetingUrl, selected?.meetingLocationLabel])

  return (
    <GrowthCollapsibleEngineCard
      id="growth-meeting-intelligence"
      title="Meeting Intelligence"
      icon={<Video className="size-4" />}
      headerAside={openCount > 0 ? `${openCount} open` : "Track meetings"}
      defaultOpen={Boolean(pendingReplyId || highlightMeetingId)}
      persistKey={GROWTH_DRAWER_CARD_KEYS.meetings}
    >
      <div className="space-y-4">
        {setupMessage ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            {setupMessage}
          </p>
        ) : null}
        {pendingReplyId ? (
          <p className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-sm text-indigo-950">
            Reply requested a meeting — confirm details before scheduling. No automatic calendar writes.
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <p className="text-xs text-muted-foreground">{GROWTH_MEETING_LOCATION_HELPER_COPY}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Start</label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Meeting provider</label>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={meetingLocationType}
              onChange={(e) => setMeetingLocationType(e.target.value as GrowthMeetingLocationProvider)}
            >
              {GROWTH_MEETING_LOCATION_PROVIDERS.map((option) => (
                <option key={option} value={option}>
                  {GROWTH_MEETING_LOCATION_PROVIDER_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Auto-create meeting link</label>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={autoCreateMeetingLink === null ? "inherit" : autoCreateMeetingLink ? "on" : "off"}
              onChange={(e) => {
                const value = e.target.value
                setAutoCreateMeetingLink(value === "inherit" ? null : value === "on")
              }}
            >
              <option value="inherit">Platform default</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          {meetingLocationNeedsManualUrl(meetingLocationType) ? (
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Manual meeting URL</label>
              <Input
                value={manualMeetingUrl}
                onChange={(e) => setManualMeetingUrl(e.target.value)}
                placeholder="Paste Zoom, Teams, or custom URL"
              />
            </div>
          ) : null}
          {meetingLocationNeedsLocationLabel(meetingLocationType) ? (
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Phone number or location text</label>
              <Input
                value={meetingLocationLabel}
                onChange={(e) => setMeetingLocationLabel(e.target.value)}
                placeholder="Phone number, address, or will call attendee"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void createMeeting("proposed")}>
            Save as proposed
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void createMeeting("scheduled")}>
            Schedule meeting
          </Button>
          <Link href="/admin/growth/meetings" className="text-sm text-indigo-600 hover:underline self-center">
            Open meetings dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading meetings…
          </div>
        ) : meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No meetings tracked for this lead yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {meetings.map((meeting) => (
              <li
                key={meeting.id}
                className={`px-3 py-2 ${selectedId === meeting.id ? "bg-indigo-50/60" : ""}`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedId(meeting.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{meeting.title}</span>
                    <GrowthBadge label={GROWTH_MEETING_STATUS_LABELS[meeting.status]} tone="neutral" />
                    {meeting.calendarSyncStatus ? (
                      <GrowthBadge
                        label={GROWTH_CALENDAR_SYNC_STATUS_LABELS[meeting.calendarSyncStatus]}
                        tone={meeting.calendarSyncStatus === "synced" ? "healthy" : "attention"}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <CalendarClock className="mr-1 inline size-3" />
                    {formatWhen(meeting.startAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">Update {selected.title}</p>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Provider:</span>{" "}
                {meetingLocationProviderLabel(selected)}
              </div>
              <div>
                <span className="text-muted-foreground">Auto-link:</span>{" "}
                {selected.autoCreateMeetingLink === null
                  ? "Platform default"
                  : selected.autoCreateMeetingLink
                    ? "On"
                    : "Off"}
              </div>
              {selected.meetingUrl ? (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Meeting URL:</span>{" "}
                  <a href={selected.meetingUrl} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
                    {selected.meetingUrl}
                  </a>
                </div>
              ) : null}
              {selected.meetingLocationLabel ? (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Location:</span> {selected.meetingLocationLabel}
                </div>
              ) : null}
            </div>
            {meetingLocationWarning(selected) ? (
              <p className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-950">
                {meetingLocationWarning(selected)}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Meeting provider</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={meetingLocationType}
                  onChange={(e) => setMeetingLocationType(e.target.value as GrowthMeetingLocationProvider)}
                >
                  {GROWTH_MEETING_LOCATION_PROVIDERS.map((option) => (
                    <option key={option} value={option}>
                      {GROWTH_MEETING_LOCATION_PROVIDER_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Auto-create meeting link</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={autoCreateMeetingLink === null ? "inherit" : autoCreateMeetingLink ? "on" : "off"}
                  onChange={(e) => {
                    const value = e.target.value
                    setAutoCreateMeetingLink(value === "inherit" ? null : value === "on")
                  }}
                >
                  <option value="inherit">Platform default</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>
              {meetingLocationNeedsManualUrl(meetingLocationType) ? (
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Manual meeting URL</label>
                  <Input value={manualMeetingUrl} onChange={(e) => setManualMeetingUrl(e.target.value)} />
                </div>
              ) : null}
              {meetingLocationNeedsLocationLabel(meetingLocationType) ? (
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Phone number or location text</label>
                  <Input value={meetingLocationLabel} onChange={(e) => setMeetingLocationLabel(e.target.value)} />
                </div>
              ) : null}
            </div>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveMeetingLocation(selected.id)}>
              Save location settings
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void patchMeeting(selected.id, { status: "completed" })}
              >
                Mark completed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  void patchMeeting(selected.id, { status: "no_show", noShowReason: noShowReason || "Prospect no-show" })
                }
              >
                Mark no-show
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void patchMeeting(selected.id, { status: "canceled" })}
              >
                Cancel
              </Button>
            </div>
            <Textarea
              placeholder="Outcome (human-entered)"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={2}
            />
            <Input
              placeholder="Next action"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
            <Input
              placeholder="No-show reason (optional)"
              value={noShowReason}
              onChange={(e) => setNoShowReason(e.target.value)}
            />
            <Input
              placeholder="Live coaching session id (optional link)"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={saving || !selected.startAt}
                onClick={() => void syncMeetingToCalendar(selected.id, selected.calendarEventId ? "update" : "create")}
              >
                Confirm & sync to Google Calendar
              </Button>
              {selected.calendarEventId ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void syncMeetingToCalendar(selected.id, "cancel")}
                >
                  Sync cancel to calendar
                </Button>
              ) : null}
              {selected.meetingUrl ? (
                <a href={selected.meetingUrl} className="self-center text-sm text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
                  Open meeting link
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={saving || !outcome.trim()}
                onClick={() =>
                  void patchMeeting(selected.id, {
                    outcome,
                    nextAction: nextAction || null,
                    realtimeCallSessionId: sessionId.trim() || selected.realtimeCallSessionId,
                  })
                }
              >
                Save outcome
              </Button>
              {selected.opportunityId ? (
                <Link
                  href={`/admin/growth/opportunities/pipeline?opportunityId=${selected.opportunityId}`}
                  className="self-center text-sm text-indigo-600 hover:underline"
                >
                  Review opportunity stage
                </Link>
              ) : null}
            </div>
            {selected.status === "completed" && selected.opportunityId ? (
              <p className="text-xs text-muted-foreground">
                Completed meeting may warrant stage review — no automatic stage movement.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
