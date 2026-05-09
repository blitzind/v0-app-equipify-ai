/**
 * AI Operational Assistant Phase 1 — deterministic rule set.
 *
 * Each rule is a `RuleFn` that reads existing tables, returns
 * candidate recommendations, and never mutates anything. The
 * orchestrator (`engine.ts`) handles permission filtering,
 * dismissal/snooze application, sorting, and pagination.
 *
 * Rules are intentionally narrow + cheap — every query has a
 * date / status filter and a small `limit`. The Phase 1 budget
 * is "one snappy /ai-ops dashboard load per session", not a
 * heavy analytical sweep.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "./types"
import type { OrgPermissions } from "@/lib/permissions/model"
import { filterFollowUpTasksForViewer } from "@/lib/follow-up-automation/filter-view"
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"

export type RuleContext = {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  /** Caller auth user — used for scoped queue counts (assigned technicians). */
  userId?: string
  /** UTC `Date` used for "now" — passed in for testability. */
  now: Date
}

export type RuleFn = (ctx: RuleContext) => Promise<Recommendation[]>

export type RuleDescriptor = {
  id: string
  category: RecommendationCategory
  /**
   * Capability required to surface this rule. `null` means
   * operational visibility (any org member). The orchestrator
   * silently drops the rule for users without this permission so
   * we don't 403 the entire dashboard.
   */
  requiresPermission: keyof OrgPermissions | null
  /**
   * If set, user needs **any** of these permissions (OR). Takes precedence
   * over `requiresPermission` when present (Phase 27 — billing viewers).
   */
  requiresAnyPermission?: (keyof OrgPermissions)[]
  fn: RuleFn
}

const DAY_MS = 24 * 60 * 60 * 1000
const RULE_LIMIT = 25

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString()
}
function dateDaysFromNow(now: Date, days: number): string {
  // YYYY-MM-DD slice (UTC) for `date` columns.
  return new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}
function dateToday(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS)
}

function dollarsFromCents(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "$0"
  const dollars = cents / 100
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`
  return `$${dollars.toFixed(0)}`
}

function priorityFromAge(days: number, hi = 14, mid = 5): RecommendationPriority {
  if (days >= hi) return "high"
  if (days >= mid) return "medium"
  return "low"
}

// ─── Rule: stale prospects ────────────────────────────────────────────────────

const staleProspect: RuleDescriptor = {
  id: "stale_prospect",
  category: "prospect",
  requiresPermission: "canManageProspects",
  fn: async ({ supabase, organizationId, now }) => {
    const overdueIso = now.toISOString()
    const noTouchSince = isoDaysAgo(now, 7)

    const { data, error } = await supabase
      .from("prospects")
      .select(
        "id, company_name, status, next_follow_up_at, last_contacted_at, created_at",
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .neq("status", "won")
      .neq("status", "lost")
      .or(
        `next_follow_up_at.lt.${overdueIso},and(last_contacted_at.is.null,created_at.lt.${noTouchSince})`,
      )
      .limit(RULE_LIMIT)

    if (error || !data) return []
    return data.map((row): Recommendation => {
      const id = row.id as string
      const company = (row.company_name as string) || "Prospect"
      const followUpAt = (row.next_follow_up_at as string | null) ?? null
      const lastTouch = (row.last_contacted_at as string | null) ?? null
      const anchor = followUpAt ?? lastTouch ?? (row.created_at as string)
      const days = anchor ? Math.max(0, diffDays(now, new Date(anchor))) : 0
      const priority = priorityFromAge(days, 14, 5)
      const reason = followUpAt
        ? `Follow-up was due ${days}d ago.`
        : lastTouch
          ? `No touch in ${days}d.`
          : `Created ${days}d ago with no follow-up scheduled.`
      return {
        key: `stale_prospect:${id}`,
        ruleId: "stale_prospect",
        category: "prospect",
        priority,
        confidence: "deterministic",
        title: `${company} hasn't been followed up`,
        explanation: `${reason} Status is "${row.status}". Send a quick email or note now to keep the deal alive.`,
        entity: {
          type: "prospect",
          id,
          label: company,
          href: `/prospects?open=${encodeURIComponent(id)}`,
        },
        actions: [
          { type: "view_prospect", label: "Open prospect", href: `/prospects?open=${encodeURIComponent(id)}` },
          { type: "draft_followup", label: "Draft follow-up", href: `/prospects?open=${encodeURIComponent(id)}&action=draft-followup` },
        ],
        anchorIso: anchor,
        metric: { label: "Days stale", value: `${days}d` },
      }
    })
  },
}

