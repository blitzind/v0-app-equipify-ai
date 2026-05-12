import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import {
  executeBulkInvoiceCompletedWorkOrdersDraft,
  type BulkInvoiceCompletedWorkOrdersExecutorResult,
} from "@/lib/aiden/actions/executors/create-bulk-invoice-completed-work-orders-executor"
import {
  executeCreateInvoiceFromWorkOrderDraft,
  type CreateInvoiceFromWorkOrderExecutorResult,
} from "@/lib/aiden/actions/executors/create-invoice-from-work-order-executor"
import {
  executeCreateQuoteFromWorkOrderDraft,
  type CreateQuoteFromWorkOrderExecutorResult,
} from "@/lib/aiden/actions/executors/create-quote-from-work-order-executor"
import {
  executePrepareInvoicePaymentLink,
  type PrepareInvoicePaymentLinkExecutorResult,
} from "@/lib/aiden/actions/executors/prepare-invoice-payment-link-executor"
import {
  executeDraftCustomerMessage,
  type DraftCustomerMessageExecutorResult,
} from "@/lib/aiden/actions/executors/draft-customer-message-executor"
import {
  executePrepareQuickBooksInvoiceSync,
  type PrepareQuickBooksInvoiceSyncExecutorResult,
} from "@/lib/aiden/actions/executors/prepare-quickbooks-invoice-sync-executor"
import {
  executeCreateFollowUpTask,
  type CreateFollowUpTaskExecutorResult,
} from "@/lib/aiden/actions/executors/create-follow-up-task-executor"
import {
  executeScheduleMaintenanceVisit,
  type ScheduleMaintenanceVisitExecutorResult,
} from "@/lib/aiden/actions/executors/schedule-maintenance-visit-executor"
import {
  executeCreateMaintenancePlanFromEquipment,
  type CreateMaintenancePlanFromEquipmentExecutorResult,
} from "@/lib/aiden/actions/executors/create-maintenance-plan-from-equipment-executor"
import {
  executeCreatePartsReorderRequest,
  type CreatePartsReorderRequestExecutorResult,
} from "@/lib/aiden/actions/executors/create-parts-reorder-request-executor"
import { getPreparedActionById, updatePreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import { getPreparedWorkspaceActionDefinition, isFinancialAidenAction } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import {
  canPrepareWorkspaceActionForUser,
  serializePreparedAction,
  UUID_RE,
} from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"
import { recordNotImplementedExecutionAndRespond } from "@/lib/aiden/prepared-actions/record-not-implemented-execution"
import type { OrgPermissions } from "@/lib/permissions/model"

function mapQuoteExecutorFailureToResponse(
  exec: Extract<
    CreateQuoteFromWorkOrderExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapInvoiceExecutorFailureToResponse(
  exec: Extract<
    CreateInvoiceFromWorkOrderExecutorResult,
    | { kind: "validation_error" }
    | { kind: "permission_denied" }
    | { kind: "duplicate_risk" }
    | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "duplicate_risk":
      return NextResponse.json(
        {
          error: "duplicate_invoice_risk",
          message: exec.message,
          needsConfirmation: exec.needsConfirmation,
        },
        { status: 409 },
      )
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapDraftMessageExecutorFailureToResponse(
  exec: Extract<
    DraftCustomerMessageExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapPaymentLinkExecutorFailureToResponse(
  exec: Extract<
    PrepareInvoicePaymentLinkExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapQuickBooksInvoiceSyncExecutorFailureToResponse(
  exec: Extract<
    PrepareQuickBooksInvoiceSyncExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapCreateFollowUpTaskExecutorFailureToResponse(
  exec: Extract<
    CreateFollowUpTaskExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapScheduleMaintenanceVisitExecutorFailureToResponse(
  exec: Extract<
    ScheduleMaintenanceVisitExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapCreateMaintenancePlanFromEquipmentExecutorFailureToResponse(
  exec: Extract<
    CreateMaintenancePlanFromEquipmentExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapCreatePartsReorderRequestExecutorFailureToResponse(
  exec: Extract<
    CreatePartsReorderRequestExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

function mapBulkInvoiceExecutorFailureToResponse(
  exec: Extract<
    BulkInvoiceCompletedWorkOrdersExecutorResult,
    { kind: "validation_error" } | { kind: "permission_denied" } | { kind: "server_error" }
  >,
): NextResponse {
  switch (exec.kind) {
    case "validation_error":
      return NextResponse.json({ error: "validation_error", message: exec.message }, { status: 400 })
    case "permission_denied":
      return NextResponse.json({ error: "insufficient_permissions", message: exec.message }, { status: 403 })
    case "server_error":
      return NextResponse.json({ error: "execution_failed", message: exec.message }, { status: 500 })
  }
}

/**
 * Runs a prepared workspace action after route-level auth, entitlement, and confirmation gates.
 * Financial actions re-check prepare permissions immediately before invoking the executor.
 */
export async function executePreparedWorkspaceAction(args: {
  svc: SupabaseClient
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  actionId: string
  bulkConfirmationPhrase?: string | null
  /** Synthetic Scale plan evaluation for tier gates when platform support staff runs the action. */
  platformAdminPlanBypass?: boolean
}): Promise<NextResponse> {
  const def = getPreparedWorkspaceActionDefinition(args.actionId as AidenPreparedWorkspaceActionId)
  if (!def) {
    return NextResponse.json({ error: "unknown_action", message: "Unknown action." }, { status: 400 })
  }

  if (args.actionId === "summarize_customer_history") {
    const rowRes = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
    if (rowRes.error) {
      return NextResponse.json({ error: "query_failed", message: rowRes.error.message }, { status: 500 })
    }
    const row = rowRes.data
    if (!row) {
      return NextResponse.json({ error: "not_found", message: "Prepared action not found." }, { status: 404 })
    }
    if (row.status === "completed") {
      return NextResponse.json({
        preparedAction: serializePreparedAction(row),
        message: "Customer summary is already attached to this prepared action.",
      })
    }
    const pv = row.preview_payload as { preview?: { customer?: { id?: string } } }
    const cidRaw = pv.preview?.customer?.id?.trim() ?? row.target_record_id?.trim()
    const cid = cidRaw && UUID_RE.test(cidRaw) ? cidRaw : null
    const now = new Date().toISOString()
    const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
      status: "completed",
      executed_by: args.userId,
      executed_at: now,
      target_record_type: cid ? "customer" : row.target_record_type,
      target_record_id: cid ?? row.target_record_id,
      execution_payload: { readOnlySummary: true, customerId: cid },
    })
    if (upd.error || !upd.data) {
      return NextResponse.json(
        { error: "update_failed", message: upd.error?.message ?? "Could not finalize read-only summary." },
        { status: 500 },
      )
    }
    const auditDone = await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_completed",
      action_id: args.actionId,
      details: { readOnlySummary: true, customerId: cid },
    })
    if (auditDone.error) {
      return NextResponse.json({ error: "audit_failed", message: auditDone.error.message }, { status: 500 })
    }
    const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
    return NextResponse.json({
      preparedAction: after.data ? serializePreparedAction(after.data) : serializePreparedAction(upd.data),
    })
  }

  const handled: readonly AidenPreparedWorkspaceActionId[] = [
    "create_invoice_from_work_order",
    "bulk_invoice_completed_work_orders",
    "create_quote_from_work_order",
    "prepare_invoice_payment_link",
    "draft_customer_message",
    "prepare_quickbooks_invoice_sync",
    "create_follow_up_task",
    "schedule_maintenance_visit",
    "create_maintenance_plan_from_equipment",
    "create_parts_reorder_request",
  ]
  if (!handled.includes(args.actionId as AidenPreparedWorkspaceActionId)) {
    return recordNotImplementedExecutionAndRespond({
      svc: args.svc,
      organizationId: args.organizationId,
      userId: args.userId,
      preparedActionId: args.preparedActionId,
      actionId: args.actionId,
    })
  }

  const auditStart = await insertActionAuditLog(args.svc, {
    organization_id: args.organizationId,
    prepared_action_id: args.preparedActionId,
    actor_user_id: args.userId,
    event_type: "prepared_action_execution_started",
    action_id: args.actionId,
    details: {},
  })
  if (auditStart.error) {
    return NextResponse.json({ error: "audit_failed", message: auditStart.error.message }, { status: 500 })
  }

  const fresh = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
  if (fresh.error) {
    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: "query_failed", message: fresh.error.message },
    })
    return NextResponse.json({ error: "query_failed", message: fresh.error.message }, { status: 500 })
  }
  const row = fresh.data
  if (!row) {
    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: "not_found", message: "Prepared action not found." },
    })
    return NextResponse.json({ error: "not_found", message: "Prepared action not found." }, { status: 404 })
  }

  if (isFinancialAidenAction(def)) {
    const still = await canPrepareWorkspaceActionForUser({
      supabase: args.userSupabase,
      organizationId: args.organizationId,
      permissions: args.permissions,
      actionId: args.actionId as AidenPreparedWorkspaceActionId,
      isPlatformAdmin: args.platformAdminPlanBypass,
    })
    if (!still) {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_failed",
        action_id: args.actionId,
        details: { code: "insufficient_permissions", message: "Financial action permissions failed re-check." },
      })
      return NextResponse.json(
        { error: "insufficient_permissions", message: "Financial action permissions failed re-check." },
        { status: 403 },
      )
    }
  }

  if (args.actionId === "create_invoice_from_work_order") {
    const exec = await executeCreateInvoiceFromWorkOrderDraft({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "org_invoice",
          target_record_id: exec.invoiceId,
          execution_payload: {
            invoiceId: exec.invoiceId,
            invoiceNumber: exec.invoiceNumber,
            status: "draft",
            completedAt: now,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { invoiceId: exec.invoiceId, invoiceNumber: exec.invoiceNumber },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        invoiceId: exec.invoiceId,
        invoiceNumber: exec.invoiceNumber,
        status: "draft",
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { invoiceId: exec.invoiceId, invoiceNumber: exec.invoiceNumber, idempotent: true },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        invoiceId: exec.invoiceId,
        invoiceNumber: exec.invoiceNumber,
        status: "draft",
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapInvoiceExecutorFailureToResponse(exec)
  }

  if (args.actionId === "bulk_invoice_completed_work_orders") {
    const exec = await executeBulkInvoiceCompletedWorkOrdersDraft({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      bulkConfirmationPhrase: args.bulkConfirmationPhrase,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: null,
          target_record_id: null,
          execution_payload: {
            bulk: true,
            results: exec.results,
            succeeded: exec.succeeded,
            failed: exec.failed,
            skipped: exec.skipped,
            completedAt: now,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "bulk_invoice_batch_completed",
        action_id: args.actionId,
        details: {
          succeeded: exec.succeeded,
          failed: exec.failed,
          skipped: exec.skipped,
        },
      })

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          bulk: true,
          succeeded: exec.succeeded,
          failed: exec.failed,
          skipped: exec.skipped,
        },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        bulk: true,
        results: exec.results,
        succeeded: exec.succeeded,
        failed: exec.failed,
        skipped: exec.skipped,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapBulkInvoiceExecutorFailureToResponse(exec)
  }

  if (args.actionId === "create_quote_from_work_order") {
    const exec = await executeCreateQuoteFromWorkOrderDraft({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success" || exec.kind === "idempotent") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "org_quote",
          target_record_id: exec.quoteId,
          execution_payload: {
            quoteId: exec.quoteId,
            noAutoSend: true,
            completedAt: now,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { quoteId: exec.quoteId, idempotent: exec.kind === "idempotent", noAutoSend: true },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        quoteId: exec.quoteId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapQuoteExecutorFailureToResponse(exec)
  }

  if (args.actionId === "prepare_invoice_payment_link") {
    const exec = await executePrepareInvoicePaymentLink({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "stripe_checkout_session",
          target_record_id: exec.checkoutSessionId,
          execution_payload: {
            checkoutUrl: exec.checkoutUrl,
            checkoutSessionId: exec.checkoutSessionId,
            stripePaymentIntentId: exec.stripePaymentIntentId,
            blitzpayPaymentIntentRowId: exec.blitzpayPaymentIntentRowId,
            invoiceId: exec.invoiceId,
            noAutoEmail: true,
            noAutoSms: true,
            noAutoCharge: true,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          invoiceId: exec.invoiceId,
          checkoutSessionId: exec.checkoutSessionId,
          noAutoEmail: true,
          noAutoSms: true,
        },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        checkoutUrl: exec.checkoutUrl,
        checkoutSessionId: exec.checkoutSessionId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          invoiceId: exec.invoiceId,
          checkoutSessionId: exec.checkoutSessionId,
          idempotent: true,
          noAutoEmail: true,
          noAutoSms: true,
        },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        checkoutUrl: exec.checkoutUrl,
        checkoutSessionId: exec.checkoutSessionId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapPaymentLinkExecutorFailureToResponse(exec)
  }

  if (args.actionId === "draft_customer_message") {
    const exec = await executeDraftCustomerMessage({
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "communication_event",
          target_record_id: exec.communicationEventId,
          execution_payload: {
            communicationEventId: exec.communicationEventId,
            noAutoSend: true,
            noAutoEmail: true,
            noAutoSms: true,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          communicationEventId: exec.communicationEventId,
          noAutoSend: true,
        },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        communicationEventId: exec.communicationEventId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { communicationEventId: exec.communicationEventId, idempotent: true, noAutoSend: true },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        communicationEventId: exec.communicationEventId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapDraftMessageExecutorFailureToResponse(exec)
  }

  if (args.actionId === "create_follow_up_task") {
    const exec = await executeCreateFollowUpTask({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "follow_up_task",
          target_record_id: exec.followUpTaskId,
          execution_payload: {
            followUpTaskId: exec.followUpTaskId,
            noAutoSend: true,
            noAutoEmail: true,
            noAutoSms: true,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          followUpTaskId: exec.followUpTaskId,
          noAutoSend: true,
        },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        followUpTaskId: exec.followUpTaskId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { followUpTaskId: exec.followUpTaskId, idempotent: true, noAutoSend: true },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        followUpTaskId: exec.followUpTaskId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapCreateFollowUpTaskExecutorFailureToResponse(exec)
  }

  if (args.actionId === "schedule_maintenance_visit") {
    const exec = await executeScheduleMaintenanceVisit({
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "work_order",
          target_record_id: exec.workOrderId,
          execution_payload: {
            workOrderId: exec.workOrderId,
            completedAt: now,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { workOrderId: exec.workOrderId },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        workOrderId: exec.workOrderId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { workOrderId: exec.workOrderId, idempotent: true },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        workOrderId: exec.workOrderId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapScheduleMaintenanceVisitExecutorFailureToResponse(exec)
  }

  if (args.actionId === "create_maintenance_plan_from_equipment") {
    const exec = await executeCreateMaintenancePlanFromEquipment({
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "maintenance_plan",
          target_record_id: exec.maintenancePlanId,
          execution_payload: {
            maintenancePlanId: exec.maintenancePlanId,
            completedAt: now,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { maintenancePlanId: exec.maintenancePlanId },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        maintenancePlanId: exec.maintenancePlanId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: { maintenancePlanId: exec.maintenancePlanId, idempotent: true },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        maintenancePlanId: exec.maintenancePlanId,
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapCreateMaintenancePlanFromEquipmentExecutorFailureToResponse(exec)
  }

  if (args.actionId === "create_parts_reorder_request") {
    const exec = await executeCreatePartsReorderRequest({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const hasPo = Boolean(exec.purchaseOrderId && UUID_RE.test(exec.purchaseOrderId))
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: hasPo ? "org_purchase_order" : null,
          target_record_id: hasPo ? exec.purchaseOrderId! : null,
          execution_payload: {
            completedAt: now,
            purchaseOrderId: exec.purchaseOrderId ?? null,
            purchaseOrderNumber: exec.purchaseOrderNumber ?? null,
            restockLedgerIds: exec.restockLedgerIds ?? [],
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          purchaseOrderId: exec.purchaseOrderId ?? null,
          restockLedgerIds: exec.restockLedgerIds ?? [],
        },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        purchaseOrderId: exec.purchaseOrderId ?? null,
        purchaseOrderNumber: exec.purchaseOrderNumber ?? null,
        restockLedgerIds: exec.restockLedgerIds ?? [],
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    if (exec.kind === "idempotent") {
      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          purchaseOrderId: exec.purchaseOrderId ?? null,
          restockLedgerIds: exec.restockLedgerIds ?? [],
          idempotent: true,
        },
      })
      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        purchaseOrderId: exec.purchaseOrderId ?? null,
        restockLedgerIds: exec.restockLedgerIds ?? [],
        message: exec.message,
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapCreatePartsReorderRequestExecutorFailureToResponse(exec)
  }

  if (args.actionId === "prepare_quickbooks_invoice_sync") {
    const exec = await executePrepareQuickBooksInvoiceSync({
      svc: args.svc,
      userSupabase: args.userSupabase,
      organizationId: args.organizationId,
      userId: args.userId,
      permissions: args.permissions,
      preparedActionId: args.preparedActionId,
      row,
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    })

    if (exec.kind === "success") {
      if (row.status === "confirmed") {
        const now = new Date().toISOString()
        const upd = await updatePreparedActionById(args.svc, args.organizationId, args.preparedActionId, {
          status: "completed",
          executed_by: args.userId,
          executed_at: now,
          target_record_type: "org_invoice",
          target_record_id: exec.invoiceId,
          execution_payload: {
            invoiceId: exec.invoiceId,
            quickBooksSync: {
              attempted: exec.attempted,
              succeeded: exec.succeeded,
              errors: exec.errors,
            },
            completedAt: now,
          },
          error_message: null,
        })
        if (upd.error || !upd.data) {
          await insertActionAuditLog(args.svc, {
            organization_id: args.organizationId,
            prepared_action_id: args.preparedActionId,
            actor_user_id: args.userId,
            event_type: "prepared_action_execution_failed",
            action_id: args.actionId,
            details: { code: "update_failed", message: upd.error?.message ?? "Update failed." },
          })
          return NextResponse.json(
            { error: "update_failed", message: upd.error?.message ?? "Failed to finalize prepared action." },
            { status: 500 },
          )
        }
      }

      await insertActionAuditLog(args.svc, {
        organization_id: args.organizationId,
        prepared_action_id: args.preparedActionId,
        actor_user_id: args.userId,
        event_type: "prepared_action_execution_completed",
        action_id: args.actionId,
        details: {
          invoiceId: exec.invoiceId,
          quickBooksAttempted: exec.attempted,
          quickBooksSucceeded: exec.succeeded,
        },
      })

      const after = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
      return NextResponse.json({
        invoiceId: exec.invoiceId,
        message: exec.message,
        quickBooksSync: { attempted: exec.attempted, succeeded: exec.succeeded, errors: exec.errors },
        preparedAction: after.data ? serializePreparedAction(after.data) : null,
      })
    }

    await insertActionAuditLog(args.svc, {
      organization_id: args.organizationId,
      prepared_action_id: args.preparedActionId,
      actor_user_id: args.userId,
      event_type: "prepared_action_execution_failed",
      action_id: args.actionId,
      details: { code: exec.kind, message: "message" in exec ? exec.message : "" },
    })

    return mapQuickBooksInvoiceSyncExecutorFailureToResponse(exec)
  }

  return NextResponse.json({ error: "internal_error", message: "Unhandled executor branch." }, { status: 500 })
}
