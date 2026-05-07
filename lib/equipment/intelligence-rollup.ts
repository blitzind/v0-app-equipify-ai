/**
 * Equipment Intelligence — Phase 2
 *
 * Reusable rollup helpers for equipment-centric reporting:
 *   - per-customer (or per-customer-tree) category breakdown
 *   - per-equipment compact signals (history count, open WOs, repeat-repair,
 *     warranty + calibration status)
 *
 * Strict rules:
 *   - all queries are tenant-scoped via `organization_id`
 *   - non-throwing: every helper returns an empty/zero result on failure
 *   - schema-drift safe: gracefully tolerates missing
 *     `next_calibration_due_at` (Phase 1 column) on legacy DBs
 *   - never expose raw UUIDs in returned display strings
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { isEquipmentListSchemaMismatchError } from "@/lib/equipment/equipment-detail-queries"

// ─── Category breakdown ──────────────────────────────────────────────────────

export type EquipmentCategoryBreakdownRow = {
  /** "Uncategorized" when the underlying row has no category. */
  category: string
  /** Distinct active equipment in the category. */
  equipmentCount: number
  /** Distinct equipment with at least one open/scheduled/in-progress WO. */
  equipmentWithOpenWo: number
  /** Total open WO count (open + scheduled + in_progress). */
  openWorkOrderCount: number
  /** Completed + invoiced WOs (lifetime, scoped by `since` when supplied). */
  completedWorkOrderCount: number
  /** Sum of labor + parts on completed/invoiced WOs (cents). */
  revenueCents: number
  /** Equipment whose `next_due_at` or `next_calibration_due_at` falls within `dueWindowDays`. */
  upcomingDueCount: number
  /** Equipment with a `next_due_at` or `next_calibration_due_at` already past. */
  overdueCount: number
}

export type EquipmentCategoryBreakdownArgs = {
  organizationId: string
  /** Restrict to a set of customer ids (e.g. parent + children). */
  customerIds?: string[]
  /** Lifetime by default; pass an ISO date to scope completed/revenue to that lookback. */
  since?: string | null
  /** Days for "upcoming due" classification. Defaults to 30. */
  dueWindowDays?: number
}

const OPEN_WO_STATUSES = ["open", "scheduled", "in_progress"] as const
const COMPLETED_WO_STATUSES = ["completed", "invoiced"] as const

function todayIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10)
}

function daysFromNowIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10)
}

function categoryLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim()
  return s.length > 0 ? s : "Uncategorized"
}

type EquipmentForBreakdownRow = {
  id: string
  customer_id: string
  category: string | null
  next_due_at: string | null
  /** May be missing on legacy DBs without Phase 1. */
  next_calibration_due_at?: string | null
}

type WoForBreakdownRow = {
  id: string
  equipment_id: string | null
  status: string
  total_labor_cents: number | null
  total_parts_cents: number | null
  updated_at: string | null
}

/**
 * Aggregate equipment by category for a tenant — optionally scoped to a
 * specific set of customer ids (used for customer detail + parent rollup).
 *
 * Returns rows sorted by `equipmentCount` desc, then alphabetical.
 */
