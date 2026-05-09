"use client"

/**
 * Phase 4: browser helper for `/api/work-orders/scheduling-events`.
 *
 * Used by the dispatch board (drag/drop reschedule), QuickAppointmentDialog
 * (quick add), and WorkOrderDrawer (technician reassignment, edit-time
 * scheduling change).
 *
 * Design rules:
 * - **Non-blocking**: every emit is fire-and-forget; the calling mutation
 *   (work_orders update / insert) MUST NOT depend on the event being
 *   recorded. Failure is logged in development only and silently swallowed
 *   in production so a 5xx event-log API does not break dispatch.
 * - **No raw UUIDs in user-visible message**: callers compose the `message`
 *   from human labels (technician name, scheduled date, work-order #).
 *   Internal IDs may live in `metadata` for audit completeness — `metadata`
 *   is only readable to org members through RLS.
 * - **No service role**: writes go through the route handler which uses the
 *   caller's Supabase session (RLS enforced).
 */

import type {
  SchedulingEvent,
  SchedulingEventInput,
  SchedulingEventSeverity,
  SchedulingEventType,
} from "@/lib/dispatch/scheduling-events"

export type { SchedulingEvent } from "@/lib/dispatch/scheduling-events"

type EmitArgs = Omit<SchedulingEventInput, "actorUserId" | "actorEmail" | "actorKind"> & {
  /** Optional override; defaults to "operator". */
  actorKind?: SchedulingEventInput["actorKind"]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function devWarn(label: string, payload: unknown): void {
  if (process.env.NODE_ENV !== "production") {
     
    console.warn(`[scheduling-events] ${label}`, payload)
  }
}

/**
 * Emit a scheduling event for a work order. Returns the inserted row on
 * success or `null` on any error/RLS rejection. NEVER throws.
 *
 * Callers should ignore the return value and continue regardless.
 */
export async function emitSchedulingEvent(args: EmitArgs): Promise<SchedulingEvent | null> {
  if (!UUID_RE.test(args.organizationId) || !UUID_RE.test(args.workOrderId)) {
    devWarn("invalid ids — skipping emit", {
      organizationId: args.organizationId.slice(0, 8),
      workOrderId: args.workOrderId.slice(0, 8),
    })
    return null
  }
  if (!args.message?.trim()) {
    devWarn("empty message — skipping emit", { eventType: args.eventType })
    return null
  }

  try {
    const res = await fetch("/api/work-orders/scheduling-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: args.organizationId,
        workOrderId: args.workOrderId,
        eventType: args.eventType,
        severity: args.severity ?? "info",
        message: args.message.trim(),
        metadata: args.metadata ?? {},
        actorKind: args.actorKind ?? "operator",
      }),
    })
    if (!res.ok) {
      devWarn(`POST returned ${res.status}`, await safeText(res))
      return null
    }
    const body = (await res.json().catch(() => null)) as { event?: SchedulingEvent } | null
    return body?.event ?? null
  } catch (err) {
    devWarn("network error — silently dropped", err)
    return null
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return "(no body)"
  }
}

/**
 * GET helper for the timeline card in the work-order drawer. Same
 * non-blocking semantics — empty array on any error.
 */
export async function fetchSchedulingEvents(
  workOrderId: string,
  limit = 25,
): Promise<SchedulingEvent[]> {
  if (!UUID_RE.test(workOrderId)) return []
  const url = `/api/work-orders/scheduling-events?workOrderId=${encodeURIComponent(
    workOrderId,
  )}&limit=${Math.max(1, Math.min(100, Math.floor(limit)))}`
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" })
    if (!res.ok) return []
    const body = (await res.json().catch(() => null)) as { events?: SchedulingEvent[] } | null
    return body?.events ?? []
  } catch {
    return []
  }
}

// ─── Message composition helpers ──────────────────────────────────────────────
//
// These never include raw UUIDs. They take pre-derived human labels (from the
// work order, technician roster, customer map). All times are formatted as
// "MMM D, YYYY h:mm AM/PM" or just "MMM D, YYYY" when no time is supplied.

function fmtDateLabel(ymd: string | null | undefined): string | null {
  if (!ymd) return null
  const s = ymd.trim()
  if (!s) return null
  // YYYY-MM-DD interpreted as local — append a noon time to avoid timezone slip.
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtTimeLabel(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null
  const trimmed = hhmm.trim()
  if (!trimmed) return null
  // Accept "HH:MM" or "HH:MM:SS"
  const head = trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed
  const [h, m] = head.split(":")
  const hh = Number.parseInt(h ?? "", 10)
  const mm = Number.parseInt(m ?? "", 10)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed
  const pad = (n: number) => String(n).padStart(2, "0")
  const meridian = hh >= 12 ? "PM" : "AM"
  const h12 = ((hh + 11) % 12) + 1
  return `${h12}:${pad(mm)} ${meridian}`
}

export function composeRescheduleMessage(args: {
  scheduledOn: string | null
  scheduledTimeHhMm: string | null
}): string {
  const date = fmtDateLabel(args.scheduledOn)
  const time = fmtTimeLabel(args.scheduledTimeHhMm)
  if (date && time) return `Rescheduled to ${date} at ${time}.`
  if (date) return `Rescheduled to ${date}.`
  return "Rescheduled."
}

export function composeReassignMessage(args: {
  fromTechLabel: string | null
  toTechLabel: string | null
}): string {
  const from = args.fromTechLabel?.trim() ? args.fromTechLabel.trim() : "Unassigned"
  const to = args.toTechLabel?.trim() ? args.toTechLabel.trim() : "Unassigned"
  if (from === to) return `Assignment confirmed: ${to}.`
  return `Reassigned from ${from} to ${to}.`
}

export function composeUnassignMessage(args: { fromTechLabel: string | null }): string {
  const from = args.fromTechLabel?.trim() ? args.fromTechLabel.trim() : "previous technician"
  return `Unassigned from ${from} — moved back to the unassigned pool.`
}

export function composeQuickAddMessage(args: {
  scheduledOn: string | null
  scheduledTimeHhMm: string | null
  techLabel: string | null
}): string {
  const date = fmtDateLabel(args.scheduledOn)
  const time = fmtTimeLabel(args.scheduledTimeHhMm)
  const tech = args.techLabel?.trim() ? args.techLabel.trim() : null
  const when =
    date && time ? `${date} at ${time}` : date ? date : "the selected slot"
  return tech
    ? `Quick add appointment created for ${tech} on ${when}.`
    : `Quick add appointment created on ${when} (unassigned).`
}

export function composeConflictAcknowledgedMessage(args: {
  conflictCount: number
  techLabel: string | null
  /** "exact" = same slot conflict acknowledged; "neighbor" = ±1 slot. */
  proximity: "exact" | "neighbor"
}): string {
  const tech = args.techLabel?.trim() ? args.techLabel.trim() : "this technician"
  const noun = args.conflictCount === 1 ? "job" : "jobs"
  if (args.proximity === "neighbor") {
    return `Adjacent-slot warning acknowledged: ${tech} has ${args.conflictCount} nearby ${noun}.`
  }
  return `Slot conflict acknowledged: ${tech} already has ${args.conflictCount} ${noun} in this slot.`
}

/** Severity helper used by event types that should bump above plain "info". */
export function severityForConflictAck(proximity: "exact" | "neighbor"): SchedulingEventSeverity {
  return proximity === "exact" ? "warning" : "info"
}

/** Re-export for callers that do not import from `scheduling-events.ts` directly. */
export type { SchedulingEventInput, SchedulingEventSeverity, SchedulingEventType }
