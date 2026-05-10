/**
 * Phase 36B — bulk dispatch review + validation (informational warnings only).
 */

import type { DispatchTech, DispatchWo } from "@/components/dispatch/dispatch-board"
import {
  assessDispatchAddressQualityForWorkOrder,
} from "@/lib/dispatch/dispatch-address"
import { DISPATCH_HEAVY_DAY_JOB_THRESHOLD } from "@/lib/dispatch/schedule-warnings"
import { findSlotConflicts } from "@/lib/dispatch/scheduling-conflicts"

const TERMINAL = new Set(["completed", "invoiced", "completed_pending_signature"])

const ACTIVE = new Set(["open", "scheduled", "in_progress"])

export type BulkDispatchPlanningStatus = "open" | "scheduled" | "in_progress"

export type BulkDispatchFormAction =
  | {
      kind: "assign_technician"
      technicianUserId: string
      scheduledOn: string
      scheduledTimeHhMm: string | null
    }
  | { kind: "unassign" }
  | { kind: "set_scheduled_date"; scheduledOn: string }
  | { kind: "set_scheduled_time"; scheduledTimeHhMm: string | null }
  | { kind: "set_status"; targetStatus: BulkDispatchPlanningStatus }

export type BulkDispatchSkipped = { workOrderId: string; reason: string }

export type BulkDispatchReview = {
  action: BulkDispatchFormAction
  eligible: DispatchWo[]
  skipped: BulkDispatchSkipped[]
  globalWarnings: string[]
  /** Distinct technician display names touched by this bulk (current + target). */
  affectedTechnicianLabels: string[]
  /** Short human lines for the review modal. */
  intentSummaryLines: string[]
}

function ymd(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  return s.length >= 10 ? s.slice(0, 10) : null
}

function timeHhMmFromDb(t: string | null | undefined): string | null {
  if (!t?.trim()) return null
  return t.trim().slice(0, 5)
}

function isSchedulingBulkAction(action: BulkDispatchFormAction): boolean {
  return action.kind !== "set_status"
}

export function terminalWorkOrderStatus(status: string): boolean {
  return TERMINAL.has(status)
}

/** Planning-safe bulk targets (no invoiced / completion side-effects on dispatch). */
export const BULK_DISPATCH_STATUS_OPTIONS: BulkDispatchPlanningStatus[] = [
  "open",
  "scheduled",
  "in_progress",
]

export function partitionBulkDispatchSelection(args: {
  selectedIds: string[]
  /** Work orders the user can see on the board (already org + scope filtered). */
  workOrdersById: Map<string, DispatchWo>
  action: BulkDispatchFormAction
}): { eligible: DispatchWo[]; skipped: BulkDispatchSkipped[] } {
  const eligible: DispatchWo[] = []
  const skipped: BulkDispatchSkipped[] = []
  const sched = isSchedulingBulkAction(args.action)

  for (const id of args.selectedIds) {
    const wo = args.workOrdersById.get(id)
    if (!wo) {
      skipped.push({ workOrderId: id, reason: "Not in the current dispatch list (refresh or adjust filters)." })
      continue
    }
    if (sched && terminalWorkOrderStatus(wo.status)) {
      skipped.push({
        workOrderId: id,
        reason: "Completed / invoiced — scheduling changes are skipped.",
      })
      continue
    }
    if (args.action.kind === "set_status") {
      if (terminalWorkOrderStatus(wo.status)) {
        skipped.push({
          workOrderId: id,
          reason: "Terminal status — status bulk update skipped.",
        })
        continue
      }
      if (wo.status === args.action.targetStatus) {
        skipped.push({ workOrderId: id, reason: "Already at the selected status." })
        continue
      }
    }
    eligible.push(wo)
  }
  return { eligible, skipped }
}

function cloneWoVirtual(w: DispatchWo): DispatchWo {
  return { ...w }
}

/**
 * Apply a bulk intent to a copy of `workOrders` for conflict/heavy-day simulation.
 */
