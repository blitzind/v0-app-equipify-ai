import type { AidenPreparedWorkspaceActionDefinition, AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"
import {
  canPrepareAidenAction,
  isBulkAidenAction,
  isFinancialAidenAction,
  requiresAidenConfirmation,
  type CanPrepareAidenActionArgs,
} from "@/lib/aiden/actions/action-permissions"

export type { AidenPreparedWorkspaceActionId, AidenPreparedWorkspaceActionDefinition } from "@/lib/aiden/actions/action-types"
export {
  canPrepareAidenAction,
  requiresAidenConfirmation,
  isFinancialAidenAction,
  isBulkAidenAction,
  orgHasAllPermissionKeys,
  orgHasAnyPermissionKey,
  diagnosePreparedWorkspacePrepareDenial,
} from "@/lib/aiden/actions/action-permissions"

const DEF_CREATE_INVOICE_FROM_WO: AidenPreparedWorkspaceActionDefinition = {
  id: "create_invoice_from_work_order",
  label: "Create invoice from work order",
  description:
    "Prepare a draft org invoice seeded from a completed or billable work order (line items and totals to be confirmed).",
  category: "billing",
  requiredPermissions: ["canEditInvoices", "canEditWorkOrders"],
  planGate: { requiredFeatures: [], minimumPlanTier: "solo" },
  riskLevel: "financial_draft",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: true,
  mutationKind: "write_capable",
}

const DEF_CREATE_QUOTE_FROM_WO: AidenPreparedWorkspaceActionDefinition = {
  id: "create_quote_from_work_order",
  label: "Create quote from work order",
  description: "Prepare a draft customer quote using work order scope, parts, and labor context for staff review.",
  category: "billing",
  requiredPermissions: ["canEditQuotes", "canEditWorkOrders"],
  planGate: { requiredFeatures: [], minimumPlanTier: "solo" },
  riskLevel: "financial_draft",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: true,
  mutationKind: "write_capable",
}

const DEF_DRAFT_CUSTOMER_MESSAGE: AidenPreparedWorkspaceActionDefinition = {
  id: "draft_customer_message",
  label: "Draft customer message",
  description:
    "Prepare outbound customer communication copy (email/SMS-style) for review — does not send without a separate send path.",
  category: "communications",
  requiredPermissions: ["canManageCommunications"],
  planGate: { requiredFeatures: [] },
  riskLevel: "draft_content",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: false,
  mutationKind: "draft_only",
}

const DEF_SUMMARIZE_CUSTOMER_HISTORY: AidenPreparedWorkspaceActionDefinition = {
  id: "summarize_customer_history",
  label: "Summarize customer history",
  description:
    "Prepare a read-only narrative summarizing recent work orders, invoices, and equipment touchpoints for a customer.",
  category: "reporting",
  requiredPermissions: ["canViewAllWorkOrders", "canManageProspects"],
  requireAnyPermission: true,
  planGate: { requiredFeatures: ["ai"], minimumPlanTier: "growth" },
  riskLevel: "read_only",
  requiresConfirmation: false,
  supportsBulkExecution: false,
  touchesFinancialRecords: false,
  mutationKind: "read_only",
}

const DEF_CREATE_FOLLOW_UP_TASK: AidenPreparedWorkspaceActionDefinition = {
  id: "create_follow_up_task",
  label: "Create follow-up task",
  description:
    "Prepare a structured follow-up task linked to a work order, customer, invoice, quote, equipment, or maintenance plan for the communications queue.",
  category: "work_orders",
  requiredPermissions: ["canEditWorkOrders", "canManageCommunications"],
  requireAnyPermission: true,
  planGate: { requiredFeatures: [] },
  riskLevel: "operational_write",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: false,
  mutationKind: "write_capable",
}

const DEF_SCHEDULE_MAINTENANCE_VISIT: AidenPreparedWorkspaceActionDefinition = {
  id: "schedule_maintenance_visit",
  label: "Schedule maintenance visit",
  description:
    "Prepare a scheduled work order for preventive maintenance or a service visit from customer, equipment, or maintenance plan context.",
  category: "maintenance",
  requiredPermissions: ["canManageDispatch", "canEditWorkOrders"],
  requireAnyPermission: true,
  planGate: { requiredFeatures: ["maintenance_plans"], minimumPlanTier: "growth" },
  riskLevel: "operational_write",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: false,
  mutationKind: "write_capable",
}

const DEF_CREATE_MAINTENANCE_PLAN_FROM_EQ: AidenPreparedWorkspaceActionDefinition = {
  id: "create_maintenance_plan_from_equipment",
  label: "Create maintenance plan from equipment",
  description: "Prepare a preventive maintenance plan draft for a specific equipment record with interval and next-due hints.",
  category: "maintenance",
  requiredPermissions: ["canManageDispatch", "canEditWorkOrders"],
  requireAnyPermission: true,
  planGate: { requiredFeatures: ["maintenance_plans"], minimumPlanTier: "growth" },
  riskLevel: "operational_write",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: false,
  mutationKind: "write_capable",
}

const DEF_CREATE_PARTS_REORDER: AidenPreparedWorkspaceActionDefinition = {
  id: "create_parts_reorder_request",
  label: "Create parts reorder request",
  description: "Prepare an internal parts reorder / PO suggestion from van stock, WO consumption, or low-stock signals.",
  category: "inventory",
  requiredPermissions: ["canManageInventory"],
  planGate: { requiredFeatures: [] },
  riskLevel: "operational_write",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: false,
  mutationKind: "write_capable",
}

const DEF_PREPARE_INVOICE_PAYMENT_LINK: AidenPreparedWorkspaceActionDefinition = {
  id: "prepare_invoice_payment_link",
  label: "Prepare invoice payment link",
  description:
    "Prepare BlitzPay / hosted checkout parameters for an existing invoice — creates no charge until staff confirms and executes.",
  category: "billing",
  requiredPermissions: ["canAssistBlitzpayCollection", "canEditInvoices"],
  planGate: { requiredFeatures: [] },
  riskLevel: "financial_draft",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: true,
  mutationKind: "draft_only",
}

const DEF_PREPARE_QB_SYNC: AidenPreparedWorkspaceActionDefinition = {
  id: "prepare_quickbooks_invoice_sync",
  label: "Prepare QuickBooks invoice sync",
  description:
    "Prepare QuickBooks sync payload or mapping review for one or more invoices — no remote QuickBooks mutation until confirmed execution.",
  category: "integrations",
  requiredPermissions: ["canManageIntegrations", "canEditInvoices"],
  planGate: { requiredFeatures: [] },
  riskLevel: "financial_draft",
  requiresConfirmation: true,
  supportsBulkExecution: false,
  touchesFinancialRecords: true,
  mutationKind: "draft_only",
}

const DEF_BULK_INVOICE_COMPLETED_WOS: AidenPreparedWorkspaceActionDefinition = {
  id: "bulk_invoice_completed_work_orders",
  label: "Bulk invoice completed work orders",
  description:
    "Prepare a batch of draft invoices from a bounded list of completed / ready-to-bill work orders for finance review.",
  category: "billing",
  requiredPermissions: ["canEditInvoices", "canViewFinancials"],
  planGate: { requiredFeatures: [], minimumPlanTier: "growth" },
  riskLevel: "bulk_financial_write",
  requiresConfirmation: true,
  supportsBulkExecution: true,
  touchesFinancialRecords: true,
  mutationKind: "write_capable",
}

export const AIDEN_PREPARED_WORKSPACE_ACTION_REGISTRY: Record<
  AidenPreparedWorkspaceActionId,
  AidenPreparedWorkspaceActionDefinition
> = {
  create_invoice_from_work_order: DEF_CREATE_INVOICE_FROM_WO,
  create_quote_from_work_order: DEF_CREATE_QUOTE_FROM_WO,
  draft_customer_message: DEF_DRAFT_CUSTOMER_MESSAGE,
  summarize_customer_history: DEF_SUMMARIZE_CUSTOMER_HISTORY,
  create_follow_up_task: DEF_CREATE_FOLLOW_UP_TASK,
  schedule_maintenance_visit: DEF_SCHEDULE_MAINTENANCE_VISIT,
  create_maintenance_plan_from_equipment: DEF_CREATE_MAINTENANCE_PLAN_FROM_EQ,
  create_parts_reorder_request: DEF_CREATE_PARTS_REORDER,
  prepare_invoice_payment_link: DEF_PREPARE_INVOICE_PAYMENT_LINK,
  prepare_quickbooks_invoice_sync: DEF_PREPARE_QB_SYNC,
  bulk_invoice_completed_work_orders: DEF_BULK_INVOICE_COMPLETED_WOS,
}

function assertPreparedWorkspaceRegistrySafety(): void {
  for (const id of AIDEN_PREPARED_WORKSPACE_ACTION_IDS) {
    const def = AIDEN_PREPARED_WORKSPACE_ACTION_REGISTRY[id]
    if (!def) throw new Error(`Missing prepared workspace action definition: ${id}`)
    if (def.id !== id) throw new Error(`Prepared action id mismatch for ${id}`)
    if (isFinancialAidenAction(def) || isBulkAidenAction(def)) {
      if (!def.requiresConfirmation) {
        throw new Error(`Prepared action ${id} must set requiresConfirmation when financial or bulk.`)
      }
    }
  }
}

assertPreparedWorkspaceRegistrySafety()

/**
 * Lookup for **prepared workspace** actions (intent registry). For executor-backed AIden actions see
 * `getAidenActionDefinition` in `registry.ts`.
 */
export function getPreparedWorkspaceActionDefinition(
  actionId: AidenPreparedWorkspaceActionId,
): AidenPreparedWorkspaceActionDefinition | null {
  return AIDEN_PREPARED_WORKSPACE_ACTION_REGISTRY[actionId] ?? null
}

export function listAidenActions(): readonly AidenPreparedWorkspaceActionDefinition[] {
  return AIDEN_PREPARED_WORKSPACE_ACTION_IDS.map((id) => AIDEN_PREPARED_WORKSPACE_ACTION_REGISTRY[id])
}

export function canPrepareAidenActionId(args: CanPrepareAidenActionArgs, actionId: AidenPreparedWorkspaceActionId): boolean {
  return canPrepareAidenAction(args, getPreparedWorkspaceActionDefinition(actionId))
}