// ─── Rule: overdue invoices ───────────────────────────────────────────────────

const overdueInvoice: RuleDescriptor = {
  id: "overdue_invoice",
  category: "financial",
  requiresPermission: null,
  requiresAnyPermission: ["canViewFinancials", "canViewBilling"],
  fn: async ({ supabase, organizationId, now }) => {
    const today = dateToday(now)
    const { data, error } = await supabase
      .from("org_invoices")
      .select(
        "id, customer_id, invoice_number, title, amount_cents, status, due_date, issued_at",
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .neq("status", "paid")
      .neq("status", "void")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(RULE_LIMIT)

    if (error || !data) return []
    return data.map((row): Recommendation => {
      const id = row.id as string
      const due = row.due_date as string | null
      const days = due ? Math.max(0, diffDays(now, new Date(`${due}T00:00:00Z`))) : 0
      const amount = dollarsFromCents(row.amount_cents as number | null)
      const number = (row.invoice_number as string) || "Invoice"
      const priority: RecommendationPriority =
        days >= 30 ? "high" : days >= 7 ? "medium" : "low"
      return {
        key: `overdue_invoice:${id}`,
        ruleId: "overdue_invoice",
        category: "financial",
        priority,
        confidence: "deterministic",
        title: `Invoice ${number} is ${days}d overdue`,
        explanation: `Outstanding ${amount}. Send a polite reminder, attach the invoice PDF, or schedule a phone call.`,
        entity: {
          type: "invoice",
          id,
          label: number,
          href: `/invoices?open=${encodeURIComponent(id)}`,
        },
        actions: [
          { type: "view_invoice", label: "Open invoice", href: `/invoices?open=${encodeURIComponent(id)}` },
          {
            type: "open_communications_filtered",
            label: "View communications",
            href: `/communications?entityType=invoice&entityId=${encodeURIComponent(id)}`,
          },
        ],
        anchorIso: due ? `${due}T00:00:00Z` : null,
        metric: { label: "Outstanding", value: amount },
      }
    })
  },
}

// ─── Rule: unscheduled high-priority work orders ─────────────────────────────

const unscheduledHighPriorityWO: RuleDescriptor = {
  id: "unscheduled_priority_wo",
  category: "dispatch",
  requiresPermission: null,
  fn: async ({ supabase, organizationId, now }) => {
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, title, status, priority, scheduled_on, created_at, work_order_number")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", ["open"])
      .in("priority", ["high", "critical"])
      .is("scheduled_on", null)
      .order("created_at", { ascending: true })
      .limit(RULE_LIMIT)

    if (error || !data) return []
    return data.map((row): Recommendation => {
      const id = row.id as string
      const created = row.created_at as string
      const days = Math.max(0, diffDays(now, new Date(created)))
      const number = (row.work_order_number as string | null) ?? id.slice(0, 8)
      const priority: RecommendationPriority =
        row.priority === "critical" ? "high" : days >= 2 ? "high" : "medium"
      return {
        key: `unscheduled_priority_wo:${id}`,
        ruleId: "unscheduled_priority_wo",
        category: "dispatch",
        priority,
        confidence: "deterministic",
        title: `${row.priority === "critical" ? "Critical" : "High-priority"} work order unscheduled`,
        explanation: `${row.title}. Sitting in the open queue for ${days}d with no scheduled date — assign a technician and slot it on the dispatch board.`,
        entity: {
          type: "work_order",
          id,
          label: number,
          href: `/work-orders?open=${encodeURIComponent(id)}`,
        },
        actions: [
          { type: "view_work_order", label: "Open work order", href: `/work-orders?open=${encodeURIComponent(id)}` },
        ],
        anchorIso: created,
        metric: { label: "Waiting", value: `${days}d` },
      }
    })
  },
}

// ─── Rule: repeat repair risk (3+ repairs / 90d on same equipment) ───────────

