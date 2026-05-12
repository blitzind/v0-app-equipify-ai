import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { getPreparedWorkspaceActionDefinition, canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { ParsedBulkInvoiceDateRange } from "@/lib/aiden/actions/resolvers/bulk-invoice-date-range"
import type {
  BulkInvoiceCompletedWorkOrderPreviewItem,
  BulkInvoiceCompletedWorkOrdersPreview,
  BulkInvoiceWorkOrderAnomaly,
} from "@/lib/aiden/actions/resolvers/bulk-invoice-completed-work-orders-types"
import type { AidenPreparedWorkspaceRouteGate } from "@/lib/aiden/prepared-workspace-route-gate"
import {
  buildCreateInvoiceFromWorkOrderPreviewFromWorkOrder,
  listActiveInvoicesForWorkOrder,
  mapCustomerRow,
  rankCustomerMatches,
  workOrderIsAlreadyInvoiced,
  type CreateInvoiceResolverCustomerRow,
  type CreateInvoiceResolverWorkOrderRow,
} from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import { getAidenActionMembership } from "@/lib/permissions/aiden-actions"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { fetchWorkOrderLineItems, type DbWorkOrderLineItemRow } from "@/lib/work-orders/work-order-tab-data"

const MAX_BATCH = 75

const ANOMALY_FROM_WARNING = new Set<string>([
  "missing_labor",
  "missing_parts",
  "missing_pricing",
  "missing_billing_contact",
  "missing_tax_settings",
])

export type ResolveBulkInvoiceCompletedWorkOrdersInput = {
  organizationId: string
  userId: string
  dateRange: ParsedBulkInvoiceDateRange
  customerReference?: string
  customerId?: string
  routeGate?: AidenPreparedWorkspaceRouteGate
}

export type ResolveBulkInvoiceCompletedWorkOrdersResult =
  | { status: "prepared"; preview: BulkInvoiceCompletedWorkOrdersPreview }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

async function fetchSubscriptionRow(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("status, trial_ends_at, plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()
  return (data ?? null) as OrganizationSubscription | null
}

async function loadActiveCustomers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: CreateInvoiceResolverCustomerRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, company_name, billing_name, billing_contact_name, billing_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_exempt, default_tax_basis, default_tax_category",
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_archived", false)
    .limit(2500)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as CreateInvoiceResolverCustomerRow[] }
}

