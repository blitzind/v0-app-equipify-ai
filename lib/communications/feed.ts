/**
 * Communications Center Phase 1 — read-side aggregation layer.
 *
 * Pure helpers that wrap the existing `communication_events` table.
 * The Communications Center pages, embedded "Recent communications"
 * sections, and the API route share these helpers so the rules for
 * filtering, entity resolution, preview text, and stats stay in
 * lockstep.
 *
 * No I/O happens here at module import time. Functions accept a
 * Supabase client passed in by the caller (server route or RSC).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CommunicationDeliveryStatus,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationEventRow,
  RelatedEntityType,
} from "@/lib/notifications/types"
import {
  type CommunicationCenterKind,
  deriveCommunicationCenterKind,
} from "@/lib/communications/communication-kind"
import { communicationEventInAssignedScope } from "@/lib/communications/feed-scope"
import type { AssignedWorkScope } from "@/lib/permissions/technician-scope"

export type FeedFilters = {
  search?: string | null
  channel?: CommunicationChannel | "all" | null
  status?: CommunicationDeliveryStatus | "simulated" | "draft" | "all" | null
  entityType?: RelatedEntityType | "all" | null
  /** ISO YYYY-MM-DD start (inclusive). */
  fromDate?: string | null
  /** ISO YYYY-MM-DD end (inclusive). */
  toDate?: string | null
  /** Restrict to events flagged automated/AI in metadata. */
  automatedOnly?: boolean | null
  /** Optional explicit related-entity filter (used by embedded recent panels). */
  entityId?: string | null
  /** Restrict to events tied to a customer (recent-communications card). */
  customerId?: string | null
  direction?: CommunicationDirection | "all" | null
  /** Phase 28 — coarse category derived server-side. */
  communicationKind?: CommunicationCenterKind | "all" | null
  /** Phase 28 — AI-assisted vs human-created heuristics. */
  aiSource?: "ai" | "manual" | "all" | null
  /** Phase 28 — filter rows where user created OR is recipient user. */
  assignedUserId?: string | null
  limit?: number | null
  /** ISO timestamp cursor for "load more". */
  beforeCreatedAt?: string | null
}

export type FeedItem = CommunicationEventRow & {
  /** Resolved entity label suitable for display, e.g. "INV-1024" or "Acme Industrial". */
  entity_label: string | null
  /** Deep-link href for the related entity (no raw UUIDs in UI). */
  entity_href: string | null
  /** Customer label resolved from `recipient_customer_id` when present. */
  customer_label: string | null
  /** Customer href, if available. */
  customer_href: string | null
  /** Coarse category for filter chips: "billing" | "operations" | "marketing" | "system". */
  category: FeedCategory
  /** True when this event was triggered by a workflow / AI / scheduled system. */
  automated: boolean
  /** Phase 28 — derived communication category for filters + labels. */
  communication_kind: CommunicationCenterKind
}

export type FeedCategory = "billing" | "operations" | "marketing" | "system"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const UUID_LENIENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Whether the caller can see financial-channel communications.
 * Consumers pass a precomputed boolean (we don't import server-only
 * permission helpers here so the module stays universal).
 */
export type FeedAccessHints = {
  canSeeFinancials: boolean
  /**
   * Phase 28 — when set (assigned-work-only technicians), only surface events
   * tied to scoped work orders / equipment / customers.
   */
  assignedWorkScope?: AssignedWorkScope | null
}

