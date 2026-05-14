import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import {
  listActiveInvoicesForWorkOrder,
  type CreateInvoiceFromWorkOrderPreviewPayload,
} from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { insertOrgInvoice } from "@/lib/org-quotes-invoices/repository"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"
import type { OrgPermissions } from "@/lib/permissions/model"
import type { TaxCalculationMode } from "@/lib/billing/tax-framework"
import {
  billingAddressFromCustomerLike,
  lineItemsForTaxEngine,
  mapSalesTaxToInvoiceInsertFields,
  taxBasisFromCustomerDefault,
} from "@/lib/tax/invoice-tax-bridge"
import { resolveSalesTaxForLines } from "@/lib/tax/resolve-document-sales-tax"

const ACTION_ID: AidenPreparedWorkspaceActionId = "create_invoice_from_work_order"

async function fetchOrgSubscriptionForTrialLocal(
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

async function reassertCanPrepareInvoiceFromWorkOrder(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  platformAdminPlanBypass?: boolean
}): Promise<boolean> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const sub = await fetchOrgSubscriptionForTrialLocal(args.supabase, args.organizationId)
  return canPrepareAidenActionId(
    {
      permissions: args.permissions,
      planId,
      trialActive: isTrialActive(sub),
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    },
    ACTION_ID,
  )
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** Maps preview line items to persisted invoice `line_items` JSON (unit = dollars). */
export function previewLineItemsToLineItemJson(
  lineItems: CreateInvoiceFromWorkOrderPreviewPayload["lineItems"],
  preparedActionId: string,
  options?: { bulkWorkOrderId?: string },
): LineItemJson[] {
  const wo = options?.bulkWorkOrderId?.trim()
  return lineItems.map((li, idx) => {
    const qty = li.quantity > 0 ? li.quantity : 1
    const unitDollars = li.unitCents / 100
    const prefix = wo ? `aiden:bulk:${preparedActionId}:${wo}` : `aiden:${preparedActionId}`
    return {
      description: li.description.trim() || `Line ${idx + 1}`,
      qty,
      unit: unitDollars,
      source_ref: `${prefix}:${li.kind}:${idx}`,
    }
  })
}

export function computeSubtotalCentsFromPreviewLineItems(
  lineItems: CreateInvoiceFromWorkOrderPreviewPayload["lineItems"],
): number {
  let sum = 0
  for (const li of lineItems) {
    sum += Math.round(li.lineTotalCents)
  }
  return sum
}

/**
 * Validates `preview_payload` from `aiden_prepared_actions` for invoice-from-WO execution.
 * Exported for unit tests.
 */
