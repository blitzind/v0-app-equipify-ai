"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  filterSessionTimelineEvents,
} from "@/lib/growth/realtime/live-coaching/session-timeline-diagnostics"
import type { LiveCoachingSessionTimelinePayload } from "@/lib/growth/realtime/live-coaching/session-timeline-types"
import {
  formatSessionTimelineDetail,
  sessionTimelineEventLabel,
  sessionTimelineProviderLabel,
  sessionTimelineSeverityTone,
} from "@/lib/growth/realtime/live-coaching/session-timeline-labels"
import type { LiveCoachingSessionTimelineEvent } from "@/lib/growth/realtime/live-coaching/session-timeline-types"
import { LIVE_COACHING_SESSION_TIMELINE_EVENT_TYPES } from "@/lib/growth/realtime/live-coaching/session-timeline-types"

type GrowthLiveCoachingSessionTimelineProps = {
  leadId: string
  sessionId: string | null
  refreshToken?: number
}

function formatTimelineTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function GrowthLiveCoachingSessionTimeline({
  leadId,
  sessionId,
  refreshToken = 0,
}: GrowthLiveCoachingSessionTimelineProps) {
  const [payload, setPayload] = useState<LiveCoachingSessionTimelinePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerFilter, setProviderFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [eventTypeFilter, setEventTypeFilter] = useState("all")

  const load = useCallback(async () => {
    if (!sessionId) {
      setPayload(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${sessionId}/timeline`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        timeline?: LiveCoachingSessionTimelinePayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.timeline) {
        throw new Error(data.message ?? "Could not load session timeline.")
      }
      setPayload(data.timeline)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Timeline load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId, sessionId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const providerOptions = useMemo(() => {
    const providers = new Set<string>()
    for (const event of payload?.events ?? []) {
      providers.add(event.providerId ?? "manual")
    }
    return ["all", ...Array.from(providers).sort()]
  }, [payload?.events])

  const filteredEvents = useMemo(() => {
    if (!payload) return []
    return filterSessionTimelineEvents(payload.events, {
      providerId: providerFilter,
      severity: severityFilter,
      eventType: eventTypeFilter,
    })
  }, [payload, providerFilter, severityFilter, eventTypeFilter])

  if (!sessionId) {
    return (
      <GrowthEngineCard title="Session Timeline">
        <p className="text-sm text-muted-foreground">
          Start or select a live coaching session to review metrics-only timeline events.
        </p>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Session Timeline">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Metrics-only audit trail. No audio storage or transcript replay.
        </p>
        {payload?.qaProof ? (
          <GrowthBadge
            label={payload.qaProof.marker}
            tone={payload.qaProof.verified ? "healthy" : "attention"}
          />
        ) : null}
        {payload?.meta.truncated ? (
          <GrowthBadge
            label={`Showing ${payload.meta.limit} of ${payload.meta.total} events`}
            tone="attention"
          />
        ) : null}
      </div>
      {loading && !payload ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading session timeline…
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {payload ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Session health" value={payload.diagnostics.sessionHealthScore} />
            <StatTile label="Provider interruptions" value={payload.diagnostics.providerInterruptions} />
            <StatTile label="Retry count" value={payload.diagnostics.retryCount} />
            <StatTile label="Reconnect count" value={payload.diagnostics.reconnectCount} />
            <StatTile label="Provider failovers" value={payload.diagnostics.providerFailoverCount} />
            <StatTile
              label="Avg transcript latency"
              value={
                payload.diagnostics.transcriptLatencyTrend.length > 0
                  ? `${Math.round(
                      payload.diagnostics.transcriptLatencyTrend.reduce(
                        (sum, entry) => sum + entry.latencyMs,
                        0,
                      ) / payload.diagnostics.transcriptLatencyTrend.length,
                    )}ms`
                  : "—"
              }
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <FilterSelect
              label="Provider"
              value={providerFilter}
              onChange={setProviderFilter}
              options={providerOptions.map((value) => ({
                value,
                label: value === "all" ? "All providers" : sessionTimelineProviderLabel(value),
              }))}
            />
            <FilterSelect
              label="Severity"
              value={severityFilter}
              onChange={setSeverityFilter}
              options={[
                { value: "all", label: "All severities" },
                { value: "info", label: "Info" },
                { value: "warning", label: "Warning" },
                { value: "critical", label: "Critical" },
              ]}
            />
            <FilterSelect
              label="Event type"
              value={eventTypeFilter}
              onChange={setEventTypeFilter}
              options={[
                { value: "all", label: "All events" },
                ...LIVE_COACHING_SESSION_TIMELINE_EVENT_TYPES.map((eventType) => ({
                  value: eventType,
                  label: sessionTimelineEventLabel(eventType),
                })),
              ]}
            />
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No timeline events match the current filters. Events appear as the session progresses.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {filteredEvents.map((event) => (
                <TimelineEventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TimelineEventRow({ event }: { event: LiveCoachingSessionTimelineEvent }) {
  return (
    <li className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{formatTimelineTime(event.createdAt)}</span>
          <GrowthBadge label={sessionTimelineEventLabel(event.eventType)} tone="neutral" />
          <GrowthBadge
            label={sessionTimelineProviderLabel(event.providerId)}
            tone="status"
          />
          <GrowthBadge label={event.severity} tone={sessionTimelineSeverityTone(event.severity)} />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{formatSessionTimelineDetail(event.detail)}</p>
    </li>
  )
}
