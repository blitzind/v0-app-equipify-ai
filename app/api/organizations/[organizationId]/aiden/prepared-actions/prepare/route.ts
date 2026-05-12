import { NextResponse } from "next/server"
import { z } from "zod"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { getPreparedWorkspaceActionDefinition, requiresAidenConfirmation } from "@/lib/aiden/actions/action-registry"
import { getMinimumPlanForPreparedWorkspaceAction } from "@/lib/aiden/prepared-workspace-tier-policy"
import { isAidenPreparedWorkspaceTierGatingEnabled } from "@/lib/aiden/prepared-workspace-tier-gate-env"
import { insertPreparedAction, updatePreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import type { AidenPreparedActionStatus } from "@/lib/aiden/actions/prepared-action-status"
import { resolveCreateInvoiceFromWorkOrderPreview } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import { resolveCreateQuoteFromWorkOrderPreview } from "@/lib/aiden/actions/resolvers/create-quote-from-work-order-resolver"
import { resolvePrepareInvoicePaymentLinkPreview } from "@/lib/aiden/actions/resolvers/prepare-invoice-payment-link-resolver"
import { resolveDraftCustomerMessagePreview } from "@/lib/aiden/actions/resolvers/draft-customer-message-resolver"
import { resolvePrepareQuickBooksInvoiceSyncPreview } from "@/lib/aiden/actions/resolvers/prepare-quickbooks-invoice-sync-resolver"
import { resolveSummarizeCustomerHistoryPreview } from "@/lib/aiden/actions/resolvers/summarize-customer-history-resolver"
import { resolveCreateFollowUpTaskPreview } from "@/lib/aiden/actions/resolvers/create-follow-up-task-resolver"
import { resolveScheduleMaintenanceVisitPreview } from "@/lib/aiden/actions/resolvers/schedule-maintenance-visit-resolver"
import { resolveCreateMaintenancePlanFromEquipmentPreview } from "@/lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-resolver"
import { resolveCreatePartsReorderRequestPreview } from "@/lib/aiden/actions/resolvers/create-parts-reorder-request-resolver"
import { resolveBulkInvoiceCompletedWorkOrdersPreview } from "@/lib/aiden/actions/resolvers/create-bulk-invoice-completed-work-orders-resolver"
import { parsePreparedWorkspaceIntentWithOptionalLlm } from "@/lib/aiden/intent/parse-prepared-workspace-intent-with-optional-llm"
import type { AidenIntentSourceContext } from "@/lib/aiden/intent/intent-types"
import {
  assertAidenActionsEnabled,
  assertFinancialActionAllowedForTechnician,
  canPrepareWorkspaceActionForUser,
  diagnoseWorkspacePrepareDenialForUser,
  definitionRequiresExplicitConfirmation,
  getServiceRoleOrNull,
  isPreparedWorkspaceActionId,
  serializePreparedAction,
  UUID_RE,
} from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import type { AidenPreparedWorkspaceRouteGate } from "@/lib/aiden/prepared-workspace-route-gate"

export const runtime = "nodejs"

const BodySchema = z.object({
  message: z.string().trim().min(1).max(20_000),
  context: z.record(z.unknown()).optional(),
})

function contextToSourceContext(context: Record<string, unknown> | undefined): {
  sourceContext?: AidenIntentSourceContext
} {
  if (!context || typeof context !== "object") return {}
  const workOrderId = typeof context.workOrderId === "string" ? context.workOrderId.trim() : undefined
  const customerId = typeof context.customerId === "string" ? context.customerId.trim() : undefined
  const equipmentId = typeof context.equipmentId === "string" ? context.equipmentId.trim() : undefined
  const invoiceId = typeof context.invoiceId === "string" ? context.invoiceId.trim() : undefined
  const quoteId = typeof context.quoteId === "string" ? context.quoteId.trim() : undefined
  const maintenancePlanId =
    typeof context.maintenancePlanId === "string" ? context.maintenancePlanId.trim() : undefined
  const workOrderLabel = typeof context.workOrderLabel === "string" ? context.workOrderLabel : undefined
  const customerLabel = typeof context.customerLabel === "string" ? context.customerLabel : undefined
  const paymentLinkUrlRaw = typeof context.paymentLinkUrl === "string" ? context.paymentLinkUrl.trim() : undefined
  let paymentLinkUrl: string | undefined
  if (paymentLinkUrlRaw && paymentLinkUrlRaw.length <= 2048 && /^https:\/\//i.test(paymentLinkUrlRaw)) {
    try {
      const u = new URL(paymentLinkUrlRaw)
      if (u.protocol === "https:" && u.hostname && u.hostname !== "localhost") paymentLinkUrl = paymentLinkUrlRaw
    } catch {
      /* ignore */
    }
  }
  const sc: AidenIntentSourceContext = {}
  if (workOrderId) sc.workOrderId = workOrderId
  if (customerId) sc.customerId = customerId
  if (equipmentId) sc.equipmentId = equipmentId
  if (invoiceId) sc.invoiceId = invoiceId
  if (quoteId) sc.quoteId = quoteId
  if (maintenancePlanId) sc.maintenancePlanId = maintenancePlanId
  if (workOrderLabel) sc.workOrderLabel = workOrderLabel
  if (customerLabel) sc.customerLabel = customerLabel
  if (paymentLinkUrl) sc.paymentLinkUrl = paymentLinkUrl
  return Object.keys(sc).length > 0 ? { sourceContext: sc } : {}
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const enabled = await assertAidenActionsEnabled(gate.supabase, organizationId)
  if (enabled !== true) return enabled.error

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const intentParseResult = await parsePreparedWorkspaceIntentWithOptionalLlm({
    organizationId,
    userMessage: body.message,
    options: contextToSourceContext(body.context),
  })
  const parsedIntent = intentParseResult.parsedIntent
  const intentNormalized = body.message.trim().replace(/\s+/g, " ").toLowerCase()

  if (parsedIntent.status === "unsupported") {
    return NextResponse.json(
      { error: "unsupported_intent", message: "Could not interpret that request as a supported workspace action." },
      { status: 400 },
    )
  }

  if (!parsedIntent.actionId || parsedIntent.missingFields.includes("actionIntent")) {
    return NextResponse.json(
      {
        error: "ambiguous_intent",
        message: "That request matches more than one action. Please be more specific.",
        parsedIntent,
      },
      { status: 422 },
    )
  }

  if (!isPreparedWorkspaceActionId(parsedIntent.actionId)) {
    return NextResponse.json({ error: "unknown_action", message: "Unsupported prepared workspace action id." }, { status: 400 })
  }

  const def = getPreparedWorkspaceActionDefinition(parsedIntent.actionId)
  if (!def) {
    return NextResponse.json({ error: "unknown_action", message: "Unsupported prepared workspace action id." }, { status: 400 })
  }

  const techOk = assertFinancialActionAllowedForTechnician(gate.permissions, parsedIntent.actionId)
  if (techOk !== true) return techOk.error

  const routeGate: AidenPreparedWorkspaceRouteGate = {
    sessionPermissions: gate.permissions,
    platformAdminPlanBypass: gate.isPlatformAdmin,
  }

  const canPrepare = await canPrepareWorkspaceActionForUser({
    supabase: gate.supabase,
    organizationId,
    permissions: gate.permissions,
    actionId: parsedIntent.actionId,
    isPlatformAdmin: gate.isPlatformAdmin,
  })
  if (!canPrepare) {
    if (isAidenPreparedWorkspaceTierGatingEnabled()) {
      const denial = await diagnoseWorkspacePrepareDenialForUser({
        supabase: gate.supabase,
        organizationId,
        permissions: gate.permissions,
        actionId: parsedIntent.actionId,
      })
      if (denial === "plan") {
        const minPlan = getMinimumPlanForPreparedWorkspaceAction(parsedIntent.actionId)
        return NextResponse.json(
          {
            error: "plan_upgrade_required",
            message: `This action requires ${minPlan} or higher on your billing plan. Ask an owner to upgrade in Settings → Billing.`,
            requiredPlan: minPlan,
            actionId: parsedIntent.actionId,
          },
          { status: 403 },
        )
      }
    }
    return NextResponse.json(
      {
        error: "insufficient_permissions",
        message: "You do not have permission to prepare this action for this workspace.",
      },
      { status: 403 },
    )
  }

  const svc = getServiceRoleOrNull()
  if (!svc) {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  let rowStatus: AidenPreparedActionStatus = "prepared"
  let resolvedPayload: Record<string, unknown> = {
    parsedIntent,
    intentParse: intentParseResult.parseMeta,
  }
  if (intentParseResult.suggestedDraftCopy) {
    resolvedPayload = { ...resolvedPayload, suggestedDraftCopy: intentParseResult.suggestedDraftCopy }
  }
  let previewPayload: Record<string, unknown> = {}
  let errorMessage: string | null = null

  if (parsedIntent.status === "needs_clarification") {
    rowStatus = "needs_clarification"
    previewPayload = { parsedIntent }
  } else if (parsedIntent.status === "prepared") {
    if (parsedIntent.actionId === "create_invoice_from_work_order") {
      const woRef = parsedIntent.workOrderReference ?? "latest"
      const res = await resolveCreateInvoiceFromWorkOrderPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        customerReference: parsedIntent.customerReference,
        customerId: parsedIntent.sourceContext?.customerId,
        workOrderReference: woRef,
        routeGate,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: "customerCandidates" in res ? res.customerCandidates : [],
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "bulk_invoice_completed_work_orders") {
      const dr = parsedIntent.bulkInvoiceDateRange
      if (!dr) {
        rowStatus = "failed"
        errorMessage = "Missing date range for bulk invoice intent."
        previewPayload = { reason: "missing_bulk_date_range" }
      } else {
        const res = await resolveBulkInvoiceCompletedWorkOrdersPreview(gate.supabase, {
          organizationId,
          userId: gate.userId,
          dateRange: {
            rangeStartIso: dr.rangeStartIso,
            rangeEndIso: dr.rangeEndIso,
            label: dr.label,
          },
          customerReference: parsedIntent.customerReference,
          customerId: parsedIntent.sourceContext?.customerId,
          routeGate,
        })
        resolvedPayload = { ...resolvedPayload, resolver: res }
        if (res.status === "prepared") {
          previewPayload = { preview: res.preview }
          rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
        } else if (res.status === "needs_clarification") {
          rowStatus = "needs_clarification"
          previewPayload = {
            resolverStatus: res.status,
            reason: res.reason,
            customerCandidates: res.customerCandidates,
          }
        } else {
          rowStatus = "failed"
          errorMessage = res.reason
          previewPayload = { resolverStatus: res.status, reason: res.reason }
        }
      }
    } else if (parsedIntent.actionId === "create_quote_from_work_order") {
      const woRef = parsedIntent.workOrderReference ?? "latest"
      const res = await resolveCreateQuoteFromWorkOrderPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        customerReference: parsedIntent.customerReference,
        customerId: parsedIntent.sourceContext?.customerId,
        workOrderReference: woRef,
        routeGate,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: "customerCandidates" in res ? res.customerCandidates : [],
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "prepare_invoice_payment_link") {
      const invId = parsedIntent.sourceContext?.invoiceId?.trim()
      if (!invId) {
        rowStatus = "failed"
        errorMessage = "Missing invoice id in context."
        previewPayload = { reason: "missing_invoice_id" }
      } else {
        const res = await resolvePrepareInvoicePaymentLinkPreview(gate.supabase, {
          organizationId,
          userId: gate.userId,
          invoiceId: invId,
        })
        resolvedPayload = { ...resolvedPayload, resolver: res }
        if (res.status === "prepared") {
          previewPayload = { preview: res.preview }
          rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
        } else {
          rowStatus = "failed"
          errorMessage = res.reason
          previewPayload = { resolverStatus: res.status, reason: res.reason }
        }
      }
    } else if (parsedIntent.actionId === "draft_customer_message") {
      const ctx = parsedIntent.sourceContext
      const res = await resolveDraftCustomerMessagePreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        invoiceId: ctx?.invoiceId,
        workOrderId: ctx?.workOrderId,
        quoteId: ctx?.quoteId,
        equipmentId: ctx?.equipmentId,
        customerId: ctx?.customerId,
        paymentLinkUrl: ctx?.paymentLinkUrl,
        customerReference: parsedIntent.customerReference,
        intentNormalized,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: res.customerCandidates,
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "prepare_quickbooks_invoice_sync") {
      const invId = parsedIntent.sourceContext?.invoiceId?.trim()
      if (!invId) {
        rowStatus = "failed"
        errorMessage = "Missing invoice id in context."
        previewPayload = { reason: "missing_invoice_id" }
      } else {
        const res = await resolvePrepareQuickBooksInvoiceSyncPreview(gate.supabase, {
          organizationId,
          invoiceId: invId,
        })
        resolvedPayload = { ...resolvedPayload, resolver: res }
        if (res.status === "prepared") {
          previewPayload = { preview: res.preview }
          rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
        } else {
          rowStatus = "failed"
          errorMessage = res.reason
          previewPayload = { resolverStatus: res.status, reason: res.reason }
        }
      }
    } else if (parsedIntent.actionId === "summarize_customer_history") {
      const res = await resolveSummarizeCustomerHistoryPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        permissions: gate.permissions,
        customerReference: parsedIntent.customerReference,
        customerId: parsedIntent.sourceContext?.customerId,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: res.customerCandidates,
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "create_follow_up_task") {
      const ctx = parsedIntent.sourceContext
      const res = await resolveCreateFollowUpTaskPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        invoiceId: ctx?.invoiceId,
        quoteId: ctx?.quoteId,
        workOrderId: ctx?.workOrderId,
        equipmentId: ctx?.equipmentId,
        maintenancePlanId: ctx?.maintenancePlanId,
        customerId: ctx?.customerId,
        customerReference: parsedIntent.customerReference,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: res.customerCandidates,
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "schedule_maintenance_visit") {
      const ctx = parsedIntent.sourceContext
      const res = await resolveScheduleMaintenanceVisitPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        userMessage: body.message,
        maintenancePlanId: ctx?.maintenancePlanId,
        equipmentId: ctx?.equipmentId,
        customerId: ctx?.customerId,
        customerReference: parsedIntent.customerReference,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: res.customerCandidates,
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "create_parts_reorder_request") {
      const ctx = parsedIntent.sourceContext
      const res = await resolveCreatePartsReorderRequestPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        userMessage: body.message,
        workOrderId: ctx?.workOrderId,
        equipmentId: ctx?.equipmentId,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: res.customerCandidates,
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else if (parsedIntent.actionId === "create_maintenance_plan_from_equipment") {
      const ctx = parsedIntent.sourceContext
      const res = await resolveCreateMaintenancePlanFromEquipmentPreview(gate.supabase, {
        organizationId,
        userId: gate.userId,
        userMessage: body.message,
        equipmentId: ctx?.equipmentId,
        customerId: ctx?.customerId,
        customerReference: parsedIntent.customerReference,
        equipmentReference: parsedIntent.equipmentReference,
      })
      resolvedPayload = { ...resolvedPayload, resolver: res }
      if (res.status === "prepared") {
        previewPayload = { preview: res.preview }
        rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      } else if (res.status === "needs_clarification") {
        rowStatus = "needs_clarification"
        previewPayload = {
          resolverStatus: res.status,
          reason: res.reason,
          customerCandidates: res.customerCandidates,
        }
      } else {
        rowStatus = "failed"
        errorMessage = res.reason
        previewPayload = { resolverStatus: res.status, reason: res.reason }
      }
    } else {
      rowStatus = definitionRequiresExplicitConfirmation(parsedIntent.actionId) ? "ready_for_confirmation" : "prepared"
      previewPayload = {
        note: "resolver_not_yet_available",
        actionId: parsedIntent.actionId,
      }
    }
  }

  const insert = await insertPreparedAction(svc, {
    organization_id: organizationId,
    requested_by: gate.userId,
    action_id: parsedIntent.actionId,
    risk_level: def.riskLevel,
    status: rowStatus,
    input_payload: {
      message: body.message,
      context: body.context ?? null,
      parsedIntent,
      intentParse: intentParseResult.parseMeta,
    },
    resolved_payload: resolvedPayload,
    preview_payload: previewPayload,
    confidence_score: parsedIntent.confidenceScore,
    requires_confirmation: requiresAidenConfirmation(def),
    error_message: errorMessage,
  })

  if (insert.error || !insert.data) {
    return NextResponse.json(
      { error: "insert_failed", message: insert.error?.message ?? "Insert failed." },
      { status: 500 },
    )
  }

  const audit = await insertActionAuditLog(svc, {
    organization_id: organizationId,
    prepared_action_id: insert.data.id,
    actor_user_id: gate.userId,
    event_type: "prepared_action_created",
    action_id: parsedIntent.actionId,
    details: { status: insert.data.status },
  })
  if (audit.error) {
    return NextResponse.json({ error: "audit_failed", message: audit.error.message }, { status: 500 })
  }

  let rowOut = insert.data
  if (
    parsedIntent.actionId === "summarize_customer_history" &&
    rowStatus === "prepared" &&
    !errorMessage &&
    previewPayload &&
    typeof previewPayload === "object" &&
    "preview" in previewPayload
  ) {
    const pv = previewPayload as { preview?: { customer?: { id?: string } } }
    const cid = pv.preview?.customer?.id?.trim()
    if (cid && UUID_RE.test(cid)) {
      const now = new Date().toISOString()
      const upd = await updatePreparedActionById(svc, organizationId, insert.data.id, {
        status: "completed",
        executed_by: gate.userId,
        executed_at: now,
        target_record_type: "customer",
        target_record_id: cid,
        execution_payload: { readOnlySummary: true, customerId: cid },
      })
      if (upd.error || !upd.data) {
        return NextResponse.json(
          { error: "update_failed", message: upd.error?.message ?? "Could not finalize read-only summary." },
          { status: 500 },
        )
      }
      rowOut = upd.data
      const execAudit = await insertActionAuditLog(svc, {
        organization_id: organizationId,
        prepared_action_id: insert.data.id,
        actor_user_id: gate.userId,
        event_type: "prepared_action_execution_completed",
        action_id: parsedIntent.actionId,
        details: { readOnlySummary: true, customerId: cid },
      })
      if (execAudit.error) {
        return NextResponse.json({ error: "audit_failed", message: execAudit.error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ preparedAction: serializePreparedAction(rowOut) })
}