export function applyVirtualBulkDispatch(
  workOrders: DispatchWo[],
  eligibleIds: Set<string>,
  action: BulkDispatchFormAction,
  fallbackDateYmd: string,
): DispatchWo[] {
  return workOrders.map((w) => {
    if (!eligibleIds.has(w.id)) return w
    const v = cloneWoVirtual(w)
    switch (action.kind) {
      case "assign_technician": {
        v.assigned_user_id = action.technicianUserId
        v.scheduled_on = action.scheduledOn
        v.scheduled_time =
          action.scheduledTimeHhMm != null ? `${action.scheduledTimeHhMm}:00` : null
        if (v.status === "open") v.status = "scheduled"
        return v
      }
      case "unassign": {
        v.assigned_user_id = null
        v.assigned_technician_id = null
        return v
      }
      case "set_scheduled_date": {
        v.scheduled_on = action.scheduledOn
        return v
      }
      case "set_scheduled_time": {
        const on = ymd(v.scheduled_on) ?? fallbackDateYmd
        v.scheduled_on = on
        v.scheduled_time =
          action.scheduledTimeHhMm != null ? `${action.scheduledTimeHhMm}:00` : null
        return v
      }
      case "set_status": {
        v.status = action.targetStatus
        return v
      }
    }
  })
}

function countJobsForTechDay(rows: DispatchWo[], techUserId: string, dayYmd: string): number {
  let n = 0
  for (const w of rows) {
    if (!w.assigned_user_id || w.assigned_user_id !== techUserId) continue
    if (ymd(w.scheduled_on) !== dayYmd) continue
    if (!ACTIVE.has(w.status)) continue
    n++
  }
  return n
}

function collectOverlapWarnings(virtual: DispatchWo[], eligible: DispatchWo[]): string[] {
  for (const wo of eligible) {
    const vw = virtual.find((x) => x.id === wo.id)
    if (!vw?.assigned_user_id) continue
    const hhmm = timeHhMmFromDb(vw.scheduled_time)
    if (!hhmm) continue
    const day = ymd(vw.scheduled_on)
    if (!day) continue
    const conflicts = findSlotConflicts(
      virtual,
      { technicianId: vw.assigned_user_id, scheduledOn: day, scheduledTimeHhMm: hhmm },
      { excludeWoId: wo.id },
    )
    if (conflicts.length > 0) {
      return ["Possible overlap — some jobs share the same technician, day, and time slot."]
    }
  }
  return []
}

function collectPerJobInformationalWarnings(wo: DispatchWo): string[] {
  const out: string[] = []
  if (wo.opsFlags?.sched_past_due) {
    out.push("Past-due scheduled work (before today).")
  }
  if (wo.fromServiceRequest) {
    out.push("Originated from a service request — confirm scope with the customer.")
  }
  const addr = assessDispatchAddressQualityForWorkOrder(wo)
  if (addr.quality === "missing") {
    out.push("Missing address on file — routing may be incomplete.")
  }
  return out
}