export async function loadCommunicationFeed(args: {
  supabase: SupabaseClient
  organizationId: string
  filters: FeedFilters
  access: FeedAccessHints
}): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const { supabase, organizationId, filters, access } = args
  const limit = clampLimit(filters.limit)

  let query = supabase
    .from("communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (filters.beforeCreatedAt) query = query.lt("created_at", filters.beforeCreatedAt)
  if (filters.channel && filters.channel !== "all") query = query.eq("channel", filters.channel)
  if (filters.entityType && filters.entityType !== "all") query = query.eq("related_entity_type", filters.entityType)
  if (filters.entityId) query = query.eq("related_entity_id", filters.entityId)
  if (filters.customerId) query = query.eq("recipient_customer_id", filters.customerId)
  if (filters.direction && filters.direction !== "all") {
    query = query.eq("direction", filters.direction)
  }
  if (filters.fromDate) query = query.gte("created_at", `${filters.fromDate}T00:00:00.000Z`)
  if (filters.toDate) query = query.lte("created_at", `${filters.toDate}T23:59:59.999Z`)
  if (filters.status && filters.status !== "all") {
    if (filters.status === "draft" || filters.status === "simulated") {
      // Synthetic states we surface from metadata; engine status remains
      // 'pending' / 'queued' for these. We over-fetch and then filter in
      // memory for these two so the engine column doesn't need to grow.
    } else {
      query = query.eq("delivery_status", filters.status)
    }
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rowsRaw = (data ?? []) as CommunicationEventRow[]
  let rows = rowsRaw

  if (access.assignedWorkScope) {
    const scope = access.assignedWorkScope
    if (!scope.workOrderIds.length) {
      return { items: [], nextCursor: null }
    }
    rows = rows.filter((r) => communicationEventInAssignedScope(r, scope))
  }

  // Server-side text search across title/summary/recipient_address. We
  // do this in JS to avoid bringing in a tsvector index for Phase 1; the
  // page paginates so the working set stays bounded. (Phase 2 swap to
  // FTS once the volumes warrant it.)
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    rows = rows.filter((r) => rowMatchesSearch(r, q))
  }
  if (filters.automatedOnly) {
    rows = rows.filter(isAutomatedRow)
  }
  if (filters.status === "draft") {
    rows = rows.filter((r) => isDraftRow(r))
  } else if (filters.status === "simulated") {
    rows = rows.filter((r) => isSimulatedRow(r))
  }
  // Hide finance-only rows from techs / unauthorized roles.
  if (!access.canSeeFinancials) {
    rows = rows.filter((r) => !isFinancialRow(r))
  }

  if (filters.communicationKind && filters.communicationKind !== "all") {
    const want = filters.communicationKind
    rows = rows.filter((r) => deriveCommunicationCenterKind(r) === want)
  }

  if (filters.aiSource === "ai") {
    rows = rows.filter((r) => isAiGeneratedRow(r))
  } else if (filters.aiSource === "manual") {
    rows = rows.filter((r) => !isAiGeneratedRow(r))
  }

  if (filters.assignedUserId && UUID_LENIENT.test(filters.assignedUserId)) {
    const uid = filters.assignedUserId
    rows = rows.filter(
      (r) => r.created_by === uid || r.recipient_user_id === uid,
    )
  }

  const trimmed = rows.slice(0, limit)
  const nextCursor =
    rows.length > limit ? rows[rows.length - 1]?.created_at ?? null : null

  const enriched = await enrichRows(supabase, organizationId, trimmed)
  return { items: enriched, nextCursor }
}

function clampLimit(raw: number | null | undefined): number {
  if (!raw || !Number.isFinite(raw)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(raw)))
}

function rowMatchesSearch(r: CommunicationEventRow, q: string): boolean {
  if (r.title.toLowerCase().includes(q)) return true
  if (r.summary?.toLowerCase().includes(q)) return true
  if (r.body?.toLowerCase().includes(q)) return true
  if (r.recipient_address?.toLowerCase().includes(q)) return true
  if (r.event_type.toLowerCase().includes(q)) return true
  return false
}

export function isAutomatedRow(r: CommunicationEventRow): boolean {
  if (r.event_type === "workflow_automation") return true
  if (r.event_type === "workflow_email") return true
  if (r.scheduled_reminder_key) return true
  const md = r.metadata as Record<string, unknown> | null
  if (md && typeof md === "object") {
    if (md.automation_id || md.workflow_run_id) return true
    if (md.ai_generated === true) return true
  }
  return false
}

export function isAiGeneratedRow(r: CommunicationEventRow): boolean {
  if (r.event_type.startsWith("prospect_ai_") || r.event_type.startsWith("ai_")) return true
  const md = r.metadata as Record<string, unknown> | null
  return Boolean(md && typeof md === "object" && md.ai_generated === true)
}

export function isDraftRow(r: CommunicationEventRow): boolean {
  if (r.event_type.includes("draft")) return true
  const md = r.metadata as Record<string, unknown> | null
  return Boolean(md && typeof md === "object" && md.is_draft === true)
}

export function isSimulatedRow(r: CommunicationEventRow): boolean {
  const md = r.metadata as Record<string, unknown> | null
  return Boolean(md && typeof md === "object" && (md.simulated === true || md.test === true))
}