export function parseInvoicePreviewPayloadFromPreparedAction(
  previewPayload: Record<string, unknown>,
):
  | { ok: true; preview: CreateInvoiceFromWorkOrderPreviewPayload }
  | { ok: false; message: string } {
  const root = previewPayload
  const prev = root.preview
  if (!isRecord(prev)) {
    return { ok: false, message: "Missing or invalid preview payload (expected preview object)." }
  }

  const customer = prev.customer
  const workOrder = prev.workOrder
  const lineItemsRaw = prev.lineItems
  if (!isRecord(customer) || !isRecord(workOrder) || !Array.isArray(lineItemsRaw)) {
    return { ok: false, message: "Preview is missing customer, workOrder, or lineItems." }
  }

  const customerId = pickString(customer.id)
  if (!customerId || !UUID_RE.test(customerId)) {
    return { ok: false, message: "Preview customer id is missing or invalid." }
  }

  const workOrderId = pickString(workOrder.id)
  if (!workOrderId || !UUID_RE.test(workOrderId)) {
    return { ok: false, message: "Preview work order id is missing or invalid." }
  }

  const lineItems: CreateInvoiceFromWorkOrderPreviewPayload["lineItems"] = []
  for (const raw of lineItemsRaw) {
    if (!isRecord(raw)) continue
    const kind = pickString(raw.kind)
    const description = pickString(raw.description) ?? ""
    const quantity = pickNumber(raw.quantity) ?? 0
    const unitCents = pickNumber(raw.unitCents)
    const lineTotalCents = pickNumber(raw.lineTotalCents)
    if (
      kind !== "labor" &&
      kind !== "parts" &&
      kind !== "materials" &&
      kind !== "fee" &&
      kind !== "manual"
    ) {
      return { ok: false, message: "Preview line item has invalid kind." }
    }
    if (unitCents == null || lineTotalCents == null) {
      return { ok: false, message: "Preview line item is missing cents fields." }
    }
    const sourceRaw = raw.source
    const source: CreateInvoicePreviewLineItem["source"] =
      sourceRaw === "work_order_line_items"
        ? "work_order_line_items"
        : sourceRaw === "manual"
          ? "manual"
          : "work_order_totals"
    lineItems.push({
      kind,
      description,
      quantity,
      unitCents,
      lineTotalCents,
      source,
    })
  }

  if (lineItems.length === 0) {
    return { ok: false, message: "Preview has no line items to invoice." }
  }

  const subtotal = pickNumber(prev.subtotal)
  const total = pickNumber(prev.total)
  const taxEstimate = prev.taxEstimate === null ? null : pickNumber(prev.taxEstimate)

  if (subtotal == null || total == null) {
    return { ok: false, message: "Preview subtotal or total is missing." }
  }

  const notes = pickString(prev.notes) ?? ""
  const recommendedInvoiceTitle = pickString(prev.recommendedInvoiceTitle) ?? "Invoice"
  const sourceSummary = pickString(prev.sourceSummary) ?? ""

  const warnings: string[] = []
  if (Array.isArray(prev.warnings)) {
    for (const w of prev.warnings) {
      const s = pickString(w)
      if (s) warnings.push(s)
    }
  }

  const preview: CreateInvoiceFromWorkOrderPreviewPayload = {
    customer: {
      id: customerId,
      companyName: pickString(customer.companyName) ?? "",
      billingName: pickString(customer.billingName),
      billingContactName: pickString(customer.billingContactName),
      billingEmail: pickString(customer.billingEmail),
      billingContactPhone: pickString(customer.billingContactPhone),
      billingAddressLine1: pickString(customer.billingAddressLine1),
      billingAddressLine2: pickString(customer.billingAddressLine2),
      billingCity: pickString(customer.billingCity),
      billingState: pickString(customer.billingState),
      billingPostalCode: pickString(customer.billingPostalCode),
      billingCountry: pickString(customer.billingCountry),
      taxExempt: typeof customer.taxExempt === "boolean" ? customer.taxExempt : null,
      defaultTaxBasis: pickString(customer.defaultTaxBasis),
      defaultTaxCategory: pickString(customer.defaultTaxCategory),
    },
    workOrder: {
      id: workOrderId,
      workOrderNumber: pickNumber(workOrder.workOrderNumber),
      title: pickString(workOrder.title) ?? "",
      status: pickString(workOrder.status) ?? "",
      completedAt: pickString(workOrder.completedAt),
      billingState: pickString(workOrder.billingState),
      totalLaborCents: pickNumber(workOrder.totalLaborCents) ?? 0,
      totalPartsCents: pickNumber(workOrder.totalPartsCents) ?? 0,
    },
    lineItems,
    subtotal,
    taxEstimate,
    total,
    notes,
    warnings,
    recommendedInvoiceTitle,
    sourceSummary,
  }

  return { ok: true, preview }
}

