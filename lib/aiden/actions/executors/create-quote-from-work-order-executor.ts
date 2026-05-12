import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import type { CreateQuoteFromWorkOrderPreviewPayload } from "@/lib/aiden/actions/resolvers/create-quote-from-work-order-resolver"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { insertOrgQuote } from "@/lib/org-quotes-invoices/repository"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"
import { quoteStatusDbToUi } from "@/lib/org-quotes-invoices/map"
import type { OrgPermissions } from "@/lib/permissions/model"

const ACTION_ID: AidenPreparedWorkspaceActionId = "create_quote_from_work_order"

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

/** Maps quote preview line items to persisted `line_items` JSON (unit = dollars). */
export function quotePreviewLineItemsToLineItemJson(
  lineItems: CreateQuoteFromWorkOrderPreviewPayload["lineItems"],
  preparedActionId: string,
): LineItemJson[] {
  return lineItems.map((li, idx) => {
    const qty = li.quantity > 0 ? li.quantity : 1
    const unitDollars = li.unitCents / 100
    const kind = li.kind === "recommended" ? "recommended" : li.kind
    return {
      description: li.description.trim() || `Line ${idx + 1}`,
      qty,
      unit: unitDollars,
      source_ref: `aiden:${preparedActionId}:${kind}:${idx}`,
    }
  })
}

export function computeSubtotalCentsFromQuotePreviewLineItems(
  lineItems: CreateQuoteFromWorkOrderPreviewPayload["lineItems"],
): number {
  let sum = 0
  for (const li of lineItems) {
    sum += Math.round(li.lineTotalCents)
  }
  return sum
}

export function parseQuotePreviewPayloadFromPreparedAction(
  previewPayload: Record<string, unknown>,
):
  | { ok: true; preview: CreateQuoteFromWorkOrderPreviewPayload }
  | { ok: false; message: string } {
  const prev = previewPayload.preview
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

  const allowedKinds = new Set(["labor", "parts", "materials", "fee", "manual", "recommended"])
  const lineItems: CreateQuoteFromWorkOrderPreviewPayload["lineItems"] = []
  for (const raw of lineItemsRaw) {
    if (!isRecord(raw)) continue
    const kind = pickString(raw.kind)
    const description = pickString(raw.description) ?? ""
    const quantity = pickNumber(raw.quantity) ?? 0
    const unitCents = pickNumber(raw.unitCents)
    const lineTotalCents = pickNumber(raw.lineTotalCents)
    if (!kind || !allowedKinds.has(kind)) {
      return { ok: false, message: "Preview line item has invalid kind." }
    }
    if (unitCents == null || lineTotalCents == null) {
      return { ok: false, message: "Preview line item is missing cents fields." }
    }
    const sourceRaw = raw.source
    if (kind === "recommended") {
      lineItems.push({
        kind: "recommended",
        description,
        quantity,
        unitCents,
        lineTotalCents,
        source: "repair_log_task",
      })
      continue
    }
    const source: "work_order_line_items" | "work_order_totals" | "manual" =
      sourceRaw === "work_order_line_items"
        ? "work_order_line_items"
        : sourceRaw === "manual"
          ? "manual"
          : "work_order_totals"
    lineItems.push({
      kind: kind as "labor" | "parts" | "materials" | "fee" | "manual",
      description,
      quantity,
      unitCents,
      lineTotalCents,
      source,
    })
  }

  if (lineItems.length === 0) {
    return { ok: false, message: "Preview has no line items for this quote." }
  }

  const subtotal = pickNumber(prev.subtotal)
  const total = pickNumber(prev.total)
  if (subtotal == null || total == null) {
    return { ok: false, message: "Preview subtotal or total is missing." }
  }
  if (prev.taxEstimate !== null && prev.taxEstimate !== undefined) {
    return { ok: false, message: "Quote preview must not include tax estimate." }
  }

  const notes = pickString(prev.notes) ?? ""
  const recommendedQuoteTitle = pickString(prev.recommendedQuoteTitle) ?? "Quote"
  const sourceSummary = pickString(prev.sourceSummary) ?? ""
  const diagnosis = prev.diagnosis === null ? null : pickString(prev.diagnosis)
  const recommendedRepairsSummary =
    prev.recommendedRepairsSummary === null ? null : pickString(prev.recommendedRepairsSummary)

  const warnings: string[] = []
  if (Array.isArray(prev.warnings)) {
    for (const w of prev.warnings) {
      const s = pickString(w)
      if (s) warnings.push(s)
    }
  }

  const preview: CreateQuoteFromWorkOrderPreviewPayload = {
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
    taxEstimate: null,
    total,
    notes,
    diagnosis,
    recommendedRepairsSummary,
    warnings,
    recommendedQuoteTitle,
    sourceSummary,
  }

  return { ok: true, preview }
}

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

