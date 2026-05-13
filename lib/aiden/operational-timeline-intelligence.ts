import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import type {
  OperationalEquipmentThread,
  OperationalEquipmentThreadStep,
  OperationalEscalationSequence,
  OperationalEventGroup,
  OperationalIncidentSummary,
  OperationalRecurringChain,
  OperationalTimelineEvent,
  OperationalTimelineIntelligence,
  OperationalTimelineMethodologyEntry,
  OperationalTimelineRuleId,
  OperationalTrendPoint,
} from "@/lib/aiden/operational-timeline-types"
import { OPERATIONAL_TIMELINE_SCHEMA_VERSION } from "@/lib/aiden/operational-timeline-types"

const METHODOLOGY: OperationalTimelineMethodologyEntry[] = [
  {
    ruleId: "RULE.PM_RECURRENCE_SAME_EQUIP_90D",
    title: "PM recurrence on one asset",
    explanation:
      "Two or more `type=pm` work orders on the same `equipment_id` where the earliest and latest `created_at` in that PM set are within 90 days.",
  },
  {
    ruleId: "RULE.REPEAT_ACTIVE_SAME_EQUIP_30D",
    title: "Repeat active workload on one asset",
    explanation:
      "Two or more work orders still in an active status family on the same `equipment_id`, all `created_at` within 30 days.",
  },
  {
    ruleId: "RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE",
    title: "Inspection schedule slip (still active)",
    explanation:
      "`type=inspection`, status is open/scheduled/in_progress, `scheduled_on` is before today (UTC date compare), and `completed_at` is null.",
  },
  {
    ruleId: "RULE.PRIORITY_INCREASE_SAME_EQUIP_14D",
    title: "Priority escalation on one asset",
    explanation:
      "On the same `equipment_id`, a newer work order has a strictly higher numeric priority rank than an older one within 14 days (ordered by `created_at`).",
  },
  {
    ruleId: "RULE.REFRIGERATION_SIGNAL_TITLE_OR_TYPE",
    title: "Refrigeration / cooling signal",
    explanation:
      "`type=emergency` OR title contains any refrigeration substring (case-insensitive). Industry key may reinforce narrative but does not change detection.",
  },
  {
    ruleId: "RULE.RENTAL_READINESS_TITLE_VOCAB",
    title: "Rental / readiness vocabulary",
    explanation: "Title contains rental/turnaround/yard/readiness substrings (case-insensitive).",
  },
  {
    ruleId: "RULE.CALIBRATION_TITLE_VOCAB",
    title: "Calibration vocabulary",
    explanation: "Title contains calibration/traceability/NIST substrings (case-insensitive).",
  },
  {
    ruleId: "RULE.EMERGENCY_REPEAT_SAME_EQUIP_60D",
    title: "Emergency repeat on one asset",
    explanation: "Two or more `type=emergency` on the same `equipment_id` within 60 days of each other.",
  },
  {
    ruleId: "RULE.WEEKLY_VOLUME_TREND",
    title: "Weekly operational mix",
    explanation:
      "ISO-week buckets (UTC) of `created_at` for the sampled work orders — counts by coarse `type` bucket (emergency / pm / inspection / other).",
  },
]

const ACTIVE_STATUSES = new Set(["open", "scheduled", "in_progress", "completed_pending_signature"])

const REFRIGERATION_SUBSTRINGS = [
  "refrigerant",
  "walk-in",
  "walk in",
  "rack",
  "cooler",
  "freezer",
  "compressor",
  "evaporator",
  "defrost",
  "low temp",
  "low-temp",
] as const

const RENTAL_SUBSTRINGS = ["rental", "turnaround", "yard", "rent-ready", "rent ready", "between turns", "damage review"] as const

const CALIBRATION_SUBSTRINGS = [
  "calibration",
  "nist",
  "traceable",
  "as-found",
  "as found",
  "as-left",
  "as left",
  "metrology",
] as const

