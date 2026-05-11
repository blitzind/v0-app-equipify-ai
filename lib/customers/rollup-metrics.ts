/**
 * Customer hierarchy — operational + financial rollups (Phase 2 / Phase 33).
 *
 * Aggregates metrics for:
 *   - **direct** — the selected customer row only
 *   - **withSubAccounts** — that customer plus direct sub-accounts (maxDepth 1; product rule)
 *
 * Financial slices (invoice totals / quote counts) are omitted unless the caller opts in —
 * align with billing / financial visibility in the UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadCustomerRollupTree,
  type CustomerTreeNode,
} from "@/lib/customers/consolidated-rollup"
import { QUOTE_PIPELINE_DB_STATUSES, WORK_ORDER_OPEN_PIPELINE_DB } from "@/lib/kpi/definitions"

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkOrderStatusKey =
  | "open"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "invoiced"

export type InvoiceStatusKey =
  | "draft"
  | "sent"
  | "unpaid"
  | "paid"
  | "overdue"
  | "void"

/** One scope of aggregation (direct account vs rolled up with sub-accounts). */
export type CustomerRollupSlice = {
  locationCount: number
  equipmentCount: number
  workOrdersByStatus: Record<WorkOrderStatusKey, number>
  openWorkOrderCount: number
  overdueWorkOrderCount: number
  inProgressWorkOrderCount: number
  /** Open / in-triage service requests (org_service_requests). */
  openServiceRequestCount: number
  /** Quotes still actionable (draft, sent, pending approval). */
  openQuotesCount: number
  /** Active maintenance plans with next due within horizon (UTC dates). */
  upcomingMaintenanceCount: number
  /**
   * When `null`, financial fields were not loaded (viewer lacks access).
   * Operational counts above are still valid.
   */
  invoiceTotalsCents: { unpaid: number; overdue: number; paidLast365: number } | null
  invoiceCounts: Record<InvoiceStatusKey, number> | null
}

export type CustomerRollupMetrics = {
  /** The customer ids this rollup spans (root + sub-accounts per maxDepth). */
  customerIds: string[]
  tree: CustomerTreeNode[]
  maxDepthUsed: number
  /** True when only the root row could be enumerated (legacy / error). */
  schemaMigrationPending: boolean
  /** Direct sub-accounts under root (excludes root). */
  childAccountCount: number
  /** This customer alone. */
  direct: CustomerRollupSlice
  /** Root + sub-accounts (Phase 33 default depth = 1). */
  withSubAccounts: CustomerRollupSlice
}

export type LoadCustomerRollupMetricsArgs = {
  organizationId: string
  rootCustomerId: string
  /** Sub-account walk depth; default 1 (parent + direct children only). */
  maxDepth?: number
  includeFinancialRollup?: boolean
  includeQuotesRollup?: boolean
  /** Days ahead for “upcoming” maintenance plans; default 60. */
  upcomingMaintenanceHorizonDays?: number
}

// ─── Internal ────────────────────────────────────────────────────────────────

type WorkOrderMetricsRow = {
  id: string
  status: string
  scheduled_on: string | null
  archived_at: string | null
}

type InvoiceMetricsRow = {
  id: string
  status: string
  amount_cents: number | null
  paid_at: string | null
}

const EMPTY_WO_BY_STATUS: Record<WorkOrderStatusKey, number> = {
  open: 0,
  scheduled: 0,
  in_progress: 0,
  completed: 0,
  invoiced: 0,
}

const EMPTY_INVOICE_COUNTS: Record<InvoiceStatusKey, number> = {
  draft: 0,
  sent: 0,
  unpaid: 0,
  paid: 0,
  overdue: 0,
  void: 0,
}

