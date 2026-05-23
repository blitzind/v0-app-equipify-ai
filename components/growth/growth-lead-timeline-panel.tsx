"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthLeadTimelineEvent } from "@/lib/growth/timeline-types"

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type GrowthLeadTimelinePanelProps = {
  leadId: string
}

export function GrowthLeadTimelinePanel({ leadId }: GrowthLeadTimelinePanelProps) {
  const [events, setEvents] = useState<GrowthLeadTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [touchSaving, setTouchSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}/timeline`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        events?: GrowthLeadTimelineEvent[]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load timeline.")
      }
      setEvents(data.events ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load timeline.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [leadId])

  async function recordManualTouch() {
    setTouchSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}/timeline/manual-touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not record manual touch.")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record manual touch.")
    } finally {
      setTouchSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Append-only workflow history</p>
        <Button variant="outline" size="sm" disabled={touchSaving} onClick={() => void recordManualTouch()}>
          {touchSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Manual touch
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading timeline…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          No timeline events yet.
        </div>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl border border-border bg-background px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{event.title}</p>
                  {event.summary ? <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p> : null}
                  {event.actorEmail ? (
                    <p className="mt-1 text-xs text-muted-foreground">{event.actorEmail}</p>
                  ) : null}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">{formatWhen(event.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
