"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  Flag,
  Loader2,
  Phone,
  Search,
  Sparkles,
  User,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { GrowthEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import type { GrowthLeadTimelineEvent, GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import { cn } from "@/lib/utils"

function eventMeta(eventType: GrowthLeadTimelineEventType): {
  icon: LucideIcon
  emphasis: "default" | "touch" | "research" | "priority"
} {
  switch (eventType) {
    case "manual_touch":
      return { icon: Activity, emphasis: "touch" }
    case "research_started":
    case "research_completed":
    case "research_failed":
    case "website_fetch_failed":
    case "website_fetch_fixed":
      return { icon: Search, emphasis: "research" }
    case "priority_changed":
    case "override_changed":
    case "next_best_action_changed":
      return { icon: Flag, emphasis: "priority" }
    case "call_attempted":
    case "voicemail_left":
      return { icon: Phone, emphasis: "touch" }
    case "follow_up_created":
    case "follow_up_completed":
      return { icon: Clock, emphasis: "default" }
    case "decision_maker_added":
    case "decision_maker_confirmed":
    case "decision_maker_rejected":
      return { icon: User, emphasis: "default" }
    case "interested":
      return { icon: Zap, emphasis: "touch" }
    case "notes_updated":
      return { icon: FileText, emphasis: "default" }
    case "status_changed":
    case "website_changed":
    case "import_created":
    case "import_updated":
    case "lead_created":
      return { icon: AlertTriangle, emphasis: "default" }
    default:
      return { icon: Activity, emphasis: "default" }
  }
}

function emphasisClass(emphasis: ReturnType<typeof eventMeta>["emphasis"]) {
  switch (emphasis) {
    case "touch":
      return "border-emerald-300 bg-emerald-50/60"
    case "research":
      return "border-sky-300 bg-sky-50/60"
    case "priority":
      return "border-orange-300 bg-orange-50/60"
    default:
      return "border-border bg-background"
  }
}

type GrowthLeadTimelinePanelProps = {
  leadId: string
}

export function GrowthLeadTimelinePanel({ leadId }: GrowthLeadTimelinePanelProps) {
  const [events, setEvents] = useState<GrowthLeadTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <GrowthEngineCard title="Timeline" icon={<Clock className="size-4" />}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Append-only workflow history</p>

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
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No timeline events yet.
          </div>
        ) : (
          <ol className="relative space-y-0 border-l-2 border-border/80 pl-6">
            {events.map((event, index) => {
              const meta = eventMeta(event.eventType)
              const Icon = meta.icon
              return (
                <li key={event.id} className={cn("relative pb-5", index === events.length - 1 && "pb-0")}>
                  <span
                    className={cn(
                      "absolute -left-[1.65rem] flex size-7 items-center justify-center rounded-full border-2 border-background",
                      meta.emphasis === "touch"
                        ? "bg-emerald-100 text-emerald-700"
                        : meta.emphasis === "research"
                          ? "bg-sky-100 text-sky-700"
                          : meta.emphasis === "priority"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className={cn("rounded-xl border px-4 py-3", emphasisClass(meta.emphasis))}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{event.title}</p>
                        {event.summary ? <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p> : null}
                        {event.actorEmail ? (
                          <p className="mt-1 text-xs text-muted-foreground">{event.actorEmail}</p>
                        ) : null}
                      </div>
                      <time className="shrink-0 text-xs font-medium text-muted-foreground" title={new Date(event.occurredAt).toLocaleString()}>
                        {formatRelativeTime(event.occurredAt)}
                      </time>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </GrowthEngineCard>
  )
}
