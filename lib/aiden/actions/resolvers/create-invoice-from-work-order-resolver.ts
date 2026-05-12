import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { getPreparedWorkspaceActionDefinition, canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenWorkOrderReference } from "@/lib/aiden/intent/intent-types"
import type { AidenPreparedWorkspaceRouteGate } from "@/lib/aiden/prepared-workspace-route-gate"
import { getAidenActionMembership } from "@/lib/permissions/aiden-actions"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { fetchWorkOrderLineItems, type DbWorkOrderLineItemRow } from "@/lib/work-orders/work-order-tab-data"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CreateInvoiceFromWorkOrderResolverInput = {
  organizationId: string
  userId: string
  /** Free-text from intent parser when `customerId` is unknown. */
  customerReference?: string
  /** When UI already resolved the customer (e.g. context). */
  customerId?: string
  workOrderReference: AidenWorkOrderReference
  /** Optional: align resolver plan checks with authenticated route context. */
  routeGate?: AidenPreparedWorkspaceRouteGate
}

export type CreateInvoiceFromWorkOrderResolverResult =
  | { status: "prepared"; preview: CreateInvoiceFromWorkOrderPreviewPayload }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

export type CreateInvoicePreviewCustomer = {
  id: string
  companyName: string
  billingName: string | null
  billingContactName: string | null
  billingEmail: string | null
  billingContactPhone: string | null
  billingAddressLine1: string | null
  billingAddressLine2: string | null
  billingCity: string | null
  billingState: string | null
  billingPostalCode: string | null
  billingCountry: string | null
  taxExempt: boolean | null
  defaultTaxBasis: string | null
  defaultTaxCategory: string | null
}

export type CreateInvoicePreviewWorkOrder = {
  id: string
  workOrderNumber: number | null
  title: string
  status: string
  completedAt: string | null
  billingState: string | null
  totalLaborCents: number
  totalPartsCents: number
}

export type CreateInvoicePreviewLineItem = {
  kind: "labor" | "parts" | "materials" | "fee" | "manual"
  description: string
  quantity: number
  unitCents: number
  lineTotalCents: number
  source: "work_order_totals" | "work_order_line_items" | "manual"
}

export type CreateInvoiceFromWorkOrderPreviewPayload = {
  customer: CreateInvoicePreviewCustomer
  workOrder: CreateInvoicePreviewWorkOrder
  lineItems: CreateInvoicePreviewLineItem[]
  /** Subtotal in major currency units (derived from cents). */
  subtotal: number
  /** Estimated tax in major units when settings allow a simple estimate; otherwise null. */
  taxEstimate: number | null
  /** Total in major units (subtotal + tax when estimated). */
  total: number
  notes: string
  warnings: string[]
  recommendedInvoiceTitle: string
  sourceSummary: string
}

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

export type CreateInvoiceResolverCustomerRow = CustomerRow
export type CreateInvoiceResolverWorkOrderRow = WorkOrderRow

export function normalizeMatchKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Deterministic customer ranking for tests and resolver: exact company/billing name,
 * then substring / token overlap. Does not hit the database.
 */
export function rankCustomerMatches(
  reference: string,
  customers: Array<Pick<CustomerRow, "id" | "company_name" | "billing_name">>,
): Array<{ id: string; score: number; label: string }> {
  const q = normalizeMatchKey(reference)
  if (!q) return []
  const qTokens = new Set(q.split(" ").filter((t) => t.length > 1))

  const scored = customers.map((c) => {
    const company = normalizeMatchKey(c.company_name)
    const billing = c.billing_name ? normalizeMatchKey(c.billing_name) : ""
    let score = 0
    if (q === company || (billing && q === billing)) score = 100
    else if (company === q || billing === q) score = 100
    else if (company.includes(q) || (billing && billing.includes(q))) score = 92
    else if (q.includes(company) && company.length >= 4) score = 88
    else if (billing && q.includes(billing) && billing.length >= 4) score = 88
    else {
      const cWords = new Set(company.split(" ").filter((t) => t.length > 1))
      let overlap = 0
      for (const t of qTokens) if (cWords.has(t)) overlap++
      const denom = Math.max(1, qTokens.size)
      const ratio = overlap / denom
      if (ratio >= 0.66 && overlap >= 2) score = 72 + Math.floor(ratio * 10)
      else if (ratio >= 0.5 && overlap >= 1) score = 58
    }
    const label = c.billing_name?.trim() ? `${c.company_name} (${c.billing_name})` : c.company_name
    return { id: c.id, score, label }
  })

  return scored.filter((s) => s.score >= 58).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
}

function centsToMajor(cents: number): number {
  return Math.round(cents) / 100
}

