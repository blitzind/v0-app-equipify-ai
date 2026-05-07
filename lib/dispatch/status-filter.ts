/**
 * Phase 1: dispatch status quick-filter helpers.
 *
 * Additive — does not change existing dispatch query semantics. Defaults match
 * the page's pre-existing `DISPATCH_STATUSES` (open, scheduled, in_progress,
 * completed). Adding `invoiced` is opt-in and broadens the work-order query.
 *
 * Status filtering is applied client-side on the already-loaded dispatch rows
 * so the existing fetch path and DnD persistence remain unchanged.
 */

import type { DispatchWo } from "@/components/dispatch/dispatch-board"

export type DispatchStatusKey =
  | "open"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "invoiced"

export const DISPATCH_STATUS_LABELS: Record<DispatchStatusKey, string> = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  invoiced: "Invoiced",
}

export const DISPATCH_STATUS_ORDER: DispatchStatusKey[] = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
]

/** Default visible set — mirrors current dispatch query (excludes `invoiced`). */
export const DEFAULT_DISPATCH_STATUSES: DispatchStatusKey[] = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
]

/** Statuses the existing dispatch query already pulls back (without opt-in). */
export const ALWAYS_FETCHED_STATUSES: DispatchStatusKey[] = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
]

export function statusToneClass(status: string): string {
  switch (status) {
    case "open":
      return "border-[color:var(--status-info)]/35 text-[color:var(--status-info)]"
    case "scheduled":
      return "border-[color:var(--status-info)]/35 text-[color:var(--status-info)]"
    case "in_progress":
      return "border-[color:var(--status-warning)]/40 text-[color:var(--status-warning)]"
    case "completed":
      return "border-[color:var(--status-success)]/40 text-[color:var(--status-success)]"
    case "completed_pending_signature":
      return "border-[color:var(--status-success)]/40 text-[color:var(--status-success)]"
    case "invoiced":
      return "border-border text-muted-foreground"
    default:
      return "border-border text-foreground"
  }
}

/** Map any work_order status into our 5-bucket filter key (for filtering). */
export function bucketStatus(status: string): DispatchStatusKey | null {
  switch (status) {
    case "open":
      return "open"
    case "scheduled":
      return "scheduled"
    case "in_progress":
      return "in_progress"
    case "completed":
    case "completed_pending_signature":
      return "completed"
    case "invoiced":
      return "invoiced"
    default:
      return null
  }
}

export function filterByStatuses(
  rows: DispatchWo[],
  selected: DispatchStatusKey[],
): DispatchWo[] {
  if (selected.length === 0 || selected.length === DISPATCH_STATUS_ORDER.length) {
    return rows
  }
  const set = new Set<DispatchStatusKey>(selected)
  return rows.filter((wo) => {
    const bucket = bucketStatus(wo.status)
    return bucket != null && set.has(bucket)
  })
}

export function countByStatus(rows: DispatchWo[]): Record<DispatchStatusKey, number> {
  const out: Record<DispatchStatusKey, number> = {
    open: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    invoiced: 0,
  }
  for (const wo of rows) {
    const b = bucketStatus(wo.status)
    if (b) out[b] += 1
  }
  return out
}