export type ExecuteCreateInvoiceFromWorkOrderDraftArgs = {
  svc: SupabaseClient
  userSupabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

export type CreateInvoiceFromWorkOrderExecutorResult =
  | {
      kind: "success"
      invoiceId: string
      invoiceNumber: string
      status: "draft"
      message: string
    }
  | {
      kind: "idempotent"
      invoiceId: string
      invoiceNumber: string
      status: "draft"
      message: string
    }
  | { kind: "duplicate_risk"; message: string; needsConfirmation: true }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

/**
 * Creates a **draft** `org_invoices` row from a **confirmed** prepared action.
 * Does not send email, payment links, QuickBooks sync, or work-order “invoiced” billing sync
 * (see `insertOrgInvoice` options).
 */
export async function executeCreateInvoiceFromWorkOrderDraft(
  args: ExecuteCreateInvoiceFromWorkOrderDraftArgs,
): Promise<CreateInvoiceFromWorkOrderExecutorResult> {
  const { svc, userSupabase, organizationId, permissions, preparedActionId, row, platformAdminPlanBypass } = args

  if (row.organization_id !== organizationId) {
    return { kind: "validation_error", message: "Prepared action does not belong to this organization." }
  }

  if (row.action_id !== ACTION_ID) {
    return { kind: "validation_error", message: "Prepared action is not create_invoice_from_work_order." }
  }

  const canStill = await reassertCanPrepareInvoiceFromWorkOrder({
    supabase: userSupabase,
    organizationId,
    permissions,
    platformAdminPlanBypass: args.platformAdminPlanBypass,
  })
  if (!canStill) {
    return { kind: "permission_denied", message: "You no longer have permission to create this invoice." }
  }

  if (row.status === "completed" && row.target_record_id && UUID_RE.test(row.target_record_id)) {
    const { data: inv, error } = await svc
      .from("org_invoices")
      .select("id, invoice_number, status, organization_id")
      .eq("organization_id", organizationId)
      .eq("id", row.target_record_id)
      .maybeSingle()

    if (error) {
      return { kind: "server_error", message: error.message }
    }
    const r = inv as { id: string; invoice_number: string; status: string } | null
    if (!r) {
      return { kind: "validation_error", message: "Previously created invoice is no longer available." }
    }
    const ui = invoiceStatusDbToUi(r.status)
    if (ui !== "Draft") {
      return {
        kind: "validation_error",
        message: "This prepared action was already executed; the invoice is no longer a draft.",
      }
    }
    return {
      kind: "idempotent",
      invoiceId: r.id,
      invoiceNumber: r.invoice_number,
      status: "draft",
      message: "Draft invoice already exists for this prepared action.",
    }
  }

  if (row.status !== "confirmed") {
    return { kind: "validation_error", message: "Prepared action must be confirmed before execution." }
  }

  const parsed = parseInvoicePreviewPayloadFromPreparedAction(row.preview_payload ?? {})
  if (!parsed.ok) {
    return { kind: "validation_error", message: parsed.message }
  }
  const preview = parsed.preview

  const { data: wo, error: woErr } = await userSupabase
    .from("work_orders")
    .select("id, customer_id, equipment_id, organization_id, is_archived")
    .eq("organization_id", organizationId)
    .eq("id", preview.workOrder.id)
    .maybeSingle()

  if (woErr) {
    return { kind: "server_error", message: woErr.message }
  }
  const woRow = wo as {
    id: string
    customer_id: string
    equipment_id: string | null
    organization_id: string
    is_archived: boolean | null
  } | null

  if (!woRow || woRow.is_archived) {
    return { kind: "validation_error", message: "Source work order was not found or is no longer available." }
  }

  if (woRow.customer_id !== preview.customer.id) {
    return { kind: "validation_error", message: "Work order customer no longer matches the preview." }
  }

  const { data: cust, error: custErr } = await userSupabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", preview.customer.id)
    .eq("status", "active")
    .eq("is_archived", false)
    .maybeSingle()

  if (custErr) {
    return { kind: "server_error", message: custErr.message }
  }
  if (!cust) {
    return { kind: "validation_error", message: "Customer was not found or is no longer active." }
  }

  const existing = await listActiveInvoicesForWorkOrder(svc, organizationId, preview.workOrder.id)
  const marker = `AIDEN_PREPARED_ACTION_ID=${preparedActionId}`

  if (existing.length > 0) {
    const { data: detailRows, error: detErr } = await svc
      .from("org_invoices")
      .select("id, invoice_number, status, internal_notes")
      .eq("organization_id", organizationId)
      .in(
        "id",
        existing.map((e) => e.id),
      )

    if (detErr) {
      return { kind: "server_error", message: detErr.message }
    }

    const draftTagged: Array<{ invoiceId: string; invoiceNumber: string }> = []
    const blockingIds: string[] = []

    for (const inv of (detailRows ?? []) as Array<{
      id: string
      invoice_number: string
      status: string
      internal_notes: string | null
    }>) {
      const notes = String(inv.internal_notes ?? "")
      const tagged = notes.includes(marker)
      const ui = invoiceStatusDbToUi(inv.status)
      if (tagged && ui === "Draft") {
        draftTagged.push({ invoiceId: inv.id, invoiceNumber: inv.invoice_number })
      } else {
        blockingIds.push(inv.id)
      }
    }

    if (blockingIds.length > 0) {
      return {
        kind: "duplicate_risk",
        needsConfirmation: true,
        message:
          "This work order is already linked to another invoice. Avoid creating a duplicate unless finance confirms.",
      }
    }

    if (draftTagged.length > 1) {
      return {
        kind: "duplicate_risk",
        needsConfirmation: true,
        message: "Multiple draft invoices are tagged for this prepared action; resolve duplicates before continuing.",
      }
    }

    if (draftTagged.length === 1) {
      const r = draftTagged[0]
      return {
        kind: "success",
        invoiceId: r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        status: "draft",
        message: "Recovered an existing draft invoice for this prepared action.",
      }
    }
  }

  const lineItemsJson = previewLineItemsToLineItemJson(preview.lineItems, preparedActionId)
  const subtotalCentsFromLines = computeSubtotalCentsFromPreviewLineItems(preview.lineItems)
  const subtotalCentsFromPreview = Math.round(preview.subtotal * 100)
  const centsDelta = Math.abs(subtotalCentsFromLines - subtotalCentsFromPreview)
  if (centsDelta > 2) {
    return {
      kind: "duplicate_risk",
      needsConfirmation: true,
      message: "Line totals no longer match the prepared subtotal; refresh the preview before executing.",
    }
  }

  const amountCents = subtotalCentsFromLines

  const issuedAt = new Date().toISOString().slice(0, 10)
  const internalNotes = `AIDEN_PREPARED_ACTION_ID=${preparedActionId}\n${preview.sourceSummary ? `Source: ${preview.sourceSummary}` : ""}`.trim()

  const { data: authUser } = await userSupabase.auth.getUser()
  const actorUserId = authUser.user?.id ?? null

  const addr = billingAddressFromCustomerLike(preview.customer)
  const taxBasisResolved = taxBasisFromCustomerDefault(preview.customer.default_tax_basis)
  const resolution = await resolveSalesTaxForLines(userSupabase, {
    organizationId,
    customerId: preview.customer.id,
    preferAutomatic: true,
    lines: lineItemsForTaxEngine(lineItemsJson),
    taxBasis: taxBasisResolved,
    serviceAddress: addr,
    billingAddress: addr,
    customerTaxExempt: preview.customer.taxExempt === true,
    asOfYmd: issuedAt,
    persistLog: true,
    auditSourceType: "aiden_create_invoice_from_work_order",
    actorUserId,
  })

  const uiMode: TaxCalculationMode =
    resolution.status === "exempt" ? "exempt" : resolution.status !== "skipped" ? "automated" : "manual"
  const taxFromEngine = mapSalesTaxToInvoiceInsertFields({ resolution, uiMode })

  const taxAmountMajor =
    uiMode === "automated" && resolution.status !== "skipped"
      ? taxFromEngine.taxAmount
      : preview.taxEstimate == null
        ? null
        : preview.taxEstimate

  const insert = await insertOrgInvoice(
    userSupabase,
    {
      organizationId,
      customerId: preview.customer.id,
      equipmentId: woRow.equipment_id,
      workOrderId: preview.workOrder.id,
      quoteId: null,
      calibrationRecordId: null,
      title: preview.recommendedInvoiceTitle.trim() || "Invoice",
      amountCents,
      status: "Draft",
      issuedAt,
      dueDate: issuedAt,
      paidAt: null,
      lineItems: lineItemsJson,
      notes: preview.notes.trim() ? preview.notes.trim() : null,
      internalNotes: internalNotes.length ? internalNotes : null,
      billingCustomerId: preview.customer.id,
      billingName: preview.customer.billingName ?? preview.customer.companyName,
      billingContactName: preview.customer.billingContactName,
      billingContactEmail: preview.customer.billingEmail,
      billingContactPhone: preview.customer.billingContactPhone,
      billingAddressLine1: preview.customer.billingAddressLine1,
      billingAddressLine2: preview.customer.billingAddressLine2,
      billingCity: preview.customer.billingCity,
      billingState: preview.customer.billingState,
      billingPostalCode: preview.customer.billingPostalCode,
      billingCountry: preview.customer.billingCountry,
      taxCalculationMode: taxFromEngine.taxCalculationMode,
      taxBasis: taxFromEngine.taxBasis,
      taxJurisdictionLabel: taxFromEngine.taxJurisdictionLabel,
      taxRatePercent: taxFromEngine.taxRatePercent,
      taxAmount: taxAmountMajor,
      taxableSubtotal: taxFromEngine.taxableSubtotal,
      nonTaxableSubtotal: taxFromEngine.nonTaxableSubtotal,
      taxExemptionApplied: taxFromEngine.taxExemptionApplied,
      taxExemptionReason: taxFromEngine.taxExemptionReason,
      taxProvider: taxFromEngine.taxProvider,
      taxProviderReference: taxFromEngine.taxProviderReference,
      taxSnapshotJson: taxFromEngine.taxSnapshotJson,
    },
    { skipQuickBooksQueue: true, skipWorkOrderBillingStateSync: true },
  )

  if (insert.error || !insert.id) {
    return {
      kind: "server_error",
      message: insert.error ?? "Failed to create draft invoice.",
    }
  }

  const invoiceNumber = insert.invoiceNumber?.trim() || insert.id.slice(0, 8)

  return {
    kind: "success",
    invoiceId: insert.id,
    invoiceNumber,
    status: "draft",
    message: "Draft invoice created. Review and finalize from Invoices when ready.",
  }
}