export function mapCustomerRow(r: CustomerRow): CreateInvoicePreviewCustomer {
  return {
    id: r.id,
    companyName: r.company_name,
    billingName: r.billing_name,
    billingContactName: r.billing_contact_name,
    billingEmail: r.billing_email,
    billingContactPhone: r.billing_contact_phone,
    billingAddressLine1: r.billing_address_line1,
    billingAddressLine2: r.billing_address_line2,
    billingCity: r.billing_city,
    billingState: r.billing_state,
    billingPostalCode: r.billing_postal_code,
    billingCountry: r.billing_country,
    taxExempt: r.tax_exempt,
    defaultTaxBasis: r.default_tax_basis,
    defaultTaxCategory: r.default_tax_category,
  }
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

export async function workOrderIsAlreadyInvoiced(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<boolean> {
  const [{ data: link }, { data: legacy }] = await Promise.all([
    supabase
      .from("invoice_work_order_links")
      .select("invoice_id")
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("org_invoices")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId)
      .limit(1)
      .maybeSingle(),
  ])
  if (link) return true
  if (legacy) return true
  if (workOrderId) {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("status, billing_state")
      .eq("organization_id", organizationId)
      .eq("id", workOrderId)
      .maybeSingle()
    const row = wo as { status?: string; billing_state?: string | null } | null
    if (row?.status === "invoiced") return true
    const bs = (row?.billing_state ?? "").toLowerCase()
    if (bs === "invoiced" || bs === "paid") return true
  }
  return false
}

export async function listActiveInvoicesForWorkOrder(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<Array<{ id: string; status: string }>> {
  const ids = new Set<string>()

  const { data: links } = await supabase
    .from("invoice_work_order_links")
    .select("invoice_id")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)

  for (const r of (links ?? []) as Array<{ invoice_id: string }>) {
    if (r.invoice_id) ids.add(r.invoice_id)
  }

  const { data: legacy } = await supabase
    .from("org_invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .is("archived_at", null)

  for (const r of (legacy ?? []) as Array<{ id: string }>) {
    ids.add(r.id)
  }

  if (ids.size === 0) return []

  const { data: invs, error } = await supabase
    .from("org_invoices")
    .select("id, status, archived_at")
    .eq("organization_id", organizationId)
    .in("id", [...ids])

  if (error || !invs) return []

  const out: Array<{ id: string; status: string }> = []
  for (const inv of invs as Array<{ id: string; status: string; archived_at: string | null }>) {
    if (inv.archived_at) continue
    const st = String(inv.status || "")
    if (st === "void") continue
    out.push({ id: inv.id, status: st })
  }
  return out
}

async function pickWorkOrderForCustomer(args: {
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
        "id, work_order_number, customer_id, title, status, completed_at, billing_state, billable_to_customer, total_labor_cents, total_parts_cents, notes, problem_reported, repair_log",
      )
      .eq("organization_id", organizationId)
      .eq("id", workOrderReference)
      .eq("customer_id", customerId)
      .eq("is_archived", false)
      .maybeSingle()
    if (error) return { workOrder: null, reason: error.message }
    const wo = data as WorkOrderRow | null
    if (!wo) return { workOrder: null, reason: "That work order was not found for this customer." }
    if (await workOrderIsAlreadyInvoiced(supabase, organizationId, wo.id)) {
      return { workOrder: null, reason: "This work order is already linked to an invoice." }
    }
    if (wo.billable_to_customer === false) {
      return { workOrder: null, reason: "This work order is marked as not billable to the customer." }
    }
    return { workOrder: wo }
  }

  let q = supabase
    .from("work_orders")
    .select(
      "id, work_order_number, customer_id, title, status, completed_at, billing_state, billable_to_customer, total_labor_cents, total_parts_cents, notes, problem_reported, repair_log",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("is_archived", false)
    .neq("status", "invoiced")
    .or("billing_state.is.null,billing_state.not.in.(invoiced,paid)")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(40)

  if (workOrderReference === "latest_completed") {
    q = q.eq("status", "completed")
  } else if (workOrderReference === "latest") {
    q = q.in("status", ["completed", "completed_pending_signature"])
  }

  const { data, error } = await q
  if (error) return { workOrder: null, reason: error.message }
  const rows = (data ?? []) as WorkOrderRow[]
  for (const wo of rows) {
    if (wo.billable_to_customer === false) continue
    if (!wo.completed_at) continue
    if (await workOrderIsAlreadyInvoiced(supabase, organizationId, wo.id)) continue
    return { workOrder: wo }
  }

  return {
    workOrder: null,
    reason:
      workOrderReference === "latest_completed" ?
        "No completed work order ready to invoice was found for this customer. Completed jobs that are already invoiced are excluded."
      : "No eligible work order was found for this customer. We look for completed jobs that are not already invoiced.",
  }
}

function buildLineItems(
  wo: WorkOrderRow,
  partsRows: DbWorkOrderLineItemRow[],
): CreateInvoicePreviewLineItem[] {
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

function computeTotalsAndTax(args: {
  lineItems: CreateInvoicePreviewLineItem[]
  customer: CreateInvoicePreviewCustomer
}): { subtotalCents: number; taxEstimate: number | null; total: number; warnings: string[] } {
  const warnings: string[] = []
  let subtotalCents = 0
  for (const li of args.lineItems) subtotalCents += li.lineTotalCents

  let taxEstimate: number | null = null
  const c = args.customer
  if (c.taxExempt === true) {
    taxEstimate = 0
  } else {
    // No persisted tax rate on the customer row — preview leaves tax null unless exempt.
    taxEstimate = null
    if (!c.defaultTaxBasis?.trim()) {
      warnings.push("missing_tax_settings")
    }
  }

  const subtotal = centsToMajor(subtotalCents)
  const total = taxEstimate === null ? subtotal : Math.round((subtotal + taxEstimate) * 100) / 100
  return { subtotalCents, taxEstimate, total, warnings: [...new Set(warnings)] }
}

/**
 * Shared preview builder for single-WO and bulk invoice flows. Does not persist.
 */
export function buildCreateInvoiceFromWorkOrderPreviewFromWorkOrder(args: {
  workOrder: WorkOrderRow
  customerRow: CustomerRow
  partsRows: DbWorkOrderLineItemRow[]
}): CreateInvoiceFromWorkOrderPreviewPayload {
  const { workOrder, customerRow, partsRows } = args
  const customer = mapCustomerRow(customerRow)
  const lineItems = buildLineItems(workOrder, partsRows)
  const notesParts = [workOrder.notes, workOrder.problem_reported].filter(Boolean) as string[]
  const notes = notesParts.join("\n\n").trim()

  const warnings: string[] = []
  if (workOrder.total_labor_cents <= 0) warnings.push("missing_labor")
  if (partsRows.length === 0 && workOrder.total_parts_cents <= 0) warnings.push("missing_parts")
  for (const p of partsRows) {
    if (p.unit_cost_cents <= 0 || p.line_total_cents <= 0) {
      warnings.push("missing_pricing")
      break
    }
  }
  if (!customer.billingEmail?.trim() && !customer.billingContactPhone?.trim()) {
    warnings.push("missing_billing_contact")
  }

  const taxParts = computeTotalsAndTax({ lineItems, customer })
  for (const w of taxParts.warnings) if (!warnings.includes(w)) warnings.push(w)

  const subtotal = centsToMajor(taxParts.subtotalCents)
  const woNum = workOrder.work_order_number != null ? `#${workOrder.work_order_number}` : workOrder.id.slice(0, 8)
  const recommendedInvoiceTitle = `Invoice — ${customer.companyName} — WO ${woNum}`
  const sourceSummary =
    `Draft from work order ${woNum} (${workOrder.status}) for ${customer.companyName}. ` +
    `Labor ${centsToMajor(workOrder.total_labor_cents)} + parts/materials ${centsToMajor(workOrder.total_parts_cents)} (from line items where recorded).`

  return {
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
    taxEstimate: taxParts.taxEstimate,
    total: taxParts.total,
    notes,
    warnings: [...new Set(warnings)],
    recommendedInvoiceTitle,
    sourceSummary,
  }
}

/**
 * Builds a **draft invoice preview only** from a prepared intent. Does not insert `org_invoices` or links.
 */
export async function resolveCreateInvoiceFromWorkOrderPreview(
  supabase: SupabaseClient,
  input: CreateInvoiceFromWorkOrderResolverInput,
): Promise<CreateInvoiceFromWorkOrderResolverResult> {
  if (!getPreparedWorkspaceActionDefinition("create_invoice_from_work_order")) {
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
      "create_invoice_from_work_order",
    )
  ) {
    return {
      status: "failed",
      reason: "You do not have permission to prepare invoices from work orders for this workspace.",
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

  const { workOrder, reason } = await pickWorkOrderForCustomer({
    supabase,
    organizationId: input.organizationId,
    customerId: customerRow.id,
    workOrderReference: input.workOrderReference,
  })
  if (!workOrder) {
    return { status: "failed", reason: reason ?? "No eligible work order was found." }
  }

  let partsRows: DbWorkOrderLineItemRow[] = []
  try {
    partsRows = await fetchWorkOrderLineItems(supabase, input.organizationId, workOrder.id)
  } catch {
    partsRows = []
  }

  const preview = buildCreateInvoiceFromWorkOrderPreviewFromWorkOrder({ workOrder, customerRow, partsRows })

  return { status: "prepared", preview }
}