const OPEN_WO_STATUSES = WORK_ORDER_OPEN_PIPELINE_DB as unknown as WorkOrderStatusKey[]
const UNPAID_INVOICE_STATUSES: InvoiceStatusKey[] = ["sent", "unpaid", "overdue"]
const OPEN_SR_STATUSES = ["new", "reviewing", "approved", "needs_info"] as const
const OPEN_QUOTE_STATUSES = QUOTE_PIPELINE_DB_STATUSES

const TODAY_ISO = (): string => {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10)
}

const ONE_YEAR_AGO_ISO = (): string => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10)
}

function asWorkOrderStatus(s: string): WorkOrderStatusKey | null {
  switch (s) {
    case "open":
    case "scheduled":
    case "in_progress":
    case "completed":
    case "invoiced":
      return s
    default:
      return null
  }
}

function asInvoiceStatus(s: string): InvoiceStatusKey | null {
  switch (s) {
    case "draft":
    case "sent":
    case "unpaid":
    case "paid":
    case "overdue":
    case "void":
      return s
    default:
      return null
  }
}

function emptySlice(financialOmitted: boolean): CustomerRollupSlice {
  return {
    locationCount: 0,
    equipmentCount: 0,
    workOrdersByStatus: { ...EMPTY_WO_BY_STATUS },
    openWorkOrderCount: 0,
    overdueWorkOrderCount: 0,
    inProgressWorkOrderCount: 0,
    openServiceRequestCount: 0,
    openQuotesCount: 0,
    upcomingMaintenanceCount: 0,
    invoiceTotalsCents: financialOmitted ? null : { unpaid: 0, overdue: 0, paidLast365: 0 },
    invoiceCounts: financialOmitted ? null : { ...EMPTY_INVOICE_COUNTS },
  }
}