function utcDayKey(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function warningsToAnomalies(warnings: string[]): BulkInvoiceWorkOrderAnomaly[] {
  const out: BulkInvoiceWorkOrderAnomaly[] = []
  for (const w of warnings) {
    if (ANOMALY_FROM_WARNING.has(w)) out.push(w as BulkInvoiceWorkOrderAnomaly)
  }
  return [...new Set(out)]
}

export async function resolveBulkInvoiceCompletedWorkOrdersPreview(
  supabase: SupabaseClient,
  input: ResolveBulkInvoiceCompletedWorkOrdersInput,
): Promise<ResolveBulkInvoiceCompletedWorkOrdersResult> {
  if (!getPreparedWorkspaceActionDefinition("bulk_invoice_completed_work_orders")) {
    return { status: "failed", reason: "This workspace action is not configured." }
  }

  const membership = await getAidenActionMembership({
    supabase,
    organizationId: input.organizationId,
    userId: input.userId,
  })
  if (!membership) {
    return { status: "failed", reason: "You are not an active member of this organization." }
  }

  const planId = await fetchOrganizationPlanId(input.organizationId)
  const subRow = await fetchSubscriptionRow(supabase, input.organizationId)
  const trialActive = isTrialActive(subRow)

  const rg = input.routeGate
  if (
    !canPrepareAidenActionId(
      {
        permissions: rg?.sessionPermissions ?? membership.permissions,
        planId,
        trialActive,
        platformAdminPlanBypass: rg?.platformAdminPlanBypass,
      },
      "bulk_invoice_completed_work_orders",
    )
  ) {
    return {
      status: "failed",
      reason: "You do not have permission to bulk-prepare draft invoices for this workspace.",
    }
  }

  let filterCustomerId: string | null = null
  if (input.customerId?.trim()) {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.customerId.trim())
      .eq("status", "active")
      .eq("is_archived", false)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    if (!data) return { status: "failed", reason: "Customer not found for this organization." }
    filterCustomerId = (data as { id: string }).id
  } else if (input.customerReference?.trim()) {
    const ref = input.customerReference.trim()
    const { rows, error } = await loadActiveCustomers(supabase, input.organizationId)
    if (error) return { status: "failed", reason: error }
    const ranked = rankCustomerMatches(ref, rows)
    if (ranked.length === 0) {
      return {
        status: "failed",
        reason: "We could not find a customer matching that name for this organization.",
      }
    }
    const bestScore = ranked[0].score
    const tied = ranked.filter((r) => r.score === bestScore)
    if (tied.length > 1) {
      return {
        status: "needs_clarification",
        reason: "Multiple customers match. Pick one to continue.",
        customerCandidates: tied.slice(0, 8).map((t) => ({ id: t.id, label: t.label })),
      }
    }
    filterCustomerId = tied[0].id
  }

  let q = supabase
    .from("work_orders")
    .select(
      "id, work_order_number, customer_id, title, status, completed_at, billing_state, billable_to_customer, total_labor_cents, total_parts_cents, notes, problem_reported, repair_log",
    )
    .eq("organization_id", input.organizationId)
    .eq("status", "completed")
    .eq("is_archived", false)
    .gte("completed_at", input.dateRange.rangeStartIso)
    .lte("completed_at", input.dateRange.rangeEndIso)
    .or("billable_to_customer.is.null,billable_to_customer.eq.true")
    .order("completed_at", { ascending: false })
    .limit(MAX_BATCH)

  if (filterCustomerId) {
    q = q.eq("customer_id", filterCustomerId)
  }

  const { data: woRows, error: woErr } = await q
  if (woErr) return { status: "failed", reason: woErr.message }

  const workOrders = (woRows ?? []) as CreateInvoiceResolverWorkOrderRow[]
  const eligible: CreateInvoiceResolverWorkOrderRow[] = []
  for (const wo of workOrders) {
    if (!wo.completed_at) continue
    if (await workOrderIsAlreadyInvoiced(supabase, input.organizationId, wo.id)) continue
    eligible.push(wo)
  }

  const customerIds = [...new Set(eligible.map((w) => w.customer_id))]
  const customerById = new Map<string, CreateInvoiceResolverCustomerRow>()
  if (customerIds.length > 0) {
    const { data: custRows, error: cErr } = await supabase
      .from("customers")
      .select(
        "id, company_name, billing_name, billing_contact_name, billing_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_exempt, default_tax_basis, default_tax_category",
      )
      .eq("organization_id", input.organizationId)
      .in("id", customerIds)
      .eq("status", "active")
      .eq("is_archived", false)
    if (cErr) return { status: "failed", reason: cErr.message }
    for (const c of (custRows ?? []) as CreateInvoiceResolverCustomerRow[]) {
      customerById.set(c.id, c)
    }
  }

  const items: BulkInvoiceCompletedWorkOrderPreviewItem[] = []
  const batchWarnings: string[] = []

  if (workOrders.length >= MAX_BATCH) {
    batchWarnings.push(`result_capped_at_${MAX_BATCH}`)
  }

  for (const wo of eligible) {
    const customerRow = customerById.get(wo.customer_id)
    if (!customerRow) {
      batchWarnings.push(`missing_customer_for_work_order:${wo.id}`)
      continue
    }

    let partsRows: DbWorkOrderLineItemRow[] = []
    try {
      partsRows = await fetchWorkOrderLineItems(supabase, input.organizationId, wo.id)
    } catch {
      partsRows = []
    }

    const invoicePreview = buildCreateInvoiceFromWorkOrderPreviewFromWorkOrder({
      workOrder: wo,
      customerRow,
      partsRows,
    })

    const anomalies = warningsToAnomalies(invoicePreview.warnings)
    if (invoicePreview.total === 0 || invoicePreview.subtotal === 0) {
      anomalies.push("zero_total")
    }

    const existing = await listActiveInvoicesForWorkOrder(supabase, input.organizationId, wo.id)
    if (existing.length > 0) {
      anomalies.push("existing_invoice_link")
    }

    const cust = mapCustomerRow(customerRow)
    const label = cust.billingName?.trim() ? `${cust.companyName} (${cust.billingName})` : cust.companyName

    items.push({
      workOrderId: wo.id,
      workOrderNumber: wo.work_order_number,
      customerId: wo.customer_id,
      customerLabel: label,
      completedAt: wo.completed_at,
      anomalies,
      invoicePreview,
    })
  }

  const dupKeys = new Map<string, string[]>()
  for (const it of items) {
    const cents = Math.round(it.invoicePreview.total * 100)
    const k = `${it.customerId}|${cents}|${utcDayKey(it.completedAt)}`
    const arr = dupKeys.get(k) ?? []
    arr.push(it.workOrderId)
    dupKeys.set(k, arr)
  }
  for (const [, ids] of dupKeys) {
    if (ids.length < 2) continue
    for (const it of items) {
      if (ids.includes(it.workOrderId) && !it.anomalies.includes("duplicate_risk")) {
        it.anomalies.push("duplicate_risk")
      }
    }
  }

  const includedCount = items.length
  const estimatedTotal = items.reduce((s, i) => s + i.invoicePreview.total, 0)

  const preview: BulkInvoiceCompletedWorkOrdersPreview = {
    dateRange: {
      startIso: input.dateRange.rangeStartIso,
      endIso: input.dateRange.rangeEndIso,
      label: input.dateRange.label,
    },
    items,
    excludedWorkOrderIds: [],
    batchWarnings,
    summary: {
      candidateCount: items.length,
      includedCount,
      estimatedTotal,
    },
  }

  if (items.length === 0) {
    return {
      status: "failed",
      reason:
        "No completed, uninvoiced work orders matched that range and filters. Try a wider date range or clear the customer filter.",
    }
  }

  return { status: "prepared", preview }
}
