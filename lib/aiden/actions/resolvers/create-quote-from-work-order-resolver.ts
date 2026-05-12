import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { getPreparedWorkspaceActionDefinition, canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenWorkOrderReference } from "@/lib/aiden/intent/intent-types"
import type { AidenPreparedWorkspaceRouteGate } from "@/lib/aiden/prepared-workspace-route-gate"
import {
  mapCustomerRow,
  rankCustomerMatches,
  type CreateInvoicePreviewCustomer,
  type CreateInvoicePreviewLineItem,
} from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import { getAidenActionMembership } from "@/lib/permissions/aiden-actions"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { fetchWorkOrderLineItems, type DbWorkOrderLineItemRow } from "@/lib/work-orders/work-order-tab-data"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CreateQuotePreviewLineItem =
  | CreateInvoicePreviewLineItem
  | {
      kind: "recommended"
      description: string
      quantity: number
      unitCents: number
      lineTotalCents: number
      source: "repair_log_task"
    }

export type CreateQuoteFromWorkOrderPreviewPayload = {
  customer: CreateInvoicePreviewCustomer
  workOrder: {
    id: string
    workOrderNumber: number | null
    title: string
    status: string
    completedAt: string | null
    billingState: string | null
    totalLaborCents: number
    totalPartsCents: number
  }
  lineItems: CreateQuotePreviewLineItem[]
  subtotal: number
  taxEstimate: null
  total: number
  notes: string
  diagnosis: string | null
  recommendedRepairsSummary: string | null
  warnings: string[]
  recommendedQuoteTitle: string
  sourceSummary: string
}

export type CreateQuoteFromWorkOrderResolverInput = {
  organizationId: string
  userId: string
  customerReference?: string
  customerId?: string
  workOrderReference: AidenWorkOrderReference
  routeGate?: AidenPreparedWorkspaceRouteGate
}

export type CreateQuoteFromWorkOrderResolverResult =
  | { status: "prepared"; preview: CreateQuoteFromWorkOrderPreviewPayload }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

type CustomerRow = {
  id: string
  company_name: string
  billing_name: string | null
  billing_contact_name: string | null
  billing_email: string | null
  billing_contact_phone: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  tax_exempt: boolean | null
  default_tax_basis: string | null
  default_tax_category: string | null
}

type WorkOrderRow = {
  id: string
  work_order_number: number | null
  customer_id: string
  equipment_id: string | null
  title: string
  status: string
  completed_at: string | null
  billing_state: string | null
  billable_to_customer: boolean | null
  total_labor_cents: number
  total_parts_cents: number
  notes: string | null
  problem_reported: string | null
  repair_log: unknown
}

function centsToMajor(cents: number): number {
  return Math.round(cents) / 100
}

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
): Promise<{ rows: CustomerRow[]; error?: string }> {
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
  return { rows: (data ?? []) as CustomerRow[] }
}

/**
 * Picks a work order for **quote** preview: does not exclude already-invoiced jobs.
 * `latest` prefers recent completed visits, then other active statuses.
 */
