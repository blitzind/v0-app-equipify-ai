"use client"

import { useEffect, useMemo, useState } from "react"
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
  Mail,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { GrowthCollapsibleEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_DRAWER_CARD_KEYS,
  isGrowthDrawerTimelineEventType,
} from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLeadTimelineEvent, GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import { cn } from "@/lib/utils"

function eventMeta(eventType: GrowthLeadTimelineEventType): {
  icon: LucideIcon
} {
  switch (eventType) {
    case "manual_touch":
      return { icon: Activity }
    case "research_started":
    case "research_completed":
    case "research_failed":
    case "website_fetch_failed":
    case "website_fetch_fixed":
      return { icon: Search }
    case "priority_changed":
    case "override_changed":
    case "next_best_action_changed":
      return { icon: Flag }
    case "call_started":
    case "call_attempted":
    case "voicemail_left":
      return { icon: Phone }
    case "follow_up_created":
    case "follow_up_completed":
      return { icon: Clock }
    case "decision_maker_added":
    case "decision_maker_confirmed":
    case "decision_maker_rejected":
      return { icon: User }
    case "interested":
      return { icon: Zap }
    case "notes_updated":
      return { icon: FileText }
    case "status_changed":
    case "website_changed":
    case "import_created":
    case "import_updated":
    case "lead_created":
      return { icon: AlertTriangle }
    case "lead_assigned":
    case "lead_reassigned":
    case "lead_unassigned":
    case "assignment_rule_applied":
    case "assignment_skipped":
      return { icon: User }
    case "notification_created":
    case "notification_acknowledged":
    case "notification_completed":
    case "notification_expired":
      return { icon: Activity }
    case "ai_copilot_generation_created":
    case "ai_copilot_generation_approved":
    case "playbook_conflict_detected":
      return { icon: Sparkles }
    case "email_sent":
    case "email_delivered":
    case "email_opened":
    case "email_clicked":
    case "email_replied":
    case "email_bounced":
    case "email_unsubscribed":
    case "email_failed":
    case "email_spam_complaint":
    case "email_suppressed":
    case "email_unmatched":
      return { icon: Mail }
    default:
      return { icon: Activity }
  }
}

type GrowthLeadTimelinePanelProps = {
  leadId: string
  refreshToken?: number
}

export function GrowthLeadTimelinePanel({ leadId, refreshToken = 0 }: GrowthLeadTimelinePanelProps) {
  const [events, setEvents] = useState<GrowthLeadTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true)
    }
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
    void load({ silent: refreshToken > 0 })
  }, [leadId, refreshToken])

  const timelineEvents = useMemo(
    () => events.filter((event) => isGrowthDrawerTimelineEventType(event.eventType)),
    [events],
  )
  const collapsedSummary =
    timelineEvents.length === 0
      ? "No system events"
      : timelineEvents.length === 1
        ? "1 event"
        : `${timelineEvents.length} events`

  return (
    <GrowthCollapsibleEngineCard
      title="Timeline"
      icon={<Clock className="size-4" />}
      defaultOpen={false}
      compact
      persistKey={GROWTH_DRAWER_CARD_KEYS.timeline}
      headerAside={<span className="text-xs text-muted-foreground">{collapsedSummary}</span>}
    >
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">System and intelligence audit log</p>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading timeline…
          </div>
        ) : timelineEvents.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
            No system events yet.
          </div>
        ) : (
          <ol className="relative space-y-0 border-l border-border/60 pl-5">
            {timelineEvents.map((event, index) => {
              const meta = eventMeta(event.eventType)
              const Icon = meta.icon
              return (
                <li key={event.id} className={cn("relative pb-3", index === timelineEvents.length - 1 && "pb-0")}>
                  <span className="absolute -left-[1.35rem] flex size-5 items-center justify-center rounded-full border border-background bg-muted/80 text-muted-foreground">
                    <Icon className="size-3" />
                  </span>
                  <div className="rounded-md border border-border/60 bg-muted/5 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{event.title}</p>
                        {event.summary ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{event.summary}</p>
                        ) : null}
                        {event.actorEmail ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{event.actorEmail}</p>
                        ) : null}
                      </div>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        title={new Date(event.occurredAt).toLocaleString()}
                      >
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
    </GrowthCollapsibleEngineCard>
  )
}