async function reassertCanPrepare(args: {
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

async function findDraftQuoteByPreparedActionMarker(
  svc: SupabaseClient,
  organizationId: string,
  preparedActionId: string,
): Promise<{ id: string } | null> {
  const marker = `%AIDEN_PREPARED_ACTION_ID=${preparedActionId}%`
  const { data, error } = await svc
    .from("org_quotes")
    .select("id, internal_notes, status")
    .eq("organization_id", organizationId)
    .ilike("internal_notes", marker)
    .limit(10)

  if (error || !data) return null
  for (const row of data as Array<{ id: string; internal_notes: string | null; status: string }>) {
    if (quoteStatusDbToUi(row.status) === "Draft") {
      return { id: row.id }
    }
  }
  return null
}

export type ExecuteCreateQuoteFromWorkOrderDraftArgs = {
  svc: SupabaseClient
  userSupabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

export type CreateQuoteFromWorkOrderExecutorResult =
  | { kind: "success"; quoteId: string; message: string }
  | { kind: "idempotent"; quoteId: string; message: string }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

function defaultExpiresAtIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 30)
  return d.toISOString().slice(0, 10)
}

/**
 * Creates a **draft** `org_quotes` row from a **confirmed** prepared action. Does not send the quote.
 */
export async function executeCreateQuoteFromWorkOrderDraft(
  args: ExecuteCreateQuoteFromWorkOrderDraftArgs,
): Promise<CreateQuoteFromWorkOrderExecutorResult> {
  const { svc, userSupabase, organizationId, permissions, preparedActionId, row, platformAdminPlanBypass } = args

  if (row.organization_id !== organizationId) {
    return { kind: "validation_error", message: "Prepared action does not belong to this organization." }
  }
  if (row.action_id !== ACTION_ID) {
    return { kind: "validation_error", message: "Prepared action is not create_quote_from_work_order." }
  }

  const canStill = await reassertCanPrepare({
    supabase: userSupabase,
    organizationId,
    permissions,
    platformAdminPlanBypass,
  })
  if (!canStill) {
    return { kind: "permission_denied", message: "You no longer have permission to create this quote." }
  }

  if (row.status === "completed" && row.target_record_id && UUID_RE.test(row.target_record_id)) {
    const { data: q, error } = await svc
      .from("org_quotes")
      .select("id, status, organization_id")
      .eq("organization_id", organizationId)
      .eq("id", row.target_record_id)
      .maybeSingle()
    if (error) return { kind: "server_error", message: error.message }
    const r = q as { id: string; status: string } | null
    if (!r) {
      return { kind: "validation_error", message: "Previously created quote is no longer available." }
    }
    if (quoteStatusDbToUi(r.status) !== "Draft") {
      return {
        kind: "validation_error",
        message: "This prepared action was already executed; the quote is no longer a draft.",
      }
    }
    return {
      kind: "idempotent",
      quoteId: r.id,
      message: "Draft quote already exists for this prepared action.",
    }
  }

  if (row.status !== "confirmed") {
    return { kind: "validation_error", message: "Prepared action must be confirmed before execution." }
  }

  const parsed = parseQuotePreviewPayloadFromPreparedAction(row.preview_payload ?? {})
  if (!parsed.ok) {
    return { kind: "validation_error", message: parsed.message }
  }
  const preview = parsed.preview

  const recovered = await findDraftQuoteByPreparedActionMarker(svc, organizationId, preparedActionId)
  if (recovered) {
    return {
      kind: "idempotent",
      quoteId: recovered.id,
      message: "Recovered an existing draft quote for this prepared action.",
    }
  }

  const { data: wo, error: woErr } = await userSupabase
    .from("work_orders")
    .select("id, customer_id, equipment_id, organization_id, is_archived")
    .eq("organization_id", organizationId)
    .eq("id", preview.workOrder.id)
    .maybeSingle()

  if (woErr) return { kind: "server_error", message: woErr.message }
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

  if (custErr) return { kind: "server_error", message: custErr.message }
  if (!cust) {
    return { kind: "validation_error", message: "Customer was not found or is no longer active." }
  }

  const lineItemsJson = quotePreviewLineItemsToLineItemJson(preview.lineItems, preparedActionId)
  const subtotalCentsFromLines = computeSubtotalCentsFromQuotePreviewLineItems(preview.lineItems)
  const subtotalCentsFromPreview = Math.round(preview.subtotal * 100)
  if (Math.abs(subtotalCentsFromLines - subtotalCentsFromPreview) > 2) {
    return {
      kind: "validation_error",
      message: "Line totals no longer match the prepared subtotal; refresh the preview before executing.",
    }
  }

  const internalNotes = `AIDEN_PREPARED_ACTION_ID=${preparedActionId}\n${preview.sourceSummary ? `Source: ${preview.sourceSummary}` : ""}`.trim()

  const insert = await insertOrgQuote(userSupabase, {
    organizationId,
    customerId: preview.customer.id,
    equipmentId: woRow.equipment_id,
    workOrderId: preview.workOrder.id,
    title: preview.recommendedQuoteTitle.trim() || "Quote",
    amountCents: subtotalCentsFromLines,
    status: "Draft",
    expiresAt: defaultExpiresAtIso(),
    lineItems: lineItemsJson,
    notes: preview.notes.trim() ? preview.notes.trim() : null,
    internalNotes: internalNotes.length ? internalNotes : null,
    sentAt: null,
  })

  if (insert.error || !insert.id) {
    return { kind: "server_error", message: insert.error ?? "Failed to create draft quote." }
  }

  return {
    kind: "success",
    quoteId: insert.id,
    message: "Draft quote created. Review and send from Quotes when ready — nothing is emailed automatically.",
  }
}
