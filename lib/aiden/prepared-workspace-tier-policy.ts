/**
 * Product packaging for **prepared workspace** actions (intent → preview → confirm → execute).
 * When `AIDEN_PREPARED_WORKSPACE_TIER_GATING=1`, `canPrepareAidenAction` uses this matrix instead of
 * per-definition `planGate.minimumPlanTier` / `requiredFeatures` alone (see `lib/aiden/actions/action-permissions.ts`).
 *
 * Tiers follow Equipify plan ids: `solo` | `core` | `growth` | `scale`. There is no separate `enterprise`
 * product id today — **bulk** financial prepared actions use **Scale** as the minimum tier until an
 * Enterprise plan exists.
 */

import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { canUseFeature } from "@/lib/billing/entitlements"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { PLAN_IDS, type PlanId } from "@/lib/plans"

function planTierIndex(planId: PlanId): number {
  const id = typeof planId === "string" ? normalizePlanIdForRead(planId) : planId
  const idx = PLAN_IDS.indexOf(id as PlanId)
  return idx >= 0 ? idx : 0
}

/**
 * Minimum **paid** tier for the action when tier gating is enabled.
 * Trial orgs are evaluated as Scale elsewhere (`trialActive` in callers).
 */
const PREPARED_WORKSPACE_ACTION_MIN_PLAN: Record<AidenPreparedWorkspaceActionId, PlanId> = {
  summarize_customer_history: "core",
  draft_customer_message: "core",
  create_follow_up_task: "growth",
  schedule_maintenance_visit: "growth",
  create_maintenance_plan_from_equipment: "growth",
  create_invoice_from_work_order: "scale",
  create_quote_from_work_order: "scale",
  prepare_invoice_payment_link: "scale",
  prepare_quickbooks_invoice_sync: "scale",
  create_parts_reorder_request: "scale",
  bulk_invoice_completed_work_orders: "scale",
}

export function getMinimumPlanForPreparedWorkspaceAction(actionId: AidenPreparedWorkspaceActionId): PlanId {
  return PREPARED_WORKSPACE_ACTION_MIN_PLAN[actionId] ?? "scale"
}

export function getEffectivePlanIdForPreparedWorkspaceTierGate(
  storedPlanId: string | null | undefined,
  trialActive: boolean,
): PlanId {
  if (trialActive) return "scale"
  return normalizePlanIdForRead(String(storedPlanId ?? "solo"))
}

/**
 * Whether the org’s effective tier may **start** this prepared workspace action when tier gating is on.
 * Permissions are checked separately (`canPrepareAidenAction`).
 */
export function preparedWorkspaceActionAllowedByTierMatrix(args: {
  actionId: AidenPreparedWorkspaceActionId
  storedPlanId: string
  trialActive: boolean
}): boolean {
  const effective = getEffectivePlanIdForPreparedWorkspaceTierGate(args.storedPlanId, args.trialActive)
  // Solo (non-trial): no prepared workspace actions.
  if (effective === "solo" && !args.trialActive) return false

  const min = PREPARED_WORKSPACE_ACTION_MIN_PLAN[args.actionId]
  if (!min) return false
  if (planTierIndex(effective) < planTierIndex(min)) return false

  if (
    args.actionId === "schedule_maintenance_visit" ||
    args.actionId === "create_maintenance_plan_from_equipment"
  ) {
    return canUseFeature(args.storedPlanId, "maintenance_plans", args.trialActive)
  }

  return true
}

export function listPreparedWorkspaceActionsWithTierMin(): Array<{
  actionId: AidenPreparedWorkspaceActionId
  minPlan: PlanId
}> {
  return (Object.keys(PREPARED_WORKSPACE_ACTION_MIN_PLAN) as AidenPreparedWorkspaceActionId[]).map(
    (actionId) => ({ actionId, minPlan: PREPARED_WORKSPACE_ACTION_MIN_PLAN[actionId] }),
  )
}