export async function loadEquipmentCategoryBreakdown(
  supabase: SupabaseClient,
  args: EquipmentCategoryBreakdownArgs,
): Promise<EquipmentCategoryBreakdownRow[]> {
  const { organizationId, customerIds, since } = args
  const dueWindowDays = Math.max(0, args.dueWindowDays ?? 30)

  // 1. Equipment scoped (active, non-archived). Try Phase 1 columns first;
  //    fall back to legacy select on `42703` schema mismatch.
  let equipmentRows: EquipmentForBreakdownRow[] = []
  {
    const fullSelect = "id, customer_id, category, next_due_at, next_calibration_due_at"
    const legacySelect = "id, customer_id, category, next_due_at"

    let query = supabase
      .from("equipment")
      .select(fullSelect)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
    if (customerIds && customerIds.length > 0) {
      query = query.in("customer_id", customerIds)
    }
    let res = await query.limit(5000)

    if (res.error && isEquipmentListSchemaMismatchError(res.error)) {
      let legacyQuery = supabase
        .from("equipment")
        .select(legacySelect)
        .eq("organization_id", organizationId)
        .is("archived_at", null)
      if (customerIds && customerIds.length > 0) {
        legacyQuery = legacyQuery.in("customer_id", customerIds)
      }
      res = await legacyQuery.limit(5000)
    }

    if (!res.error && res.data) {
      equipmentRows = res.data as EquipmentForBreakdownRow[]
    }
  }

  if (equipmentRows.length === 0) return []

  const equipmentIds = equipmentRows.map((r) => r.id)
  const idToCategory = new Map<string, string>()
  for (const e of equipmentRows) idToCategory.set(e.id, categoryLabel(e.category))

  // 2. Work orders for those equipment ids — open + completed in one shot.
  const woIn = customerIds && customerIds.length > 0 ? customerIds : null
  let woQuery = supabase
    .from("work_orders")
    .select("id, equipment_id, status, total_labor_cents, total_parts_cents, updated_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .not("equipment_id", "is", null)
    .in("equipment_id", equipmentIds)
  if (woIn) woQuery = woQuery.in("customer_id", woIn)
  if (since) woQuery = woQuery.gte("updated_at", since)
  const woRes = await woQuery.limit(5000)
  const woRows: WoForBreakdownRow[] = !woRes.error && woRes.data
    ? (woRes.data as WoForBreakdownRow[])
    : []

  // 3. Aggregate.
  type Agg = {
    eqIds: Set<string>
    openEqIds: Set<string>
    open: number
    completed: number
    revenueCents: number
    upcoming: number
    overdue: number
  }

  const today = todayIso()
  const upcomingCutoff = daysFromNowIso(dueWindowDays)

  const map = new Map<string, Agg>()

  // Seed each category with its equipment + due/overdue classification.
  for (const e of equipmentRows) {
    const cat = idToCategory.get(e.id) ?? "Uncategorized"
    let agg = map.get(cat)
    if (!agg) {
      agg = {
        eqIds: new Set(),
        openEqIds: new Set(),
        open: 0,
        completed: 0,
        revenueCents: 0,
        upcoming: 0,
        overdue: 0,
      }
      map.set(cat, agg)
    }
    agg.eqIds.add(e.id)
    const dueDates = [e.next_due_at, e.next_calibration_due_at].filter(
      (x): x is string => Boolean(x),
    )
    let isUpcoming = false
    let isOverdue = false
    for (const d of dueDates) {
      if (d < today) isOverdue = true
      else if (d <= upcomingCutoff) isUpcoming = true
    }
    if (isOverdue) agg.overdue += 1
    else if (isUpcoming) agg.upcoming += 1
  }

  // Layer in WO counts/revenue.
  for (const w of woRows) {
    if (!w.equipment_id) continue
    const cat = idToCategory.get(w.equipment_id) ?? null
    if (!cat) continue
    const agg = map.get(cat)
    if (!agg) continue
    if ((OPEN_WO_STATUSES as readonly string[]).includes(w.status)) {
      agg.open += 1
      agg.openEqIds.add(w.equipment_id)
    } else if ((COMPLETED_WO_STATUSES as readonly string[]).includes(w.status)) {
      agg.completed += 1
      agg.revenueCents += (w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)
    }
  }

  const out: EquipmentCategoryBreakdownRow[] = [...map.entries()]
    .map(([category, agg]) => ({
      category,
      equipmentCount: agg.eqIds.size,
      equipmentWithOpenWo: agg.openEqIds.size,
      openWorkOrderCount: agg.open,
      completedWorkOrderCount: agg.completed,
      revenueCents: agg.revenueCents,
      upcomingDueCount: agg.upcoming,
      overdueCount: agg.overdue,
    }))
    .sort((a, b) => {
      if (b.equipmentCount !== a.equipmentCount) return b.equipmentCount - a.equipmentCount
      return a.category.localeCompare(b.category)
    })

  return out
}

// ─── Per-equipment signals ───────────────────────────────────────────────────

export type EquipmentSignals = {
  /** Service history count (lifetime work orders for this equipment). */
  historyCount: number
  /** Open / scheduled / in-progress work orders for this equipment. */
  openWorkOrderCount: number
  /** True when the equipment has 2+ repair work orders in the trailing 90 days. */
  repeatRepair: boolean
  /** "active" | "expiring_soon" (≤ 30d) | "expired" | "unknown". */
  warranty: "active" | "expiring_soon" | "expired" | "unknown"
  daysToWarrantyExpiry: number | null
  /** Combined PM/calibration signal: "ok" | "due_soon" (≤14d) | "overdue". */
  maintenance: "ok" | "due_soon" | "overdue" | "unknown"
}

export const EMPTY_EQUIPMENT_SIGNALS: EquipmentSignals = {
  historyCount: 0,
  openWorkOrderCount: 0,
  repeatRepair: false,
  warranty: "unknown",
  daysToWarrantyExpiry: null,
  maintenance: "unknown",
}

type EquipmentSignalRow = {
  id: string
  warranty_expires_at: string | null
  warranty_expiration_date?: string | null
  next_due_at: string | null
  next_calibration_due_at?: string | null
}

type WoSignalRow = {
  id: string
  equipment_id: string | null
  status: string
  type: string | null
  created_at: string | null
}

function classifyWarranty(expIso: string | null): {
  state: EquipmentSignals["warranty"]
  daysLeft: number | null
} {
  if (!expIso) return { state: "unknown", daysLeft: null }
  const today = new Date(todayIso() + "T00:00:00Z").getTime()
  const exp = new Date(expIso.length === 10 ? `${expIso}T00:00:00Z` : expIso).getTime()
  if (!Number.isFinite(exp)) return { state: "unknown", daysLeft: null }
  const ms = exp - today
  const daysLeft = Math.round(ms / (24 * 60 * 60 * 1000))
  if (daysLeft < 0) return { state: "expired", daysLeft }
  if (daysLeft <= 30) return { state: "expiring_soon", daysLeft }
  return { state: "active", daysLeft }
}

function classifyMaintenance(
  nextDue: string | null,
  nextCal: string | null | undefined,
): EquipmentSignals["maintenance"] {
  const dates = [nextDue, nextCal].filter((x): x is string => Boolean(x))
  if (dates.length === 0) return "unknown"
  const today = todayIso()
  const cutoff = daysFromNowIso(14)
  let overdue = false
  let dueSoon = false
  for (const d of dates) {
    if (d < today) overdue = true
    else if (d <= cutoff) dueSoon = true
  }
  if (overdue) return "overdue"
  if (dueSoon) return "due_soon"
  return "ok"
}

/**
 * Bulk-load equipment signals for a list of equipment ids. Returns a Map
 * keyed by equipment id with `EMPTY_EQUIPMENT_SIGNALS` for any id that fails
 * to resolve. Safe on legacy DBs.
 */
export async function loadEquipmentSignalsByIds(
  supabase: SupabaseClient,
  args: { organizationId: string; equipmentIds: string[] },
): Promise<Map<string, EquipmentSignals>> {
  const out = new Map<string, EquipmentSignals>()
  const { organizationId, equipmentIds } = args
  if (equipmentIds.length === 0) return out

  // Equipment metadata — try Phase 1 select, fallback to legacy.
  let equipmentRows: EquipmentSignalRow[] = []
  {
    const fullSelect =
      "id, warranty_expires_at, warranty_expiration_date, next_due_at, next_calibration_due_at"
    const legacySelect = "id, warranty_expires_at, next_due_at"

    let res = await supabase
      .from("equipment")
      .select(fullSelect)
      .eq("organization_id", organizationId)
      .in("id", equipmentIds)

    if (res.error && isEquipmentListSchemaMismatchError(res.error)) {
      res = await supabase
        .from("equipment")
        .select(legacySelect)
        .eq("organization_id", organizationId)
        .in("id", equipmentIds)
    }
    if (!res.error && res.data) equipmentRows = res.data as EquipmentSignalRow[]
  }

  // WO history (last 365d worth of activity is enough for repeat-repair + count).
  const historyCutoff = daysFromNowIso(-365)
  const woRes = await supabase
    .from("work_orders")
    .select("id, equipment_id, status, type, created_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("equipment_id", equipmentIds)
    .gte("created_at", historyCutoff)
    .limit(2000)

  const woRows: WoSignalRow[] = !woRes.error && woRes.data ? (woRes.data as WoSignalRow[]) : []

  type Counters = {
    history: number
    open: number
    repairsLast90: number
  }
  const counters = new Map<string, Counters>()
  const repeatCutoffIso = daysFromNowIso(-90)
  for (const w of woRows) {
    if (!w.equipment_id) continue
    const c = counters.get(w.equipment_id) ?? { history: 0, open: 0, repairsLast90: 0 }
    c.history += 1
    if ((OPEN_WO_STATUSES as readonly string[]).includes(w.status)) c.open += 1
    if (
      (w.type ?? "").toLowerCase() === "repair" &&
      w.created_at &&
      w.created_at >= `${repeatCutoffIso}T00:00:00.000Z`
    ) {
      c.repairsLast90 += 1
    }
    counters.set(w.equipment_id, c)
  }

  for (const e of equipmentRows) {
    const exp =
      e.warranty_expiration_date?.trim() || e.warranty_expires_at?.trim() || null
    const w = classifyWarranty(exp)
    const m = classifyMaintenance(e.next_due_at, e.next_calibration_due_at ?? null)
    const c = counters.get(e.id) ?? { history: 0, open: 0, repairsLast90: 0 }
    out.set(e.id, {
      historyCount: c.history,
      openWorkOrderCount: c.open,
      repeatRepair: c.repairsLast90 >= 2,
      warranty: w.state,
      daysToWarrantyExpiry: w.daysLeft,
      maintenance: m,
    })
  }
  // Backfill empty rows for any id we couldn't load.
  for (const id of equipmentIds) {
    if (!out.has(id)) out.set(id, { ...EMPTY_EQUIPMENT_SIGNALS })
  }
  return out
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export function formatCentsCompact(cents: number): string {
  if (!Number.isFinite(cents)) return "$0"
  const abs = Math.abs(cents)
  if (abs >= 100_000_000) {
    return `${cents < 0 ? "-" : ""}$${(abs / 100_000_000).toFixed(1)}M`
  }
  if (abs >= 100_000) {
    return `${cents < 0 ? "-" : ""}$${(abs / 100_000).toFixed(1)}k`
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
