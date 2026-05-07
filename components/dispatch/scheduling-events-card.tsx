"use client"

import { useEffect, useState } from "react"
import { History, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  fetchSchedulingEvents,
  type SchedulingEvent,
} from "@/lib/dispatch/scheduling-events-client"

/**
 * Phase 4: lightweight scheduling events timeline rendered inside the
 * work-order drawer.
 *
 * - Reads from `/api/work-orders/scheduling-events?workOrderId=...` via the
 *   non-blocking client helper. Empty array on any error — never throws.
 * - Collapsed by default to preserve drawer vertical space.
 * - Renders preformatted human-readable messages — never displays raw UUIDs.
 *   (The API + client helper produce labels from human fields.)
 * - Severity drives left-border color but stays subtle (no dominant red blocks).
 */

type Props = {
  workOrderId: string | null
  /** Optional initial events (e.g. SSR-fetched). */
  initialEvents?: SchedulingEvent[]
  /** Force expanded on mount. Defaults to false. */
  defaultExpanded?: boolean
  /** Hook called after events refresh; useful for parents that want to know counts. */
  onEventsLoaded?: (events: SchedulingEvent[]) => void
  /** Refresh trigger — increment to force re-fetch. */
  refreshKey?: number
  className?: string
}

const SEVERITY_BORDER: Record<SchedulingEvent["severity"], string> = {
  info: "border-l-border",
  warning: "border-l-[color:var(--status-warning)]/60",
  critical: "border-l-destructive/70",
}

const TYPE_LABEL: Record<SchedulingEvent["eventType"], string> = {
  note: "Note",
  reschedule: "Reschedule",
  reassign: "Reassign",
  unassign: "Unassign",
  quick_add: "Quick add",
  conflict_acknowledged: "Conflict ack",
  system_observation: "System",
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ""
  const diffMs = Date.now() - t
  const min = Math.round(diffMs / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function fmtAbsolute(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function SchedulingEventsCard({
  workOrderId,
  initialEvents,
  defaultExpanded = false,
  onEventsLoaded,
  refreshKey,
  className,
}: Props) {
  const [events, setEvents] = useState<SchedulingEvent[]>(initialEvents ?? [])
  const [loading, setLoading] = useState(!initialEvents)
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    if (!workOrderId) {
      setEvents([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const list = await fetchSchedulingEvents(workOrderId, 25)
      if (cancelled) return
      setEvents(list)
      setLoading(false)
      onEventsLoaded?.(list)
    })()
    return () => {
      cancelled = true
    }
    // refreshKey/workOrderId trigger refetch; onEventsLoaded is stable in callers
    // but exclude to avoid effect loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, refreshKey])

  if (!workOrderId) return null
  if (loading && events.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-card/40 px-3 py-2 text-[11px] text-muted-foreground",
          className,
        )}
      >
        Loading scheduling activity…
      </div>
    )
  }
  if (!loading && events.length === 0) return null

  const visible = expanded ? events : events.slice(0, 3)
  const hidden = events.length - visible.length

  return (
    <section
      aria-label="Scheduling activity"
      className={cn(
        "rounded-lg border border-border bg-card/40 px-3 py-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "hover:bg-muted/40",
        )}
      >
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="h-3.5 w-3.5" aria-hidden />
          Scheduling activity
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {events.length}
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      <ul className="mt-1.5 space-y-1.5">
        {visible.map((ev) => (
          <li
            key={ev.id}
            className={cn(
              "rounded-md border-l-2 bg-background/40 px-2.5 py-1.5",
              SEVERITY_BORDER[ev.severity],
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {TYPE_LABEL[ev.eventType] ?? ev.eventType}
              </span>
              <span
                className="shrink-0 text-[10px] text-muted-foreground"
                title={fmtAbsolute(ev.createdAt)}
              >
                {fmtRelative(ev.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 break-words text-xs leading-snug text-foreground">{ev.message}</p>
            {ev.actorEmail || ev.actorKind !== "operator" ? (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {ev.actorEmail ?? `(${ev.actorKind})`}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          Show {hidden} more
        </button>
      ) : null}
    </section>
  )
}
