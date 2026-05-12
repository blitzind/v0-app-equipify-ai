import type { Feature } from "@/lib/billing/entitlements"
import type { PlanId } from "@/lib/plans"
import type { OrgPermissionKey } from "@/lib/permissions/model"
import type { AidenPreparedWorkspaceActionRiskLevel } from "@/lib/aiden/actions/action-risk"

export const AIDEN_PREPARED_WORKSPACE_ACTION_IDS = [
  "create_invoice_from_work_order",
  "create_quote_from_work_order",
  "draft_customer_message",
  "summarize_customer_history",
  "create_follow_up_task",
  "schedule_maintenance_visit",
  "create_maintenance_plan_from_equipment",
  "create_parts_reorder_request",
  "prepare_invoice_payment_link",
  "prepare_quickbooks_invoice_sync",
  "bulk_invoice_completed_work_orders",
] as const

export type AidenPreparedWorkspaceActionId = (typeof AIDEN_PREPARED_WORKSPACE_ACTION_IDS)[number]

export type AidenPreparedWorkspaceActionCategory =
  | "customers"
  | "work_orders"
  | "communications"
  | "maintenance"
  | "inventory"
  | "billing"
  | "integrations"
  | "reporting"

/**
 * How a confirmed, server-executed handler would eventually mutate data (prepared payloads are **intent only** today).
 */
export type AidenPreparedWorkspaceMutationKind = "read_only" | "draft_only" | "write_capable"

export type AidenPreparedWorkspacePlanGate = {
  /** Entitlement keys from `lib/billing/entitlements` — all must pass for `canPrepareAidenAction`. */
  requiredFeatures: readonly Feature[]
  /**
   * Soft minimum plan for packaging / UX (deterministic rank); enforcement remains permission-first elsewhere.
   */
  minimumPlanTier?: PlanId
}

export type AidenPreparedWorkspaceActionDefinition = {
  id: AidenPreparedWorkspaceActionId
  label: string
  description: string
  category: AidenPreparedWorkspaceActionCategory
  /**
   * Permission keys from {@link OrgPermissions}. By default **all** must be true; set
   * {@link requireAnyPermission} so **any one** suffices.
   */
  requiredPermissions: readonly OrgPermissionKey[]
  requireAnyPermission?: boolean
  planGate: AidenPreparedWorkspacePlanGate
  riskLevel: AidenPreparedWorkspaceActionRiskLevel
  /** When true, product UI must obtain explicit user confirmation before any server execution. */
  requiresConfirmation: boolean
  supportsBulkExecution: boolean
  /** True when the action materially affects invoices, payments, accounting sync, or aggregate billing. */
  touchesFinancialRecords: boolean
  mutationKind: AidenPreparedWorkspaceMutationKind
}
