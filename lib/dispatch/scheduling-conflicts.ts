/**
 * Phase 2: lightweight client-side scheduling conflict detection.
 *
 * Operates on already-loaded dispatch rows so it adds no new fetches and is
 * fully reactive to client-side filtering / drag actions. Returns existing
 * appointments that overlap a target tech + date + slot. Two appointments are
 * considered "in the same slot" when:
 *   - assigned to the same technician (`assigned_user_id` or `assigned_technician_id`)
 *   - on the same scheduled_on (YYYY-MM-DD)
 *   - share the same dispatch slot index (`timeToSlotIndex`)
 *
 * Used by:
 *   - Quick Add dialog: pre-flight warning while user picks tech/time
 *   - Dispatch board drag/drop: post-drop toast warning
 *
 * NOTE: This intentionally does NOT block the action; conflict warnings are
 * informational. Enforcement (if ever needed) belongs at API/DB level.
 */

import type { DispatchWo } from "@/components/dispatch/dispatch-board"
import { timeToSlotIndex } from "@/lib/dispatch/board-utils"

export type SchedulingConflictTarget = {
  technicianId: string | null
  scheduledOn: string | null
  /** "HH:MM" 24h, or null when slot is unknown / unassigned. */
  scheduledTimeHhMm: string | null
}

export type SchedulingConflict = {
  id: string
  workOrderNumber: number | null
  title: string
  customerName: string
  status: string
  scheduledTime: string | null
  technicianLabel: string | null
}

function ymdHead(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  return s.length >= 10 ? s.slice(0, 10) : s
}

function workOrderMatchesTechnicianSelection(wo: DispatchWo, technicianId: string): boolean {
  if (wo.assigned_user_id && wo.assigned_user_id === technicianId) return true
  if (wo.assigned_technician_id && wo.assigned_technician_id === technicianId) return true
  return false
}

/**
 * Returns dispatch rows that overlap the target slot. Pass `excludeWoId` when
 * checking before a drag/drop or edit so the moving WO doesn't conflict with
 * itself.
 */
export function findSlotConflicts(
  rows: DispatchWo[],
  target: SchedulingConflictTarget,
  opts?: { excludeWoId?: string | null },
): SchedulingConflict[] {
  if (!target.technicianId || !target.scheduledOn) return []
  const targetYmd = ymdHead(target.scheduledOn)
  if (!targetYmd) return []
  const targetSlot = timeToSlotIndex(target.scheduledTimeHhMm ?? null)
  const exclude = opts?.excludeWoId?.trim() ?? null

  const out: SchedulingConflict[] = []
  for (const wo of rows) {
    if (!workOrderMatchesTechnicianSelection(wo, target.technicianId)) continue
    if (ymdHead(wo.scheduled_on) !== targetYmd) continue
    if (timeToSlotIndex(wo.scheduled_time) !== targetSlot) continue
    if (exclude && wo.id === exclude) continue
    if (["completed", "invoiced"].includes(wo.status)) continue
    out.push({
      id: wo.id,
      workOrderNumber: wo.work_order_number ?? null,
      title: wo.title,
      customerName: wo.customerName,
      status: wo.status,
      scheduledTime: wo.scheduled_time,
      technicianLabel: wo.technicianLabel ?? null,
    })
  }
  return out
}

/** Compact summary suitable for toast/inline copy. */
export function describeConflicts(
  conflicts: SchedulingConflict[],
  techLabel: string | null,
): string | null {
  if (conflicts.length === 0) return null
  const who = techLabel?.trim() ? techLabel.trim() : "this technician"
  if (conflicts.length === 1) {
    const c = conflicts[0]!
    const num = c.workOrderNumber ? `#${c.workOrderNumber}` : ""
    const title = c.title?.trim() ? c.title.trim().slice(0, 60) : "another job"
    return `${who} already has ${num ? num + " " : ""}${title} in this slot.`
  }
  return `${who} already has ${conflicts.length} jobs in this slot.`
}

/**
 * Phase 4: lightweight neighbor-slot detection. Returns rows in adjacent
 * (±1) slots so dispatchers see "tight" placements (e.g. a 9:00 start while
 * a 10:30 job is already on the calendar). Excludes the exact slot — those
 * are handled by `findSlotConflicts` and surfaced more prominently.
 *
 * "Where safe" — only fires when target has technicianId + scheduledOn +
 * timeHhMm. Never emits for unassigned drops or pool moves.
 */
export function findNeighborSlotConflicts(
  rows: DispatchWo[],
  target: SchedulingConflictTarget,
  opts?: { excludeWoId?: string | null },
): SchedulingConflict[] {
  if (!target.technicianId || !target.scheduledOn || !target.scheduledTimeHhMm) return []
  const targetYmd = ymdHead(target.scheduledOn)
  if (!targetYmd) return []
  const targetSlot = timeToSlotIndex(target.scheduledTimeHhMm)
  if (targetSlot < 0) return []
  const exclude = opts?.excludeWoId?.trim() ?? null

  const out: SchedulingConflict[] = []
  for (const wo of rows) {
    if (!workOrderMatchesTechnicianSelection(wo, target.technicianId)) continue
    if (ymdHead(wo.scheduled_on) !== targetYmd) continue
    const woSlot = timeToSlotIndex(wo.scheduled_time)
    if (woSlot < 0) continue
    const delta = Math.abs(woSlot - targetSlot)
    if (delta !== 1) continue
    if (exclude && wo.id === exclude) continue
    if (["completed", "invoiced"].includes(wo.status)) continue
    out.push({
      id: wo.id,
      workOrderNumber: wo.work_order_number ?? null,
      title: wo.title,
      customerName: wo.customerName,
      status: wo.status,
      scheduledTime: wo.scheduled_time,
      technicianLabel: wo.technicianLabel ?? null,
    })
  }
  return out
}

/** Soft inline summary for ±1 slot warnings. */
export function describeNeighborConflicts(
  conflicts: SchedulingConflict[],
  techLabel: string | null,
): string | null {
  if (conflicts.length === 0) return null
  const who = techLabel?.trim() ? techLabel.trim() : "this technician"
  if (conflicts.length === 1) {
    const c = conflicts[0]!
    const num = c.workOrderNumber ? `#${c.workOrderNumber}` : ""
    return `${who} has ${num ? num + " " : ""}an adjacent job — leave travel time.`
  }
  return `${who} has ${conflicts.length} adjacent jobs — leave travel time.`
}