export function buildBulkDispatchReview(args: {
  action: BulkDispatchFormAction
  eligible: DispatchWo[]
  skipped: BulkDispatchSkipped[]
  /** Full peer list (e.g. `displayWorkOrders`) for virtual scheduling simulation. */
  allWorkOrders: DispatchWo[]
  technicians: DispatchTech[]
  /** Selected calendar day on dispatch (fallback when a WO has no date). */
  selectedYmd: string
  assignedOnlyUser: boolean
}): BulkDispatchReview {
  const techLabel = new Map(args.technicians.map((t) => [t.id, t.label] as const))
  const eligibleIds = new Set(args.eligible.map((w) => w.id))
  const virtual = applyVirtualBulkDispatch(
    args.allWorkOrders,
    eligibleIds,
    args.action,
    args.selectedYmd,
  )

  const globalWarnings: string[] = []
  const intentSummaryLines: string[] = []

  if (args.assignedOnlyUser) {
    globalWarnings.push(
      "Assigned-work view — bulk changes apply only to jobs you can load on this board.",
    )
  }

  switch (args.action.kind) {
    case "assign_technician": {
      const label = techLabel.get(args.action.technicianUserId) ?? "Technician"
      intentSummaryLines.push(`Assign ${args.eligible.length} job(s) to ${label}.`)
      intentSummaryLines.push(
        `Schedule date: ${args.action.scheduledOn}` +
          (args.action.scheduledTimeHhMm
            ? ` · Time: ${args.action.scheduledTimeHhMm}`
            : " · Time: cleared"),
      )
      const day = args.action.scheduledOn
      const after = countJobsForTechDay(virtual, args.action.technicianUserId, day)
      if (after >= DISPATCH_HEAVY_DAY_JOB_THRESHOLD) {
        globalWarnings.push(
          `Heavy day risk — ${after} jobs for ${label} on ${day} after this change (threshold ${DISPATCH_HEAVY_DAY_JOB_THRESHOLD}).`,
        )
      }
      globalWarnings.push(...collectOverlapWarnings(virtual, args.eligible))
      break
    }
    case "unassign": {
      intentSummaryLines.push(`Remove technician assignment from ${args.eligible.length} job(s).`)
      intentSummaryLines.push("Scheduled dates and times are kept unless you edit them separately.")
      break
    }
    case "set_scheduled_date": {
      intentSummaryLines.push(`Set scheduled date to ${args.action.scheduledOn} for ${args.eligible.length} job(s).`)
      const heavyMsgs = new Set<string>()
      for (const wo of args.eligible) {
        const vw = virtual.find((x) => x.id === wo.id)
        if (!vw?.assigned_user_id) continue
        const label = techLabel.get(vw.assigned_user_id) ?? "Technician"
        const d = ymd(vw.scheduled_on)
        if (!d) continue
        const c = countJobsForTechDay(virtual, vw.assigned_user_id, d)
        if (c >= DISPATCH_HEAVY_DAY_JOB_THRESHOLD) {
          heavyMsgs.add(
            `Heavy day risk for ${label} on ${d} — ${c} jobs (threshold ${DISPATCH_HEAVY_DAY_JOB_THRESHOLD}).`,
          )
        }
      }
      for (const m of heavyMsgs) globalWarnings.push(m)
      globalWarnings.push(...collectOverlapWarnings(virtual, args.eligible))
      break
    }
    case "set_scheduled_time": {
      intentSummaryLines.push(
        args.action.scheduledTimeHhMm
          ? `Set scheduled time to ${args.action.scheduledTimeHhMm} for ${args.eligible.length} job(s).`
          : `Clear scheduled time for ${args.eligible.length} job(s).`,
      )
      globalWarnings.push(...collectOverlapWarnings(virtual, args.eligible))
      break
    }
    case "set_status": {
      intentSummaryLines.push(
        `Set status to “${args.action.targetStatus.replace(/_/g, " ")}” for ${args.eligible.length} job(s).`,
      )
      break
    }
  }

  const affected = new Set<string>()
  for (const wo of args.eligible) {
    if (wo.assigned_user_id) {
      const l = techLabel.get(wo.assigned_user_id) ?? wo.technicianLabel
      if (l) affected.add(l)
    }
  }
  if (args.action.kind === "assign_technician") {
    const l = techLabel.get(args.action.technicianUserId)
    if (l) affected.add(l)
  }

  for (const wo of args.eligible) {
    for (const m of collectPerJobInformationalWarnings(wo)) {
      if (!globalWarnings.includes(m)) globalWarnings.push(m)
    }
  }

  const deduped = [...new Set(globalWarnings)]
  return {
    action: args.action,
    eligible: args.eligible,
    skipped: args.skipped,
    globalWarnings: deduped,
    affectedTechnicianLabels: [...affected].sort((a, b) => a.localeCompare(b)),
    intentSummaryLines,
  }
}
