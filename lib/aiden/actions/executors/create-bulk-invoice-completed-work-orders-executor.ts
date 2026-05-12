import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { bulkInvoiceConfirmationPhraseMatches } from "@/lib/aiden/actions/bulk-invoice-confirmation"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import {
  listActiveInvoicesForWorkOrder,
  workOrderIsAlreadyInvoiced,
  type CreateInvoiceFromWorkOrderPreviewPayload,
} from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import {
  computeSubtotalCentsFromPreviewLineItems,
  previewLineItemsToLineItemJson,
} from "@/lib/aiden/actions/executors/create-invoice-from-work-order-executor"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { insertOrgInvoice } from "@/lib/org-quotes-invoices/repository"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"
import type { OrgPermissions } from "@/lib/permissions/model"
import { parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction } from "@/lib/aiden/prepared-actions/bulk-invoice-completed-work-orders-preview-parse"

const ACTION_ID = "bulk_invoice_completed_work_orders" as const

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

async function reassertCanBulkInvoice(args: {
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
    "bulk_invoice_completed_work_orders",
  )
}

export type BulkInvoiceRowExecutionResult =
  | { workOrderId: string; invoiceId: string; invoiceNumber: string; status: "draft" }
  | { workOrderId: string; skipped: true; reason: string }
  | { workOrderId: string; error: string }

export type BulkInvoiceCompletedWorkOrdersExecutorResult =
  | {
      kind: "success"
      message: string
      results: BulkInvoiceRowExecutionResult[]
      succeeded: number
      failed: number
      skipped: number
    }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecuteBulkInvoiceCompletedWorkOrdersArgs = {
  svc: SupabaseClient
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  bulkConfirmationPhrase?: string | null
  platformAdminPlanBypass?: boolean
}