const FINANCIAL_EVENT_TYPES = new Set([
  "invoice_email",
  "invoice_reminder",
  "quote_email",
  "quote_follow_up",
  "invoice_payment_recorded",
  "invoice_overdue_notice",
])

export function isFinancialRow(r: CommunicationEventRow): boolean {
  if (FINANCIAL_EVENT_TYPES.has(r.event_type)) return true
  if (r.related_entity_type === "invoice" || r.related_entity_type === "quote") return true
  return false
}

export function categorizeRow(r: CommunicationEventRow): FeedCategory {
  if (isFinancialRow(r)) return "billing"
  if (r.event_type.startsWith("prospect_")) return "marketing"
  if (r.event_type === "workflow_automation" || r.channel === "system") return "system"
  return "operations"
}

// ─── Entity + customer resolution ──────────────────────────────────

const ENTITY_HREF_BY_TYPE: Partial<Record<RelatedEntityType, (id: string) => string>> = {
  work_order: (id) => `/work-orders?open=${encodeURIComponent(id)}`,
  quote: (id) => `/quotes?open=${encodeURIComponent(id)}`,
  invoice: (id) => `/invoices?open=${encodeURIComponent(id)}`,
  maintenance_plan: (id) => `/maintenance-plans?open=${encodeURIComponent(id)}`,
  customer: (id) => `/customers/${encodeURIComponent(id)}`,
  equipment: (id) => `/equipment/${encodeURIComponent(id)}`,
  prospect: (id) => `/prospects?open=${encodeURIComponent(id)}`,
}

async function enrichRows(
  supabase: SupabaseClient,
  organizationId: string,
  rows: CommunicationEventRow[],
): Promise<FeedItem[]> {
  if (rows.length === 0) return []

  const idsByType = new Map<RelatedEntityType, Set<string>>()
  const customerIds = new Set<string>()
  for (const r of rows) {
    if (r.related_entity_id && r.related_entity_type) {
      const set = idsByType.get(r.related_entity_type) ?? new Set<string>()
      set.add(r.related_entity_id)
      idsByType.set(r.related_entity_type, set)
    }
    if (r.recipient_customer_id) customerIds.add(r.recipient_customer_id)
  }

  const labels = new Map<string, string>() // `${type}:${id}` → label
  await Promise.all([
    resolveType(supabase, organizationId, idsByType.get("work_order"), "work_orders", labels, "work_order", workOrderRowToLabel),
    resolveType(supabase, organizationId, idsByType.get("invoice"), "org_invoices", labels, "invoice", invoiceRowToLabel),
    resolveType(supabase, organizationId, idsByType.get("quote"), "org_quotes", labels, "quote", quoteRowToLabel),
    resolveType(supabase, organizationId, idsByType.get("customer"), "customers", labels, "customer", customerRowToLabel),
    resolveType(supabase, organizationId, idsByType.get("prospect"), "prospects", labels, "prospect", prospectRowToLabel),
    resolveType(supabase, organizationId, idsByType.get("equipment"), "equipment", labels, "equipment", equipmentRowToLabel),
    resolveType(supabase, organizationId, idsByType.get("maintenance_plan"), "maintenance_plans", labels, "maintenance_plan", mpRowToLabel),
    resolveCustomers(supabase, organizationId, customerIds, labels),
  ])

  return rows.map((r) => {
    const entityKey = r.related_entity_id && r.related_entity_type ? `${r.related_entity_type}:${r.related_entity_id}` : null
    const customerKey = r.recipient_customer_id ? `customer:${r.recipient_customer_id}` : null
    const entityLabel = entityKey ? labels.get(entityKey) ?? null : null
    const customerLabel = customerKey ? labels.get(customerKey) ?? null : null
    const hrefBuilder = r.related_entity_type ? ENTITY_HREF_BY_TYPE[r.related_entity_type] : null
    const entityHref = r.related_entity_id && hrefBuilder ? hrefBuilder(r.related_entity_id) : null
    const customerHref = r.recipient_customer_id ? `/customers/${encodeURIComponent(r.recipient_customer_id)}` : null
    return {
      ...r,
      entity_label: entityLabel,
      entity_href: entityHref,
      customer_label: customerLabel,
      customer_href: customerHref,
      category: categorizeRow(r),
      automated: isAutomatedRow(r),
      communication_kind: deriveCommunicationCenterKind(r),
    }
  })
}