async function pickWorkOrderForCustomerQuote(args: {
  supabase: SupabaseClient
  organizationId: string
  customerId: string
  workOrderReference: AidenWorkOrderReference
}): Promise<{ workOrder: WorkOrderRow | null; reason?: string }> {
  const { supabase, organizationId, customerId, workOrderReference } = args

  if (typeof workOrderReference === "string" && UUID_RE.test(workOrderReference)) {
    const { data, error } = await supabase
      .from("work_orders")
      .select(
        "id, work_order_number, customer_id, equipment_id, title, status, completed_at, billing_state, billable_to_customer, total_labor_cents, total_parts_cents, notes, problem_reported, repair_log",
      )
      .eq("organization_id", organizationId)
      .eq("id", workOrderReference)
      .eq("customer_id", customerId)
      .eq("is_archived", false)
      .maybeSingle()
    if (error) return { workOrder: null, reason: error.message }
    const wo = data as WorkOrderRow | null
    if (!wo) return { workOrder: null, reason: "That work order was not found for this customer." }
    if (wo.billable_to_customer === false) {
      return { workOrder: null, reason: "This work order is marked as not billable to the customer." }
    }
    return { workOrder: wo }
  }

  let q = supabase
    .from("work_orders")
    .select(
      "id, work_order_number, customer_id, equipment_id, title, status, completed_at, billing_state, billable_to_customer, total_labor_cents, total_parts_cents, notes, problem_reported, repair_log",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("is_archived", false)
    .neq("status", "cancelled")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(40)

  if (workOrderReference === "latest_completed") {
    q = q.eq("status", "completed")
  } else if (workOrderReference === "latest") {
    q = q.in("status", ["completed", "completed_pending_signature", "in_progress", "scheduled", "dispatched"])
  }

  const { data, error } = await q
  if (error) return { workOrder: null, reason: error.message }
  const rows = (data ?? []) as WorkOrderRow[]
  for (const wo of rows) {
    if (wo.billable_to_customer === false) continue
    if (workOrderReference === "latest_completed" && !wo.completed_at) continue
    return { workOrder: wo }
  }

  return {
    workOrder: null,
    reason:
      workOrderReference === "latest_completed" ?
        "No completed work order was found for this customer."
      : "No recent work order was found for this customer to use as quote context.",
  }
}

function buildCoreLineItems(wo: WorkOrderRow, partsRows: DbWorkOrderLineItemRow[]): CreateInvoicePreviewLineItem[] {
  const items: CreateInvoicePreviewLineItem[] = []
  const rl = parseRepairLog(wo.repair_log)
  const laborHours = typeof rl.laborHours === "number" && rl.laborHours > 0 ? rl.laborHours : null
  if (wo.total_labor_cents > 0) {
    items.push({
      kind: "labor",
      description: laborHours ? `Labor (${laborHours} h)` : "Labor",
      quantity: laborHours ?? 1,
      unitCents: laborHours ? Math.round(wo.total_labor_cents / laborHours) : wo.total_labor_cents,
      lineTotalCents: wo.total_labor_cents,
      source: "work_order_totals",
    })
  }
  for (const p of partsRows) {
    const qty = typeof p.quantity === "number" ? p.quantity : Number.parseFloat(String(p.quantity)) || 1
    items.push({
      kind: "parts",
      description: p.description,
      quantity: qty,
      unitCents: p.unit_cost_cents,
      lineTotalCents: p.line_total_cents,
      source: "work_order_line_items",
    })
  }
  return items
}

function buildRecommendedTaskLines(wo: WorkOrderRow): CreateQuotePreviewLineItem[] {
  const rl = parseRepairLog(wo.repair_log)
  const out: CreateQuotePreviewLineItem[] = []
  for (const t of rl.tasks ?? []) {
    if (t.done) continue
    const label = t.label?.trim()
    if (!label) continue
    const desc = t.description?.trim() ? `${label} — ${t.description.trim()}` : label
    out.push({
      kind: "recommended",
      description: desc,
      quantity: 1,
      unitCents: 0,
      lineTotalCents: 0,
      source: "repair_log_task",
    })
  }
  return out
}

function mergeQuoteLineItems(wo: WorkOrderRow, partsRows: DbWorkOrderLineItemRow[]): CreateQuotePreviewLineItem[] {
  const core = buildCoreLineItems(wo, partsRows)
  const rec = buildRecommendedTaskLines(wo)
  return [...core, ...rec]
}

/**
 * Builds a **draft quote preview only** from work order context. Does not insert `org_quotes`.
 */
export async function resolveCreateQuoteFromWorkOrderPreview(
  supabase: SupabaseClient,
  input: CreateQuoteFromWorkOrderResolverInput,
): Promise<CreateQuoteFromWorkOrderResolverResult> {
  if (!getPreparedWorkspaceActionDefinition("create_quote_from_work_order")) {
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
      "create_quote_from_work_order",
    )
  ) {
    return {
      status: "failed",
      reason: "You do not have permission to prepare quotes from work orders for this workspace.",
    }
  }

  let customerRow: CustomerRow | null = null
  if (input.customerId?.trim()) {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_name, billing_name, billing_contact_name, billing_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_exempt, default_tax_basis, default_tax_category",
      )
      .eq("organization_id", input.organizationId)
      .eq("id", input.customerId.trim())
      .eq("status", "active")
      .eq("is_archived", false)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    customerRow = (data ?? null) as CustomerRow | null
    if (!customerRow) {
      return { status: "failed", reason: "Customer not found for this organization." }
    }
  } else {
    const ref = (input.customerReference ?? "").trim()
    if (!ref) {
      return { status: "failed", reason: "A customer name or customer context is required to build a preview." }
    }
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
    customerRow = rows.find((c) => c.id === tied[0].id) ?? null
  }

  if (!customerRow) {
    return { status: "failed", reason: "Customer could not be resolved." }
  }

  const { workOrder, reason } = await pickWorkOrderForCustomerQuote({
    supabase,
    organizationId: input.organizationId,
    customerId: customerRow.id,
    workOrderReference: input.workOrderReference,
  })
  if (!workOrder) {
    return { status: "failed", reason: reason ?? "No work order was found for this quote." }
  }

  let partsRows: DbWorkOrderLineItemRow[] = []
  try {
    partsRows = await fetchWorkOrderLineItems(supabase, input.organizationId, workOrder.id)
  } catch {
    partsRows = []
  }

  const rl = parseRepairLog(workOrder.repair_log)
  const diagnosis =
    [rl.diagnosis?.trim(), rl.technicianNotes?.trim()].filter(Boolean).join("\n\n").trim() || null

  const pendingTasks = (rl.tasks ?? []).filter((t) => !t.done && t.label?.trim())
  const recommendedRepairsSummary =
    pendingTasks.length > 0 ? pendingTasks.map((t) => `• ${t.label.trim()}`).join("\n") : null

  const customer = mapCustomerRow(customerRow)
  const lineItems = mergeQuoteLineItems(workOrder, partsRows)

  const notesParts = [workOrder.notes, workOrder.problem_reported].filter(Boolean) as string[]
  const notes = notesParts.join("\n\n").trim()

  const warnings: string[] = []
  if (workOrder.total_labor_cents <= 0) warnings.push("No labor dollars were recorded on this work order.")
  if (partsRows.length === 0 && workOrder.total_parts_cents <= 0 && lineItems.filter((l) => l.kind === "recommended").length === 0) {
    warnings.push("No parts line items and no recommended checklist lines — add lines before sending a quote.")
  }
  for (const p of partsRows) {
    if (p.unit_cost_cents <= 0 || p.line_total_cents <= 0) {
      warnings.push("Some parts lines are missing unit or line pricing.")
      break
    }
  }
  if (!customer.billingEmail?.trim() && !customer.billingContactPhone?.trim()) {
    warnings.push("Customer is missing billing email and phone.")
  }
  if (workOrder.status === "in_progress" || workOrder.status === "scheduled" || workOrder.status === "dispatched") {
    warnings.push("Source work order is still open — totals may change as the job progresses.")
  }
  if (lineItems.some((l) => l.kind === "recommended")) {
    warnings.push("Recommended checklist lines default to $0 — enter estimate amounts before sending.")
  }

  let subtotalCents = 0
  for (const li of lineItems) subtotalCents += li.lineTotalCents
  const subtotal = centsToMajor(subtotalCents)
  const woNum = workOrder.work_order_number != null ? `#${workOrder.work_order_number}` : workOrder.id.slice(0, 8)
  const recommendedQuoteTitle = `Quote — ${customer.companyName} — WO ${woNum}`
  const sourceSummary =
    `Draft quote from work order ${woNum} (${workOrder.status}) for ${customer.companyName}. ` +
    `Includes labor/parts from the job plus any unchecked checklist items as optional estimate lines.`

  const preview: CreateQuoteFromWorkOrderPreviewPayload = {
    customer,
    workOrder: {
      id: workOrder.id,
      workOrderNumber: workOrder.work_order_number,
      title: workOrder.title,
      status: workOrder.status,
      completedAt: workOrder.completed_at,
      billingState: workOrder.billing_state,
      totalLaborCents: workOrder.total_labor_cents,
      totalPartsCents: workOrder.total_parts_cents,
    },
    lineItems,
    subtotal,
    taxEstimate: null,
    total: subtotal,
    notes,
    diagnosis,
    recommendedRepairsSummary,
    warnings: [...new Set(warnings)],
    recommendedQuoteTitle,
    sourceSummary,
  }

  return { status: "prepared", preview }
}