async function aggregateRollupSlice(
  supabase: SupabaseClient,
  organizationId: string,
  customerIds: string[],
  opts: {
    includeFinancial: boolean
    includeQuotes: boolean
    upcomingHorizonDays: number
  },
): Promise<CustomerRollupSlice> {
  const financialOmitted = !opts.includeFinancial
  if (customerIds.length === 0) return emptySlice(financialOmitted)

  const cutoff365 = ONE_YEAR_AGO_ISO()
  const today = TODAY_ISO()
  const horizonEnd = new Date()
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + opts.upcomingHorizonDays)
  const horizonStr = horizonEnd.toISOString().slice(0, 10)

  const quotePromise =
    opts.includeQuotes ?
      supabase
        .from("org_quotes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("customer_id", customerIds)
        .is("archived_at", null)
        .in("status", OPEN_QUOTE_STATUSES as unknown as string[])
    : Promise.resolve({ error: null, count: 0 as number | null })

  const srPromise = supabase
    .from("org_service_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("customer_id", customerIds)
    .in("status", OPEN_SR_STATUSES as unknown as string[])

  const maintPromise = supabase
    .from("maintenance_plans")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("customer_id", customerIds)
    .eq("status", "active")
    .is("archived_at", null)
    .not("next_due_date", "is", null)
    .gte("next_due_date", today)
    .lte("next_due_date", horizonStr)

  const invPromise =
    opts.includeFinancial ?
      supabase
        .from("org_invoices")
        .select("id, status, amount_cents, paid_at")
        .eq("organization_id", organizationId)
        .in("customer_id", customerIds)
        .or(`status.in.(sent,unpaid,overdue),paid_at.gte.${cutoff365}`)
        .limit(2000)
    : Promise.resolve({ data: null, error: null })

  const [locRes, eqRes, woRes, invRes, quoteRes, srRes, maintRes] = await Promise.all([
    supabase
      .from("customer_locations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("customer_id", customerIds)
      .is("archived_at", null),
    supabase
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("customer_id", customerIds)
      .is("archived_at", null),
    supabase
      .from("work_orders")
      .select("id, status, scheduled_on, archived_at")
      .eq("organization_id", organizationId)
      .in("customer_id", customerIds)
      .is("archived_at", null)
      .limit(2000),
    invPromise,
    quotePromise,
    srPromise,
    maintPromise,
  ])

  const slice = emptySlice(financialOmitted)

  slice.locationCount = !locRes.error && typeof locRes.count === "number" ? locRes.count : 0
  slice.equipmentCount = !eqRes.error && typeof eqRes.count === "number" ? eqRes.count : 0
  slice.openServiceRequestCount = !srRes.error && typeof srRes.count === "number" ? srRes.count : 0
  slice.openQuotesCount = !quoteRes.error && typeof quoteRes.count === "number" ? quoteRes.count : 0
  slice.upcomingMaintenanceCount =
    !maintRes.error && typeof maintRes.count === "number" ? maintRes.count : 0

  if (!woRes.error && woRes.data) {
    for (const row of woRes.data as WorkOrderMetricsRow[]) {
      const key = asWorkOrderStatus(row.status)
      if (!key) continue
      slice.workOrdersByStatus[key] += 1
      if (OPEN_WO_STATUSES.includes(key)) {
        slice.openWorkOrderCount += 1
        if (key === "in_progress") slice.inProgressWorkOrderCount += 1
        if (row.scheduled_on && row.scheduled_on < today) {
          slice.overdueWorkOrderCount += 1
        }
      }
    }
  }

  if (opts.includeFinancial && invRes && "data" in invRes && !invRes.error && invRes.data) {
    for (const row of invRes.data as InvoiceMetricsRow[]) {
      const key = asInvoiceStatus(row.status)
      if (!key || !slice.invoiceCounts) continue
      slice.invoiceCounts[key] += 1
      const cents = typeof row.amount_cents === "number" ? row.amount_cents : 0
      if (UNPAID_INVOICE_STATUSES.includes(key)) {
        slice.invoiceTotalsCents!.unpaid += cents
      }
      if (key === "overdue") {
        slice.invoiceTotalsCents!.overdue += cents
      }
      if (key === "paid" && row.paid_at && row.paid_at >= cutoff365) {
        slice.invoiceTotalsCents!.paidLast365 += cents
      }
    }
  }

  return slice
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Aggregate operational (and optional financial) metrics for direct vs sub-account rollup.
 */
export async function loadCustomerRollupMetrics(
  supabase: SupabaseClient,
  args: LoadCustomerRollupMetricsArgs,
): Promise<CustomerRollupMetrics> {
  const {
    organizationId,
    rootCustomerId,
    maxDepth = 1,
    includeFinancialRollup = true,
    includeQuotesRollup = true,
    upcomingMaintenanceHorizonDays = 60,
  } = args

  const tree = await loadCustomerRollupTree(supabase, {
    organizationId,
    rootCustomerId,
    maxDepth,
  })
  const customerIds = tree.map((t) => t.id)
  const schemaMigrationPending = false

  const empty: CustomerRollupMetrics = {
    customerIds,
    tree,
    maxDepthUsed: maxDepth,
    schemaMigrationPending,
    childAccountCount: Math.max(0, tree.length - 1),
    direct: emptySlice(!includeFinancialRollup),
    withSubAccounts: emptySlice(!includeFinancialRollup),
  }

  if (customerIds.length === 0) return empty

  const [direct, withSubAccounts] = await Promise.all([
    aggregateRollupSlice(supabase, organizationId, [rootCustomerId], {
      includeFinancial: includeFinancialRollup,
      includeQuotes: includeQuotesRollup,
      upcomingHorizonDays: upcomingMaintenanceHorizonDays,
    }),
    aggregateRollupSlice(supabase, organizationId, customerIds, {
      includeFinancial: includeFinancialRollup,
      includeQuotes: includeQuotesRollup,
      upcomingHorizonDays: upcomingMaintenanceHorizonDays,
    }),
  ])

  return {
    ...empty,
    direct,
    withSubAccounts,
  }
}

/** Format cents as a compact currency string (no fractional cents). */
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