async function resolveType<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  organizationId: string,
  ids: Set<string> | undefined,
  table: string,
  labels: Map<string, string>,
  type: RelatedEntityType,
  toLabel: (row: T) => string | null,
) {
  if (!ids || ids.size === 0) return
  // We always include `id` and any helpful display columns. Postgres
  // tolerates extra column projections per table; we keep the projection
  // narrow so RLS-friendly columns are returned.
  const cols = labelColumnsByTable(table)
  const { data } = await supabase
    .from(table)
    .select(cols)
    .eq("organization_id", organizationId)
    .in("id", Array.from(ids))
  for (const row of (data ?? []) as unknown as T[]) {
    const id = String(row.id)
    const label = toLabel(row) ?? null
    if (label) labels.set(`${type}:${id}`, label)
  }
}

async function resolveCustomers(
  supabase: SupabaseClient,
  organizationId: string,
  ids: Set<string>,
  labels: Map<string, string>,
) {
  if (ids.size === 0) return
  const { data } = await supabase
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", organizationId)
    .in("id", Array.from(ids))
  for (const row of (data ?? []) as Array<{ id: string; company_name?: string | null }>) {
    const name = row.company_name?.trim()
    if (name) labels.set(`customer:${row.id}`, name)
  }
}

function labelColumnsByTable(table: string): string {
  switch (table) {
    case "work_orders":
      return "id, work_order_number, title"
    case "org_invoices":
      return "id, invoice_number, customer_id"
    case "org_quotes":
      return "id, quote_number, customer_id"
    case "customers":
      return "id, company_name"
    case "prospects":
      return "id, company_name"
    case "equipment":
      return "id, name"
    case "maintenance_plans":
      return "id, name"
    default:
      return "id"
  }
}

function workOrderRowToLabel(r: Record<string, unknown>): string | null {
  const num = r.work_order_number as string | null
  const title = r.title as string | null
  if (num && title) return `${num} · ${title}`
  if (num) return num
  return title ?? null
}
function invoiceRowToLabel(r: Record<string, unknown>): string | null {
  const num = r.invoice_number as string | null
  return num ?? null
}
function quoteRowToLabel(r: Record<string, unknown>): string | null {
  const num = r.quote_number as string | null
  return num ?? null
}
function customerRowToLabel(r: Record<string, unknown>): string | null {
  return (r.company_name as string | null) ?? null
}
function prospectRowToLabel(r: Record<string, unknown>): string | null {
  return (r.company_name as string | null) ?? null
}
function equipmentRowToLabel(r: Record<string, unknown>): string | null {
  return (r.name as string | null) ?? null
}
function mpRowToLabel(r: Record<string, unknown>): string | null {
  return (r.name as string | null) ?? null
}

// ─── Stats ─────────────────────────────────────────────────────────

export type FeedStats = {
  sentToday: number
  failed: number
  queued: number
  automated: number
  prospectFollowUps: number
  total: number
}

/**
 * Computes Phase 1 KPI counts for the hero strip. Cheap because we
 * already pull bounded rows for the list; if the consumer wants stats
 * over a wider window we can run a dedicated count query later.
 */
export function summarizeCommunicationStats(items: FeedItem[]): FeedStats {
  const todayPrefix = new Date().toISOString().slice(0, 10)
  let sentToday = 0
  let failed = 0
  let queued = 0
  let automated = 0
  let prospectFollowUps = 0
  for (const r of items) {
    if (r.delivery_status === "failed" || r.delivery_status === "bounced") failed += 1
    if (r.delivery_status === "queued" || r.delivery_status === "pending") queued += 1
    if (
      (r.delivery_status === "sent" || r.delivery_status === "delivered") &&
      r.created_at.startsWith(todayPrefix)
    ) {
      sentToday += 1
    }
    if (r.automated) automated += 1
    if (r.event_type.startsWith("prospect_") || r.related_entity_type === "prospect") {
      prospectFollowUps += 1
    }
  }
  return { sentToday, failed, queued, automated, prospectFollowUps, total: items.length }
}

// ─── Preview snippet helpers ───────────────────────────────────────

export function buildCommunicationPreview(item: FeedItem): string {
  const parts: string[] = []
  if (item.summary) parts.push(item.summary.trim())
  else if (item.body) parts.push(item.body.trim())
  if (parts.length === 0 && item.recipient_address) {
    parts.push(`To ${item.recipient_address}`)
  }
  return parts.join(" — ").slice(0, 220)
}