export type TimelineWorkOrderRow = {
  id: string
  equipment_id: string | null
  customer_id: string | null
  title: string | null
  status: string | null
  priority: string | null
  type: string | null
  scheduled_on: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

const TIMELINE_SELECT =
  "id, equipment_id, customer_id, title, status, priority, type, scheduled_on, completed_at, created_at, updated_at"

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function titleLower(t: string | null | undefined): string {
  return (t ?? "").toLowerCase()
}

function containsAny(hay: string, needles: readonly string[]): boolean {
  return needles.some((n) => hay.includes(n))
}

function priorityRank(p: string | null | undefined): number {
  const s = (p ?? "").toLowerCase()
  if (s === "critical") return 4
  if (s === "high") return 3
  if (s === "medium" || s === "normal") return 2
  if (s === "low") return 1
  return 0
}

function clipTitle(title: string | null | undefined, max = 56): string {
  const t = (title ?? "").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function isoWeekStartUtc(dIso: string): string {
  const d = new Date(dIso.includes("T") ? dIso : `${dIso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return dIso.slice(0, 10)
  const day = d.getUTCDay()
  const diff = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

export async function fetchOperationalTimelineWorkOrders(
  supabase: SupabaseClient,
  args: { organizationId: string; woIds: string[] | null; createdAfterIso: string; limit: number },
): Promise<TimelineWorkOrderRow[]> {
  let q = supabase
    .from("work_orders")
    .select(TIMELINE_SELECT)
    .eq("organization_id", args.organizationId)
    .is("archived_at", null)
    .gte("created_at", args.createdAfterIso)
    .order("created_at", { ascending: false })
    .limit(args.limit)
  if (args.woIds) q = q.in("id", args.woIds)
  const { data, error } = await q
  if (error) return []
  return (data ?? []) as TimelineWorkOrderRow[]
}

function labelsForRow(row: TimelineWorkOrderRow, industryKey: WorkspaceIndustryKey | null): string[] {
  const labels: string[] = []
  const tl = titleLower(row.title)
  const st = (row.status ?? "").toLowerCase()
  const ty = (row.type ?? "").toLowerCase()

  if (ty === "pm") labels.push("pm")
  if (ty === "emergency") labels.push("emergency")
  if (ty === "inspection") labels.push("inspection")

  if (ty === "emergency" || containsAny(tl, REFRIGERATION_SUBSTRINGS)) {
    labels.push("refrigeration_signal")
  }
  if (containsAny(tl, RENTAL_SUBSTRINGS)) labels.push("rental_readiness_signal")
  if (containsAny(tl, CALIBRATION_SUBSTRINGS)) labels.push("calibration_signal")

  if (
    ty === "inspection" &&
    ACTIVE_STATUSES.has(st) &&
    row.scheduled_on &&
    row.scheduled_on < utcTodayYmd() &&
    !row.completed_at
  ) {
    labels.push("inspection_schedule_slip")
  }

  if (industryKey === "refrigeration_service" && (ty === "emergency" || containsAny(tl, REFRIGERATION_SUBSTRINGS))) {
    labels.push("industry_refrigeration_context")
  }
  if (industryKey === "equipment_rental" && containsAny(tl, RENTAL_SUBSTRINGS)) {
    labels.push("industry_rental_context")
  }
  if (industryKey === "calibration_inspection" && containsAny(tl, CALIBRATION_SUBSTRINGS)) {
    labels.push("industry_calibration_context")
  }

  return [...new Set(labels)]
}

function buildEvents(rows: TimelineWorkOrderRow[], industryKey: WorkspaceIndustryKey | null): OperationalTimelineEvent[] {
  const out: OperationalTimelineEvent[] = []
  let idx = 0
  for (const row of rows) {
    const occurredAt = row.created_at ?? row.updated_at ?? new Date().toISOString()
    const labs = labelsForRow(row, industryKey)
    const rules: OperationalTimelineRuleId[] = []
    const tl = titleLower(row.title)
    const ty = (row.type ?? "").toLowerCase()

    if (ty === "emergency" || containsAny(tl, REFRIGERATION_SUBSTRINGS)) {
      rules.push("RULE.REFRIGERATION_SIGNAL_TITLE_OR_TYPE")
    }
    if (containsAny(tl, RENTAL_SUBSTRINGS)) rules.push("RULE.RENTAL_READINESS_TITLE_VOCAB")
    if (containsAny(tl, CALIBRATION_SUBSTRINGS)) rules.push("RULE.CALIBRATION_TITLE_VOCAB")

    if (
      ty === "inspection" &&
      ACTIVE_STATUSES.has((row.status ?? "").toLowerCase()) &&
      row.scheduled_on &&
      row.scheduled_on < utcTodayYmd() &&
      !row.completed_at
    ) {
      rules.push("RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE")
    }

    if (labs.length === 0 && rules.length === 0) {
      out.push({
        eventIndex: idx++,
        workOrderId: row.id,
        equipmentId: row.equipment_id,
        customerId: row.customer_id,
        occurredAt,
        kind: "work_order_snapshot",
        summary: `${clipTitle(row.title) || "Work order"} — type ${ty || "unknown"}, status ${(row.status ?? "").toLowerCase() || "unknown"}.`,
        workOrderType: row.type,
        workOrderPriority: row.priority,
        workOrderStatus: row.status,
        correlationRuleIds: [],
      })
      if (out.length >= 120) break
      continue
    }

    const summaryParts: string[] = []
    if (labs.includes("inspection_schedule_slip")) {
      summaryParts.push("Inspection is still active with scheduled date in the past (UTC compare on scheduled_on).")
    }
    if (labs.includes("refrigeration_signal")) summaryParts.push("Refrigeration / cooling-related signal from type or title.")
    if (labs.includes("rental_readiness_signal")) summaryParts.push("Rental / turnaround vocabulary in title.")
    if (labs.includes("calibration_signal")) summaryParts.push("Calibration / traceability vocabulary in title.")
    if (labs.includes("pm")) summaryParts.push("Preventive maintenance job.")
    if (labs.includes("emergency")) summaryParts.push("Emergency-type job.")

    out.push({
      eventIndex: idx++,
      workOrderId: row.id,
      equipmentId: row.equipment_id,
      customerId: row.customer_id,
      occurredAt,
      kind: labs[0] ?? "derived_signal",
      summary: summaryParts.join(" ") || clipTitle(row.title) || "Work order activity.",
      workOrderType: row.type,
      workOrderPriority: row.priority,
      workOrderStatus: row.status,
      correlationRuleIds: [...new Set(rules)],
    })
    if (out.length >= 120) break
  }
  return out
}

function sortAscByCreated(a: TimelineWorkOrderRow, b: TimelineWorkOrderRow): number {
  const ta = new Date(a.created_at ?? 0).getTime()
  const tb = new Date(b.created_at ?? 0).getTime()
  return ta - tb
}

function buildEquipmentThreads(rows: TimelineWorkOrderRow[], industryKey: WorkspaceIndustryKey | null): OperationalEquipmentThread[] {
  const byEq = new Map<string, TimelineWorkOrderRow[]>()
  for (const r of rows) {
    if (!r.equipment_id) continue
    const cur = byEq.get(r.equipment_id) ?? []
    cur.push(r)
    byEq.set(r.equipment_id, cur)
  }
  const threads: OperationalEquipmentThread[] = []
  for (const [equipmentId, list] of byEq) {
    if (list.length < 2) continue
    const sorted = [...list].sort(sortAscByCreated)
    const steps: OperationalEquipmentThreadStep[] = sorted.map((row) => ({
      workOrderId: row.id,
      createdAt: row.created_at ?? "",
      type: row.type,
      priority: row.priority,
      status: row.status,
      scheduledOn: row.scheduled_on,
      titleSnippet: clipTitle(row.title, 48),
      labels: labelsForRow(row, industryKey),
    }))
    const first = sorted[0]?.created_at ?? ""
    const last = sorted[sorted.length - 1]?.created_at ?? ""
    threads.push({
      equipmentId,
      workOrderCount: sorted.length,
      firstCreatedAt: first,
      lastCreatedAt: last,
      steps,
    })
  }
  threads.sort((a, b) => b.workOrderCount - a.workOrderCount)
  return threads.slice(0, 15)
}

function withinDays(aIso: string, bIso: string, days: number): boolean {
  const ta = new Date(aIso).getTime()
  const tb = new Date(bIso).getTime()
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false
  return Math.abs(tb - ta) <= days * 86400000
}

function buildPmChains(rows: TimelineWorkOrderRow[]): OperationalRecurringChain[] {
  const byEq = new Map<string, TimelineWorkOrderRow[]>()
  for (const r of rows) {
    if (!r.equipment_id) continue
    if ((r.type ?? "").toLowerCase() !== "pm") continue
    const cur = byEq.get(r.equipment_id) ?? []
    cur.push(r)
    byEq.set(r.equipment_id, cur)
  }
  const chains: OperationalRecurringChain[] = []
  for (const [equipmentId, list] of byEq) {
    if (list.length < 2) continue
    const sorted = [...list].sort(sortAscByCreated)
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    if (withinDays(first.created_at ?? "", last.created_at ?? "", 90)) {
      chains.push({
        chainKind: "pm_recurrence_same_equipment",
        equipmentId,
        customerId: first.customer_id,
        workOrderIds: sorted.map((x) => x.id),
        windowDays: 90,
        correlationRuleIds: ["RULE.PM_RECURRENCE_SAME_EQUIP_90D"],
        summary: `${sorted.length} PM work orders on one asset with first/last created_at within 90 days.`,
      })
    }
  }
  return chains.slice(0, 20)
}

function buildEmergencyRepeatChains(rows: TimelineWorkOrderRow[]): OperationalRecurringChain[] {
  const byEq = new Map<string, TimelineWorkOrderRow[]>()
  for (const r of rows) {
    if (!r.equipment_id) continue
    if ((r.type ?? "").toLowerCase() !== "emergency") continue
    const cur = byEq.get(r.equipment_id) ?? []
    cur.push(r)
    byEq.set(r.equipment_id, cur)
  }
  const chains: OperationalRecurringChain[] = []
  for (const [equipmentId, list] of byEq) {
    if (list.length < 2) continue
    const sorted = [...list].sort(sortAscByCreated)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      if (withinDays(a.created_at ?? "", b.created_at ?? "", 60)) {
        chains.push({
          chainKind: "emergency_repeat_same_equipment",
          equipmentId,
          customerId: a.customer_id,
          workOrderIds: sorted.map((x) => x.id),
          windowDays: 60,
          correlationRuleIds: ["RULE.EMERGENCY_REPEAT_SAME_EQUIP_60D"],
          summary: "Multiple emergency-type jobs on the same asset within 60 days.",
        })
        break
      }
    }
  }
  return chains.slice(0, 15)
}

function buildRepeatActiveChains(rows: TimelineWorkOrderRow[]): OperationalRecurringChain[] {
  const byEq = new Map<string, TimelineWorkOrderRow[]>()
  for (const r of rows) {
    if (!r.equipment_id) continue
    if (!ACTIVE_STATUSES.has((r.status ?? "").toLowerCase())) continue
    const cur = byEq.get(r.equipment_id) ?? []
    cur.push(r)
    byEq.set(r.equipment_id, cur)
  }
  const chains: OperationalRecurringChain[] = []
  for (const [equipmentId, list] of byEq) {
    if (list.length < 2) continue
    const sorted = [...list].sort(sortAscByCreated)
    const recent = sorted.filter((a) => withinDays(sorted[0]!.created_at ?? "", a.created_at ?? "", 30))
    if (recent.length >= 2) {
      chains.push({
        chainKind: "repeat_active_same_equipment",
        equipmentId,
        customerId: sorted[0]!.customer_id,
        workOrderIds: recent.map((x) => x.id),
        windowDays: 30,
        correlationRuleIds: ["RULE.REPEAT_ACTIVE_SAME_EQUIP_30D"],
        summary: "Multiple still-active jobs on one asset opened within 30 days.",
      })
    }
  }
  return chains.slice(0, 20)
}

function buildTitleClusters(
  rows: TimelineWorkOrderRow[],
  substrings: readonly string[],
  chainKind: OperationalRecurringChain["chainKind"],
  rule: OperationalTimelineRuleId,
  summary: string,
): OperationalRecurringChain[] {
  const hits = rows.filter((r) => containsAny(titleLower(r.title), substrings))
  if (hits.length < 3) return []
  const byEq = new Map<string | "none", TimelineWorkOrderRow[]>()
  for (const h of hits) {
    const k = h.equipment_id ?? "none"
    const cur = byEq.get(k) ?? []
    cur.push(h)
    byEq.set(k, cur)
  }
  const out: OperationalRecurringChain[] = []
  for (const [key, list] of byEq) {
    if (list.length < 2) continue
    const equipmentId = key === "none" ? null : key
    out.push({
      chainKind,
      equipmentId,
      customerId: list[0]!.customer_id,
      workOrderIds: list.slice(0, 12).map((x) => x.id),
      windowDays: 120,
      correlationRuleIds: [rule],
      summary,
    })
  }
  return out.slice(0, 10)
}

function buildEscalations(rows: TimelineWorkOrderRow[]): OperationalEscalationSequence[] {
  const byEq = new Map<string, TimelineWorkOrderRow[]>()
  for (const r of rows) {
    if (!r.equipment_id) continue
    const cur = byEq.get(r.equipment_id) ?? []
    cur.push(r)
    byEq.set(r.equipment_id, cur)
  }
  const out: OperationalEscalationSequence[] = []
  for (const [equipmentId, list] of byEq) {
    if (list.length < 2) continue
    const sorted = [...list].sort(sortAscByCreated)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!
      const cur = sorted[i]!
      if (!withinDays(prev.created_at ?? "", cur.created_at ?? "", 14)) continue
      const pr = priorityRank(prev.priority)
      const cr = priorityRank(cur.priority)
      if (cr > pr) {
        out.push({
          equipmentId,
          steps: [
            {
              workOrderId: prev.id,
              createdAt: prev.created_at ?? "",
              priority: prev.priority,
              priorityRank: pr,
            },
            {
              workOrderId: cur.id,
              createdAt: cur.created_at ?? "",
              priority: cur.priority,
              priorityRank: cr,
            },
          ],
          correlationRuleIds: ["RULE.PRIORITY_INCREASE_SAME_EQUIP_14D"],
          summary: "Priority increased between consecutive jobs on the same asset within 14 days.",
        })
      }
    }
  }
  return out.slice(0, 18)
}

function buildEventGroups(rows: TimelineWorkOrderRow[], industryKey: WorkspaceIndustryKey | null): OperationalEventGroup[] {
  const map = new Map<string, { theme: string; wos: Set<string>; eq: Set<string>; rules: Set<OperationalTimelineRuleId> }>()
  for (const r of rows) {
    const labs = labelsForRow(r, industryKey)
    for (const lab of labs) {
      const key = `${r.equipment_id ?? "no-equip"}::${lab}`
      if (!map.has(key)) {
        map.set(key, { theme: lab, wos: new Set(), eq: new Set(), rules: new Set() })
      }
      const slot = map.get(key)!
      slot.wos.add(r.id)
      if (r.equipment_id) slot.eq.add(r.equipment_id)
      if (lab === "refrigeration_signal") slot.rules.add("RULE.REFRIGERATION_SIGNAL_TITLE_OR_TYPE")
      if (lab === "rental_readiness_signal") slot.rules.add("RULE.RENTAL_READINESS_TITLE_VOCAB")
      if (lab === "calibration_signal") slot.rules.add("RULE.CALIBRATION_TITLE_VOCAB")
      if (lab === "inspection_schedule_slip") slot.rules.add("RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE")
    }
  }
  const groups: OperationalEventGroup[] = []
  for (const [groupKey, v] of map) {
    if (v.wos.size < 2) continue
    groups.push({
      groupKey,
      theme: v.theme,
      workOrderIds: [...v.wos],
      equipmentIds: [...v.eq],
      correlationRuleIds: [...v.rules],
      summary: `Grouped ${v.wos.size} work orders sharing label "${v.theme}" on the same equipment bucket.`,
    })
  }
  groups.sort((a, b) => b.workOrderIds.length - a.workOrderIds.length)
  return groups.slice(0, 16)
}

function buildTrends(rows: TimelineWorkOrderRow[]): OperationalTimelineIntelligence["operationalTrendTimelines"] {
  const buckets = new Map<string, OperationalTrendPoint>()
  for (const r of rows) {
    const ca = r.created_at
    if (!ca) continue
    const wk = isoWeekStartUtc(ca)
    if (!buckets.has(wk)) {
      buckets.set(wk, { weekStartUtc: wk, emergency: 0, pm: 0, inspection: 0, other: 0 })
    }
    const slot = buckets.get(wk)!
    const ty = (r.type ?? "").toLowerCase()
    if (ty === "emergency") slot.emergency += 1
    else if (ty === "pm") slot.pm += 1
    else if (ty === "inspection") slot.inspection += 1
    else slot.other += 1
  }
  const sortedWeeks = [...buckets.keys()].sort().slice(-8)
  const points = sortedWeeks.map((w) => buckets.get(w)!).filter(Boolean)
  return [
    {
      id: "wo_volume_by_type_weekly",
      label: "Work order creations by week (UTC) and coarse type",
      points,
    },
  ]
}

function buildIncidentSummaries(
  chainsPm: OperationalRecurringChain[],
  chainsEm: OperationalRecurringChain[],
  esc: OperationalEscalationSequence[],
  inspectionGroups: OperationalEventGroup[],
): OperationalIncidentSummary[] {
  const out: OperationalIncidentSummary[] = []
  let n = 0
  for (const c of chainsEm) {
    out.push({
      id: `inc-em-${n++}`,
      title: "Repeat emergency workload",
      body: c.summary,
      severity: "high",
      relatedEquipmentIds: c.equipmentId ? [c.equipmentId] : [],
      relatedWorkOrderIds: c.workOrderIds,
      correlationRuleIds: c.correlationRuleIds,
    })
  }
  for (const c of chainsPm) {
    out.push({
      id: `inc-pm-${n++}`,
      title: "PM recurrence pattern",
      body: c.summary,
      severity: "medium",
      relatedEquipmentIds: c.equipmentId ? [c.equipmentId] : [],
      relatedWorkOrderIds: c.workOrderIds,
      correlationRuleIds: c.correlationRuleIds,
    })
  }
  for (const e of esc) {
    out.push({
      id: `inc-esc-${n++}`,
      title: "Priority escalation sequence",
      body: e.summary,
      severity: "medium",
      relatedEquipmentIds: e.equipmentId ? [e.equipmentId] : [],
      relatedWorkOrderIds: e.steps.map((s) => s.workOrderId),
      correlationRuleIds: e.correlationRuleIds,
    })
  }
  for (const g of inspectionGroups.filter((x) => x.theme === "inspection_schedule_slip")) {
    out.push({
      id: `inc-insp-${n++}`,
      title: "Inspection schedule slip cluster",
      body: g.summary,
      severity: "medium",
      relatedEquipmentIds: g.equipmentIds,
      relatedWorkOrderIds: g.workOrderIds,
      correlationRuleIds: g.correlationRuleIds.length ? g.correlationRuleIds : ["RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE"],
    })
  }
  return out.slice(0, 8)
}

/**
 * Pure builder for tests — same logic as org fetch path.
 */
export function buildOperationalTimelineIntelligenceFromRows(
  rows: TimelineWorkOrderRow[],
  options: {
    industryKey: WorkspaceIndustryKey | null
    generatedAtIso: string
    createdAfterUtc: string
    rowLimit: number
  },
): OperationalTimelineIntelligence {
  const industryKey = options.industryKey
  const chainsPm = buildPmChains(rows)
  const chainsEm = buildEmergencyRepeatChains(rows)
  const chainsActive = buildRepeatActiveChains(rows)
  const calClusters = buildTitleClusters(
    rows,
    CALIBRATION_SUBSTRINGS,
    "calibration_title_cluster",
    "RULE.CALIBRATION_TITLE_VOCAB",
    "Several jobs with calibration vocabulary in titles (equipment bucketed).",
  )
  const rentalClusters = buildTitleClusters(
    rows,
    RENTAL_SUBSTRINGS,
    "rental_readiness_cluster",
    "RULE.RENTAL_READINESS_TITLE_VOCAB",
    "Several jobs with rental/turnaround vocabulary in titles.",
  )
  const refClusters: OperationalRecurringChain[] = []
  const byEq = new Map<string, TimelineWorkOrderRow[]>()
  for (const r of rows) {
    const labs = labelsForRow(r, industryKey)
    if (!labs.includes("refrigeration_signal")) continue
    if (!r.equipment_id) continue
    const cur = byEq.get(r.equipment_id) ?? []
    cur.push(r)
    byEq.set(r.equipment_id, cur)
  }
  for (const [equipmentId, list] of byEq) {
    if (list.length < 2) continue
    refClusters.push({
      chainKind: "refrigeration_emergency_cluster",
      equipmentId,
      customerId: list[0]!.customer_id,
      workOrderIds: list.slice(0, 12).map((x) => x.id),
      windowDays: 120,
      correlationRuleIds: ["RULE.REFRIGERATION_SIGNAL_TITLE_OR_TYPE"],
      summary: "Multiple refrigeration-related signals on the same asset in the sampled window.",
    })
  }

  const escalationSequences = buildEscalations(rows)
  const operationalEventGroups = buildEventGroups(rows, industryKey)
  const inspectionGroups = operationalEventGroups.filter((g) => g.theme === "inspection_schedule_slip")

  const recurringIssueChains = [
    ...chainsPm,
    ...chainsEm,
    ...chainsActive,
    ...calClusters,
    ...rentalClusters,
    ...refClusters.slice(0, 8),
  ]

  const repeatFailureHistory = [...chainsEm, ...chainsActive].slice(0, 20)

  return {
    schemaVersion: OPERATIONAL_TIMELINE_SCHEMA_VERSION,
    generatedAt: options.generatedAtIso,
    window: { createdAfterUtc: options.createdAfterUtc, rowLimit: options.rowLimit, rowCount: rows.length },
    industryKeyUsed: industryKey,
    methodology: METHODOLOGY,
    operationalEvents: buildEvents(rows, industryKey),
    equipmentOperationalThreads: buildEquipmentThreads(rows, industryKey),
    recurringIssueChains,
    repeatFailureHistory,
    escalationSequences,
    operationalEventGroups,
    incidentSummaries: buildIncidentSummaries(chainsPm, chainsEm, escalationSequences, inspectionGroups),
    operationalTrendTimelines: buildTrends(rows),
    deterministicCrossReads: [
      {
        snapshotPath: "samples.scheduleCongestionExamples",
        rationale:
          "Same snapshot: same-day / same-assignee job counts flag dispatch bottlenecks; compare directionally with weekly creation mix in operationalTrendTimelines.",
      },
      {
        snapshotPath: "samples.repeatEquipmentPatterns",
        rationale:
          "90-day repeat equipment counts complement equipmentOperationalThreads (thread uses the 120-day bounded WO pull).",
      },
    ],
  }
}

export async function buildOperationalTimelineIntelligenceForOrg(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    woIds: string[] | null
    industryKey: WorkspaceIndustryKey | null
    createdAfterIso: string
    rowLimit: number
    generatedAtIso: string
  },
): Promise<OperationalTimelineIntelligence> {
  const rows = await fetchOperationalTimelineWorkOrders(supabase, {
    organizationId: args.organizationId,
    woIds: args.woIds,
    createdAfterIso: args.createdAfterIso,
    limit: args.rowLimit,
  })
  return buildOperationalTimelineIntelligenceFromRows(rows, {
    industryKey: args.industryKey,
    generatedAtIso: args.generatedAtIso,
    createdAfterUtc: args.createdAfterIso,
    rowLimit: args.rowLimit,
  })
}

/** @internal Exported for scripts/tests that need the rolling window helper. */
export function operationalTimelineDefaultCreatedAfterIso(): string {
  return daysAgoIso(120)
}
