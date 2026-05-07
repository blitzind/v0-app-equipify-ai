/**
 * Phase 2: lightweight client-side scheduling conflict detection.
 *
 * Operates on already-loaded dispatch rows so it adds no new fetches and is
 * fully reactive to client-side filtering / drag actions. Returns existing
 * appointments that overlap a target tech + date + slot. Two appointments are
 * considered "in the same slot" when:
 *   - assigned to the same technician (assigned_user_id)
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
    if (!wo.assigned_user_id || wo.assigned_user_id !== target.technicianId) continue
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