const repeatRepairRisk: RuleDescriptor = {
  id: "repeat_repair_risk",
  category: "equipment",
  requiresPermission: null,
  fn: async ({ supabase, organizationId, now }) => {
    const since = isoDaysAgo(now, 90)
    const { data, error } = await supabase
      .from("work_orders")
      .select("equipment_id, type, completed_at, status")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("type", "repair")
      .gte("created_at", since)
      .limit(500)

    if (error || !data) return []
    const counts = new Map<string, number>()
    for (const row of data) {
      const id = (row.equipment_id as string | null) ?? null
      if (!id) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }

    const flagged = [...counts.entries()].filter(([, c]) => c >= 3).slice(0, RULE_LIMIT)
    if (flagged.length === 0) return []

    const ids = flagged.map(([id]) => id)
    const { data: eq } = await supabase
      .from("equipment")
      .select("id, name, equipment_code, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("id", ids)
    const labelById = new Map<string, { label: string; customerId: string }>()
    for (const e of eq ?? []) {
      labelById.set(e.id as string, {
        label: ((e.name as string) || (e.equipment_code as string) || "Equipment").slice(0, 80),
        customerId: e.customer_id as string,
      })
    }

    return flagged.map(([id, count]): Recommendation => {
      const meta = labelById.get(id)
      const priority: RecommendationPriority = count >= 5 ? "high" : "medium"
      return {
        key: `repeat_repair_risk:${id}`,
        ruleId: "repeat_repair_risk",
        category: "equipment",
        priority,
        confidence: "deterministic",
        title: `${meta?.label ?? "Equipment"} keeps coming back`,
        explanation: `${count} repair work orders on this asset in the last 90 days. Consider a proactive PM, replacement quote, or upsell conversation with the customer.`,
        entity: meta
          ? {
              type: "equipment",
              id,
              label: meta.label,
              href: `/equipment/${encodeURIComponent(id)}`,
            }
          : null,
        actions: [
          { type: "view_equipment", label: "Open equipment", href: `/equipment/${encodeURIComponent(id)}` },
        ],
        anchorIso: null,
        metric: { label: "Repairs / 90d", value: `${count}` },
      }
    })
  },
}

// ─── Rule: certificates pending portal release ───────────────────────────────

const certReleasePending: RuleDescriptor = {
  id: "certificate_release_pending",
  category: "certificate",
  requiresPermission: "canReleaseCertificatesToPortal",
  fn: async ({ supabase, organizationId, now }) => {
    const since = isoDaysAgo(now, 30)
    const { data, error } = await supabase
      .from("calibration_records")
      .select("id, work_order_id, created_at, portal_released_at")
      .eq("organization_id", organizationId)
      .is("portal_released_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(RULE_LIMIT)

    if (error || !data) return []
    return data.map((row): Recommendation => {
      const id = row.id as string
      const wo = (row.work_order_id as string) || ""
      const created = row.created_at as string
      const days = Math.max(0, diffDays(now, new Date(created)))
      const priority = priorityFromAge(days, 14, 5)
      return {
        key: `certificate_release_pending:${id}`,
        ruleId: "certificate_release_pending",
        category: "certificate",
        priority,
        confidence: "deterministic",
        title: `Certificate awaiting portal release`,
        explanation: `Created ${days}d ago. Verify the calibration data and release it to the customer portal so they can download the document.`,
        entity: {
          type: "calibration_record",
          id,
          label: wo ? "Work order certificate" : "Certificate",
          href: wo ? `/work-orders?open=${encodeURIComponent(wo)}` : `/work-orders`,
        },
        actions: wo
          ? [
              {
                type: "view_work_order",
                label: "Open work order",
                href: `/work-orders?open=${encodeURIComponent(wo)}`,
              },
            ]
          : [],
        anchorIso: created,
        metric: { label: "Pending", value: `${days}d` },
      }
    })
  },
}

// ─── Rule: low stock against reorder threshold ───────────────────────────────

const lowStock: RuleDescriptor = {
  id: "low_stock",
  category: "inventory",
  requiresPermission: "canManageInventory",
  fn: async ({ supabase, organizationId }) => {
    const { data, error } = await supabase
      .from("inventory_stock")
      .select(
        "id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point",
      )
      .eq("organization_id", organizationId)
      .not("reorder_point", "is", null)
      .limit(200)

    if (error || !data) return []
    const flagged = data
      .filter((row) => {
        const onHand = Number(row.quantity_on_hand as number | string)
        const allocated = Number(row.quantity_allocated as number | string)
        const reorder = Number(row.reorder_point as number | string)
        const available = onHand - allocated
        return Number.isFinite(reorder) && reorder > 0 && available <= reorder
      })
      .slice(0, RULE_LIMIT)
    if (flagged.length === 0) return []

    const itemIds = [...new Set(flagged.map((r) => r.catalog_item_id as string))]
    const { data: items } = await supabase
      .from("catalog_items")
      .select("id, name, sku, manufacturer_part_number")
      .in("id", itemIds)
    const labelById = new Map<string, string>()
    for (const it of items ?? []) {
      labelById.set(
        it.id as string,
        ((it.name as string) || (it.sku as string) || "Part").slice(0, 80),
      )
    }

    return flagged.map((row): Recommendation => {
      const id = row.id as string
      const onHand = Number(row.quantity_on_hand as number | string)
      const allocated = Number(row.quantity_allocated as number | string)
      const reorder = Number(row.reorder_point as number | string)
      const available = Math.max(0, onHand - allocated)
      const label = labelById.get(row.catalog_item_id as string) ?? "Part"
      const priority: RecommendationPriority =
        available === 0 ? "high" : available <= reorder / 2 ? "medium" : "low"
      return {
        key: `low_stock:${id}`,
        ruleId: "low_stock",
        category: "inventory",
        priority,
        confidence: "deterministic",
        title: `${label} stock is low`,
        explanation: `${available} available vs reorder threshold of ${reorder}. Place a restock order or pull stock from another location before it hits zero.`,
        entity: {
          type: "inventory_stock",
          id,
          label,
          href: `/inventory`,
        },
        actions: [
          { type: "view_inventory", label: "Open inventory", href: `/inventory` },
        ],
        anchorIso: null,
        metric: { label: "Available", value: `${available}` },
      }
    })
  },
}

// ─── Rule: failed communications in last 14 days ─────────────────────────────

const failedCommunications: RuleDescriptor = {
  id: "failed_communication",
  category: "communications",
  requiresPermission: "canManageCommunications",
  fn: async ({ supabase, organizationId, now }) => {
    const since = isoDaysAgo(now, 14)
    const { data, error } = await supabase
      .from("communication_events")
      .select(
        "id, title, event_type, delivery_status, recipient_address, related_entity_type, related_entity_id, error_message, failed_at, created_at",
      )
      .eq("organization_id", organizationId)
      .in("delivery_status", ["failed", "bounced"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(RULE_LIMIT)

    if (error || !data) return []
    return data.map((row): Recommendation => {
      const id = row.id as string
      const title = (row.title as string) || "Communication"
      const status = (row.delivery_status as string) || "failed"
      const reason = (row.error_message as string | null) ?? null
      return {
        key: `failed_communication:${id}`,
        ruleId: "failed_communication",
        category: "communications",
        priority: status === "bounced" ? "medium" : "medium",
        confidence: "deterministic",
        title: `${title} ${status === "bounced" ? "bounced" : "failed to send"}`,
        explanation: reason
          ? `Reason: ${reason}. Open the Communications drawer to retry or fix the recipient address.`
          : `Open the Communications drawer to retry or check the recipient address.`,
        entity: {
          type: "communication_event",
          id,
          label: title,
          href: `/communications?focus=${encodeURIComponent(id)}`,
        },
        actions: [
          { type: "view_communications", label: "Open in Communications", href: `/communications?focus=${encodeURIComponent(id)}` },
        ],
        anchorIso: (row.failed_at as string | null) ?? (row.created_at as string),
        metric: { label: "Status", value: status },
      }
    })
  },
}

// ─── Rule: workflow automation failure burst ─────────────────────────────────

const automationFailureBurst: RuleDescriptor = {
  id: "automation_failure_burst",
  category: "automation",
  requiresPermission: "canManageAutomations",
  fn: async ({ supabase, organizationId, now }) => {
    const since = isoDaysAgo(now, 14)
    const { data: runs, error } = await supabase
      .from("workflow_runs")
      .select("automation_id, status, started_at, error_message")
      .eq("organization_id", organizationId)
      .eq("status", "failed")
      .gte("started_at", since)
      .limit(500)

    if (error || !runs) return []
    type Bucket = { count: number; lastError: string | null; lastAt: string }
    const grouped = new Map<string, Bucket>()
    for (const r of runs) {
      const id = r.automation_id as string
      const existing = grouped.get(id) ?? { count: 0, lastError: null, lastAt: r.started_at as string }
      existing.count += 1
      if (!existing.lastError && r.error_message) existing.lastError = r.error_message as string
      const startedAt = r.started_at as string
      if (startedAt > existing.lastAt) existing.lastAt = startedAt
      grouped.set(id, existing)
    }

    const flagged = [...grouped.entries()].filter(([, b]) => b.count >= 3).slice(0, RULE_LIMIT)
    if (flagged.length === 0) return []

    const automationIds = flagged.map(([id]) => id)
    const { data: autos } = await supabase
      .from("workflow_automations")
      .select("id, name, trigger_type, enabled")
      .in("id", automationIds)
    const metaById = new Map<string, { label: string; trigger: string; enabled: boolean }>()
    for (const a of autos ?? []) {
      metaById.set(a.id as string, {
        label: (a.name as string) || "Automation",
        trigger: (a.trigger_type as string) || "—",
        enabled: Boolean(a.enabled),
      })
    }

    return flagged.map(([id, bucket]): Recommendation => {
      const meta = metaById.get(id)
      const priority: RecommendationPriority = bucket.count >= 10 ? "high" : "medium"
      return {
        key: `automation_failure_burst:${id}`,
        ruleId: "automation_failure_burst",
        category: "automation",
        priority,
        confidence: "deterministic",
        title: `${meta?.label ?? "Automation"} failed ${bucket.count}× in 14d`,
        explanation: `Trigger: ${meta?.trigger ?? "—"}. ${
          bucket.lastError
            ? `Last error: ${bucket.lastError}.`
            : "No detail captured."
        } Open the automation to fix conditions or pause it.`,
        entity: {
          type: "workflow_automation",
          id,
          label: meta?.label ?? "Automation",
          href: `/settings/automations`,
        },
        actions: [
          { type: "view_automation", label: "Open automation", href: `/settings/automations` },
        ],
        anchorIso: bucket.lastAt,
        metric: { label: "Failures / 14d", value: `${bucket.count}` },
      }
    })
  },
}

// ─── Rule: maintenance / calibration due in next 7 days ──────────────────────

const maintenanceDueSoon: RuleDescriptor = {
  id: "maintenance_due_soon",
  category: "maintenance",
  requiresPermission: null,
  fn: async ({ supabase, organizationId, now }) => {
    const today = dateToday(now)
    const horizon = dateDaysFromNow(now, 7)
    const { data, error } = await supabase
      .from("equipment")
      .select("id, name, equipment_code, next_calibration_due_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .gte("next_calibration_due_at", today)
      .lte("next_calibration_due_at", horizon)
      .order("next_calibration_due_at", { ascending: true })
      .limit(RULE_LIMIT)

    if (error || !data) return []
    return data.map((row): Recommendation => {
      const id = row.id as string
      const due = row.next_calibration_due_at as string
      const days = Math.max(0, diffDays(new Date(`${due}T00:00:00Z`), now))
      const label =
        ((row.name as string) || (row.equipment_code as string) || "Equipment").slice(0, 80)
      const priority: RecommendationPriority =
        days <= 1 ? "high" : days <= 3 ? "medium" : "low"
      return {
        key: `maintenance_due_soon:${id}`,
        ruleId: "maintenance_due_soon",
        category: "maintenance",
        priority,
        confidence: "deterministic",
        title: `${label} is due for calibration`,
        explanation: `Calibration due in ${days}d (${due}). Schedule a PM work order so it doesn't slip past the due date.`,
        entity: {
          type: "equipment",
          id,
          label,
          href: `/equipment/${encodeURIComponent(id)}`,
        },
        actions: [
          { type: "view_equipment", label: "Open equipment", href: `/equipment/${encodeURIComponent(id)}` },
        ],
        anchorIso: `${due}T00:00:00Z`,
        metric: { label: "Due in", value: `${days}d` },
      }
    })
  },
}

// ─── Follow-up queue backlog (scoped for assigned technicians) ───────────────

const followUpQueuePressure: RuleDescriptor = {
  id: "follow_up_queue_pressure",
  category: "communications",
  requiresPermission: "canViewCommunications",
  fn: async ({ supabase, organizationId, permissions, userId }) => {
    const { data, error } = await supabase
      .from("follow_up_tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(400)

    if (error || !data) return []
    let rows = data as FollowUpTaskRow[]
    if (userId) {
      rows = filterFollowUpTasksForViewer(rows, permissions, userId)
    }
    const count = rows.length
    if (count < 4) return []

    const priority: RecommendationPriority =
      count >= 15 ? "high" : count >= 8 ? "medium" : "low"

    return [
      {
        key: `follow_up_queue_pressure:${organizationId}`,
        ruleId: "follow_up_queue_pressure",
        category: "communications",
        priority,
        confidence: "deterministic",
        title: `${count} follow-up tasks need review`,
        explanation:
          "Pending or approved items in the follow-up queue need human review before anything sends.",
        entity: null,
        actions: [
          {
            type: "view_communications",
            label: "Open follow-up queue",
            href: `/communications/follow-ups`,
          },
        ],
        anchorIso: null,
        metric: { label: "Open tasks", value: String(count) },
        insightTheme: "follow_up_risk",
        sourceSignals: [`follow_up_tasks_open:${count}`],
        suggestedNextStep:
          "Review the queue, approve drafts you trust, or dismiss stale suggestions.",
        sourceModule: "Communications",
      },
    ]
  },
}

// ─── Warranty window (equipment) ───────────────────────────────────────────

const warrantyExpiringWindow: RuleDescriptor = {
  id: "warranty_expiring_window",
  category: "equipment",
  requiresPermission: null,
  fn: async ({ supabase, organizationId, now }) => {
    const today = dateToday(now)
    const horizon = dateDaysFromNow(now, 21)
    const { data, error } = await supabase
      .from("equipment")
      .select("id, name, equipment_code, warranty_expiration_date, warranty_expires_at, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .limit(250)

    if (error || !data) return []
    const rows = data
      .filter((row) => {
        const end =
          (row.warranty_expiration_date as string | null) ??
          (row.warranty_expires_at as string | null) ??
          null
        if (!end) return false
        return end >= today && end <= horizon
      })
      .slice(0, RULE_LIMIT)

    return rows.map((row): Recommendation => {
      const id = row.id as string
      const label = ((row.name as string) || (row.equipment_code as string) || "Equipment").slice(
        0,
        80,
      )
      const end =
        (row.warranty_expiration_date as string | null) ??
        (row.warranty_expires_at as string | null) ??
        ""
      const days = Math.max(0, diffDays(new Date(`${end}T00:00:00Z`), now))
      return {
        key: `warranty_expiring_window:${id}`,
        ruleId: "warranty_expiring_window",
        category: "equipment",
        priority: days <= 7 ? "high" : days <= 14 ? "medium" : "low",
        confidence: "deterministic",
        title: `Warranty ending soon on ${label}`,
        explanation: `Coverage ends ${end} (${days}d). Offer renewal, extended PM, or replacement planning before it lapses.`,
        entity: {
          type: "equipment",
          id,
          label,
          href: `/equipment/${encodeURIComponent(id)}`,
        },
        actions: [
          {
            type: "view_equipment",
            label: "Open equipment",
            href: `/equipment/${encodeURIComponent(id)}`,
          },
        ],
        anchorIso: `${end}T00:00:00Z`,
        metric: { label: "Ends", value: end },
        insightTheme: "warranty_window",
        sourceSignals: [`warranty_end:${end}`],
        suggestedNextStep:
          "Contact the customer with renewal or PM options before coverage ends.",
        sourceModule: "Equipment",
      }
    })
  },
}

// ─── Technician capacity vs unscheduled backlog ────────────────────────────────

const techCapacityPressure: RuleDescriptor = {
  id: "tech_capacity_pressure",
  category: "dispatch",
  requiresPermission: null,
  fn: async ({ supabase, organizationId }) => {
    const { count: techCount, error: e1 } = await supabase
      .from("technicians")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("operational_status", "active")

    const { count: backlog, error: e2 } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", ["open"])
      .is("scheduled_on", null)

    if (e1 || e2 || techCount == null || backlog == null) return []
    if (techCount < 1) return []
    const pressure = backlog / techCount
    if (backlog < 8 && pressure < 6) return []

    const priority: RecommendationPriority =
      pressure >= 10 || backlog >= 25 ? "high" : "medium"

    return [
      {
        key: `tech_capacity_pressure:${organizationId}`,
        ruleId: "tech_capacity_pressure",
        category: "dispatch",
        priority,
        confidence: "deterministic",
        title: `Dispatch backlog may exceed technician capacity`,
        explanation: `${backlog} open work orders have no scheduled date across ${techCount} active technician${
          techCount === 1 ? "" : "s"
        } (~${pressure.toFixed(1)} unscheduled WO per tech). Consider hiring, overtime, or reprioritizing.`,
        entity: null,
        actions: [
          { type: "view_work_orders_board", label: "Open work orders", href: `/work-orders` },
        ],
        anchorIso: null,
        metric: { label: "Unscheduled / tech", value: `${pressure.toFixed(1)}` },
        insightTheme: "capacity_risk",
        sourceSignals: [`open_unscheduled:${backlog}`, `active_technicians:${techCount}`],
        suggestedNextStep: "Rebalance the schedule or add capacity before SLAs slip.",
        sourceModule: "Dispatch",
      },
    ]
  },
}

// ─── Calibration due without maintenance plan (upsell / gap) ─────────────────

const maintenancePlanGap: RuleDescriptor = {
  id: "maintenance_plan_gap",
  category: "maintenance",
  requiresPermission: null,
  fn: async ({ supabase, organizationId, now }) => {
    const start = dateDaysFromNow(now, 8)
    const end = dateDaysFromNow(now, 30)
    const { data: equip, error } = await supabase
      .from("equipment")
      .select("id, name, equipment_code, customer_id, next_calibration_due_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .gte("next_calibration_due_at", start)
      .lte("next_calibration_due_at", end)
      .order("next_calibration_due_at", { ascending: true })
      .limit(40)

    if (error || !equip?.length) return []
    const ids = equip.map((e) => e.id as string)
    const { data: plans } = await supabase
      .from("maintenance_plans")
      .select("equipment_id")
      .eq("organization_id", organizationId)
      .in("equipment_id", ids)
      .eq("status", "active")
      .is("archived_at", null)

    const covered = new Set((plans ?? []).map((p) => p.equipment_id as string))

    return equip
      .filter((e) => !covered.has(e.id as string))
      .slice(0, RULE_LIMIT)
      .map((row): Recommendation => {
        const id = row.id as string
        const due = row.next_calibration_due_at as string
        const label = ((row.name as string) || (row.equipment_code as string) || "Equipment").slice(
          0,
          80,
        )
        const days = Math.max(0, diffDays(new Date(`${due}T00:00:00Z`), now))
        return {
          key: `maintenance_plan_gap:${id}`,
          ruleId: "maintenance_plan_gap",
          category: "maintenance",
          priority: days <= 14 ? "medium" : "low",
          confidence: "deterministic",
          title: `No PM plan for equipment due soon`,
          explanation: `${label} has calibration due ${due} but no active maintenance plan. Attach a plan or book service to avoid gaps.`,
          entity: {
            type: "equipment",
            id,
            label,
            href: `/equipment/${encodeURIComponent(id)}`,
          },
          actions: [
            {
              type: "view_equipment",
              label: "Open equipment",
              href: `/equipment/${encodeURIComponent(id)}`,
            },
            {
              type: "view_maintenance_plans",
              label: "Maintenance plans",
              href: `/maintenance-plans`,
            },
          ],
          anchorIso: `${due}T00:00:00Z`,
          metric: { label: "Due", value: due },
          insightTheme: "maintenance_upsell",
          sourceSignals: [`next_calibration_due:${due}`, "no_active_maintenance_plan"],
          suggestedNextStep:
            "Create or attach a preventive maintenance plan before the due date.",
          sourceModule: "Maintenance",
        }
      })
  },
}

export const RULES: RuleDescriptor[] = [
  staleProspect,
  overdueInvoice,
  unscheduledHighPriorityWO,
  repeatRepairRisk,
  certReleasePending,
  lowStock,
  failedCommunications,
  automationFailureBurst,
  maintenanceDueSoon,
  followUpQueuePressure,
  warrantyExpiringWindow,
  techCapacityPressure,
  maintenancePlanGap,
]
