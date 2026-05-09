/**
 * Phase 35: soft scheduling warnings (informational only).
 * Uses existing schedule fields + ops flags; no migrations.
 */

import { timeToSlotIndex } from "@/lib/dispatch/board-utils"

/** Jobs at or above this count on one calendar day for one technician → "Heavy day". */
export const DISPATCH_HEAVY_DAY_JOB_THRESHOLD = 6

const ACTIVE = new Set(["open", "scheduled", "in_progress"])

export type ScheduleWarnPeer = {
  id: string
  status: string
  scheduled_on: string | null
  scheduled_time: string | null
  assigned_user_id: string | null
  customer_id: string
  customerLocationId?: string | null
  opsFlags?: { sched_past_due?: boolean } | null
}

export type ScheduleWarningItem = {
  key: string
  message: string
}

function ymd(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  return s.length >= 10 ? s.slice(0, 10) : s
}

function locationDupKey(p: Pick<ScheduleWarnPeer, "customer_id" | "customerLocationId">): string {
  const lid = p.customerLocationId?.trim()
  if (lid) return `loc:${lid}`
  return `cust:${p.customer_id}`
}

function dedupeByKey(items: ScheduleWarningItem[]): ScheduleWarningItem[] {
  const seen = new Set<string>()
  return items.filter((x) => {
    if (seen.has(x.key)) return false
    seen.add(x.key)
    return true
  })
}

/**
 * Informational warnings for one work order vs an already-scoped peer list
 * (same org, typically same week or day as dispatch / schedule views).
 */
export function collectScheduleWarningsForPeer(
  wo: ScheduleWarnPeer,
  peers: ScheduleWarnPeer[],
): ScheduleWarningItem[] {
  const out: ScheduleWarningItem[] = []

  if (wo.opsFlags?.sched_past_due) {
    out.push({ key: "past-due", message: "Past due — scheduled before today." })
  }

  if (!wo.assigned_user_id && ACTIVE.has(wo.status) && ymd(wo.scheduled_on)) {
    out.push({ key: "unassigned-scheduled", message: "Unassigned scheduled job — pick a technician." })
  }

  const ctx = ymd(wo.scheduled_on)
  if (!ctx) return dedupeByKey(out)

  const dayPeers = peers.filter((p) => ymd(p.scheduled_on) === ctx && ACTIVE.has(p.status))

  if (wo.assigned_user_id && wo.scheduled_time?.trim()) {
    const slot = timeToSlotIndex(wo.scheduled_time)
    const sameSlot = dayPeers.filter(
      (p) =>
        p.id !== wo.id &&
        p.assigned_user_id === wo.assigned_user_id &&
        timeToSlotIndex(p.scheduled_time) === slot,
    )
    if (sameSlot.length > 0) {
      out.push({
        key: "overlap",
        message: "Possible overlap — another job in the same time slot for this technician.",
      })
    }

    const dayCount = dayPeers.filter((p) => p.assigned_user_id === wo.assigned_user_id).length
    if (dayCount >= DISPATCH_HEAVY_DAY_JOB_THRESHOLD) {
      out.push({ key: "heavy-day", message: "Heavy day — many jobs scheduled for this technician." })
    }
  }

  if (wo.scheduled_time?.trim()) {
    const slot = timeToSlotIndex(wo.scheduled_time)
    const lk = locationDupKey(wo)
    const sameSite = dayPeers.filter(
      (p) => p.id !== wo.id && timeToSlotIndex(p.scheduled_time) === slot && locationDupKey(p) === lk,
    )
    if (sameSite.length > 0) {
      out.push({
        key: "site-conflict",
        message: "Possible site conflict — another visit same customer/site at this time.",
      })
    }
  }

  return dedupeByKey(out)
}

export function buildScheduleWarningsByPeer(
  rows: ScheduleWarnPeer[],
): Map<string, ScheduleWarningItem[]> {
  const m = new Map<string, ScheduleWarningItem[]>()
  for (const wo of rows) {
    m.set(wo.id, collectScheduleWarningsForPeer(wo, rows))
  }
  return m
}

export type SelectedDayScheduleRiskSummary = {
  /** Distinct tech+slot cells on `selectedYmd` with more than one active job. */
  overlappingSlotCount: number
  /** Distinct time+site keys on `selectedYmd` with more than one active job. */
  siteConflictGroupCount: number
}

export function computeSelectedDayScheduleRiskSummary(
  rows: ScheduleWarnPeer[],
  selectedYmd: string,
): SelectedDayScheduleRiskSummary {
  const techSlotCounts = new Map<string, number>()
  const siteCounts = new Map<string, number>()

  for (const w of rows) {
    if (ymd(w.scheduled_on) !== selectedYmd) continue
    if (!ACTIVE.has(w.status)) continue
    if (!w.assigned_user_id || !w.scheduled_time?.trim()) continue
    const slot = timeToSlotIndex(w.scheduled_time)
    const tk = `${w.assigned_user_id}|${slot}`
    techSlotCounts.set(tk, (techSlotCounts.get(tk) ?? 0) + 1)
    const sk = `${slot}|${locationDupKey(w)}`
    siteCounts.set(sk, (siteCounts.get(sk) ?? 0) + 1)
  }

  let overlappingSlotCount = 0
  for (const n of techSlotCounts.values()) {
    if (n > 1) overlappingSlotCount++
  }
  let siteConflictGroupCount = 0
  for (const n of siteCounts.values()) {
    if (n > 1) siteConflictGroupCount++
  }

  return { overlappingSlotCount, siteConflictGroupCount }
}