export async function executeBulkInvoiceCompletedWorkOrdersDraft(
  args: ExecuteBulkInvoiceCompletedWorkOrdersArgs,
): Promise<BulkInvoiceCompletedWorkOrdersExecutorResult> {
  const { svc, userSupabase, organizationId, userId, permissions, preparedActionId, row, bulkConfirmationPhrase, platformAdminPlanBypass } =
    args

  if (row.organization_id !== organizationId) {
    return { kind: "validation_error", message: "Prepared action does not belong to this organization." }
  }

  if (row.action_id !== ACTION_ID) {
    return { kind: "validation_error", message: "Prepared action is not bulk_invoice_completed_work_orders." }
  }

  if (!bulkInvoiceConfirmationPhraseMatches(bulkConfirmationPhrase ?? "")) {
    return {
      kind: "validation_error",
      message: "Type the confirmation phrase exactly to create draft invoices in bulk.",
    }
  }

  const canStill = await reassertCanBulkInvoice({
    supabase: userSupabase,
    organizationId,
    permissions,
    platformAdminPlanBypass,
  })
  if (!canStill) {
    return { kind: "permission_denied", message: "You no longer have permission to run this bulk invoice action." }
  }

  if (row.status === "completed") {
    const ep = row.execution_payload as { bulk?: boolean; results?: BulkInvoiceRowExecutionResult[] } | null
    if (ep?.bulk === true && Array.isArray(ep.results)) {
      let s = 0
      let f = 0
      let k = 0
      for (const r of ep.results) {
        if ("invoiceId" in r) s += 1
        else if ("skipped" in r) k += 1
        else if ("error" in r) f += 1
      }
      return {
        kind: "success",
        message: "Bulk draft invoices were already created for this prepared action.",
        results: ep.results,
        succeeded: s,
        failed: f,
        skipped: k,
      }
    }
  }

  if (row.status !== "confirmed") {
    return { kind: "validation_error", message: "Prepared action must be confirmed before execution." }
  }

  const parsed = parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction(row.preview_payload ?? {})
  if (!parsed.ok) {
    return { kind: "validation_error", message: parsed.message }
  }
  const batch = parsed.preview

  const excluded = new Set(batch.excludedWorkOrderIds)
  const out: BulkInvoiceRowExecutionResult[] = []
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const item of batch.items) {
    if (excluded.has(item.workOrderId)) {
      skipped += 1
      out.push({ workOrderId: item.workOrderId, skipped: true, reason: "Excluded in preview." })
      continue
    }

    const preview = item.invoicePreview
    const woId = preview.workOrder.id

    const { data: wo, error: woErr } = await userSupabase
      .from("work_orders")
      .select("id, customer_id, equipment_id, organization_id, is_archived, status, completed_at")
      .eq("organization_id", organizationId)
      .eq("id", woId)
      .maybeSingle()

    if (woErr) {
      failed += 1
      out.push({ workOrderId: woId, error: woErr.message })
      continue
    }
    const woRow = wo as {
      id: string
      customer_id: string
      equipment_id: string | null
      organization_id: string
      is_archived: boolean | null
      status: string
      completed_at: string | null
    } | null

    if (!woRow || woRow.is_archived || woRow.status !== "completed") {
      failed += 1
      out.push({ workOrderId: woId, error: "Work order is not available or is no longer completed." })
      continue
    }

    if (woRow.customer_id !== preview.customer.id) {
      failed += 1
      out.push({ workOrderId: woId, error: "Work order customer no longer matches the preview." })
      continue
    }

    if (await workOrderIsAlreadyInvoiced(userSupabase, organizationId, woId)) {
      skipped += 1
      out.push({ workOrderId: woId, skipped: true, reason: "Work order was invoiced after the preview was built." })
      continue
    }

    const { data: cust } = await userSupabase
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", preview.customer.id)
      .eq("status", "active")
      .eq("is_archived", false)
      .maybeSingle()

    if (!cust) {
      failed += 1
      out.push({ workOrderId: woId, error: "Customer was not found or is no longer active." })
      continue
    }

    const existing = await listActiveInvoicesForWorkOrder(svc, organizationId, woId)
    const marker = `AIDEN_PREPARED_ACTION_ID=${preparedActionId}`
    const bulkMarker = `AIDEN_BULK_WORK_ORDER_ID=${woId}`

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
        failed += 1
        out.push({ workOrderId: woId, error: detErr.message })
        continue
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
        const tagged = notes.includes(marker) && notes.includes(bulkMarker)
        const ui = invoiceStatusDbToUi(inv.status)
        if (tagged && ui === "Draft") {
          draftTagged.push({ invoiceId: inv.id, invoiceNumber: inv.invoice_number })
        } else {
          blockingIds.push(inv.id)
        }
      }

      if (blockingIds.length > 0) {
        skipped += 1
        out.push({
          workOrderId: woId,
          skipped: true,
          reason: "Another active invoice is already linked to this work order.",
        })
        continue
      }

      if (draftTagged.length === 1) {
        succeeded += 1
        out.push({
          workOrderId: woId,
          invoiceId: draftTagged[0].invoiceId,
          invoiceNumber: draftTagged[0].invoiceNumber,
          status: "draft",
        })
        await insertActionAuditLog(svc, {
          organization_id: organizationId,
          prepared_action_id: preparedActionId,
          actor_user_id: userId,
          event_type: "bulk_invoice_draft_created",
          action_id: ACTION_ID,
          details: {
            workOrderId: woId,
            invoiceId: draftTagged[0].invoiceId,
            invoiceNumber: draftTagged[0].invoiceNumber,
            idempotent: true,
          },
        })
        continue
      }
    }

    const lineItemsJson = previewLineItemsToLineItemJson(preview.lineItems, preparedActionId, {
      bulkWorkOrderId: woId,
    })
    const subtotalCentsFromLines = computeSubtotalCentsFromPreviewLineItems(preview.lineItems)
    const subtotalCentsFromPreview = Math.round(preview.subtotal * 100)
    const centsDelta = Math.abs(subtotalCentsFromLines - subtotalCentsFromPreview)
    if (centsDelta > 2) {
      failed += 1
      out.push({ workOrderId: woId, error: "Line totals no longer match the prepared subtotal." })
      continue
    }

    const amountCents = subtotalCentsFromLines
    const taxAmountMajor = preview.taxEstimate == null ? null : preview.taxEstimate

    const issuedAt = new Date().toISOString().slice(0, 10)
    const internalNotes =
      `${marker}\n${bulkMarker}\n${preview.sourceSummary ? `Source: ${preview.sourceSummary}` : ""}`.trim()

    const insert = await insertOrgInvoice(
      userSupabase,
      {
        organizationId,
        customerId: preview.customer.id,
        equipmentId: woRow.equipment_id,
        workOrderId: woId,
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
        taxAmount: taxAmountMajor,
        taxExemptionApplied: preview.customer.taxExempt === true,
      },
      { skipQuickBooksQueue: true, skipWorkOrderBillingStateSync: true },
    )

    if (insert.error || !insert.id) {
      failed += 1
      out.push({ workOrderId: woId, error: insert.error ?? "Failed to create draft invoice." })
      continue
    }

    succeeded += 1
    out.push({
      workOrderId: woId,
      invoiceId: insert.id,
      invoiceNumber: insert.invoiceNumber?.trim() || insert.id.slice(0, 8),
      status: "draft",
    })
    await insertActionAuditLog(svc, {
      organization_id: organizationId,
      prepared_action_id: preparedActionId,
      actor_user_id: userId,
      event_type: "bulk_invoice_draft_created",
      action_id: ACTION_ID,
      details: {
        workOrderId: woId,
        invoiceId: insert.id,
        invoiceNumber: insert.invoiceNumber?.trim() || insert.id.slice(0, 8),
      },
    })
  }

  const message =
    succeeded === 0 && failed === 0 ?
      "No draft invoices were created (all rows were skipped or excluded)."
    : `Created ${succeeded} draft invoice(s). ${failed ? `${failed} failed.` : ""}${skipped ? ` ${skipped} skipped.` : ""}`.trim()

  return {
    kind: "success",
    message,
    results: out,
    succeeded,
    failed,
    skipped,
  }
}
