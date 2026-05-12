import { canUseFeature, type Feature } from "@/lib/billing/entitlements"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { PLAN_IDS, type PlanId } from "@/lib/plans"
import type { OrgPermissions, OrgPermissionKey } from "@/lib/permissions/model"
import type { AidenPreparedWorkspaceActionDefinition } from "@/lib/aiden/actions/action-types"
import { isBulkFinancialRiskLevel, isFinancialRiskLevel } from "@/lib/aiden/actions/action-risk"
import { isAidenPreparedWorkspaceTierGatingEnabled } from "@/lib/aiden/prepared-workspace-tier-gate-env"
import { preparedWorkspaceActionAllowedByTierMatrix } from "@/lib/aiden/prepared-workspace-tier-policy"

function planTierIndex(planId: PlanId | string): number {
  const id = typeof planId === "string" ? (planId.trim().toLowerCase() as PlanId) : planId
  const idx = PLAN_IDS.indexOf(id as PlanId)
  return idx >= 0 ? idx : 0
}

export function orgHasAllPermissionKeys(
  permissions: OrgPermissions,
  keys: readonly OrgPermissionKey[],
): boolean {
  for (const k of keys) {
    if (!permissions[k]) return false
  }
  return true
}

export function orgPassesPlanGate(args: {
  planId: PlanId | string
  trialActive: boolean
  requiredFeatures: readonly Feature[]
  minimumPlanTier?: PlanId
}): boolean {
  for (const f of args.requiredFeatures) {
    if (!canUseFeature(args.planId, f, args.trialActive)) return false
  }
  if (args.minimumPlanTier) {
    const effective: PlanId = args.trialActive ? "scale" : (normalizePlanIdForRead(String(args.planId)) as PlanId)
    if (planTierIndex(effective) < planTierIndex(args.minimumPlanTier)) return false
  }
  return true
}

/** True when the definition affects money, invoices, or aggregate financial writes (used for confirmation defaults). */
export function isFinancialAidenAction(def: AidenPreparedWorkspaceActionDefinition): boolean {
  return def.touchesFinancialRecords || isFinancialRiskLevel(def.riskLevel)
}

export function isBulkAidenAction(def: AidenPreparedWorkspaceActionDefinition): boolean {
  return def.supportsBulkExecution || isBulkFinancialRiskLevel(def.riskLevel)
}

/**
 * Confirmation is mandatory for financial and bulk-capable prepared actions, regardless of the static flag.
 * Callers should treat prepared payloads as **intent only** until a deterministic executor + user confirm path runs.
 */
export function requiresAidenConfirmation(def: AidenPreparedWorkspaceActionDefinition): boolean {
  return def.requiresConfirmation || isFinancialAidenAction(def) || isBulkAidenAction(def)
}

export type CanPrepareAidenActionArgs = {
  permissions: OrgPermissions
  planId: PlanId | string
  trialActive: boolean
  /**
   * When true, plan / tier evaluation uses a synthetic **Scale / non-trial** row so support staff
   * can exercise customer workspaces without widening org-role permission checks.
   */
  platformAdminPlanBypass?: boolean
}

export function orgHasAnyPermissionKey(
  permissions: OrgPermissions,
  keys: readonly OrgPermissionKey[],
): boolean {
  for (const k of keys) {
    if (permissions[k]) return true
  }
  return false
}

export function canPrepareAidenAction(
  args: CanPrepareAidenActionArgs,
  def: AidenPreparedWorkspaceActionDefinition | null | undefined,
): boolean {
  if (!def) return false
  const permOk =
    def.requireAnyPermission ?
      orgHasAnyPermissionKey(args.permissions, def.requiredPermissions)
    : orgHasAllPermissionKeys(args.permissions, def.requiredPermissions)
  if (!permOk) return false

  const planIdForGate = args.platformAdminPlanBypass ? "scale" : args.planId
  const trialForGate = args.platformAdminPlanBypass ? false : args.trialActive

  if (isAidenPreparedWorkspaceTierGatingEnabled()) {
    return preparedWorkspaceActionAllowedByTierMatrix({
      actionId: def.id,
      storedPlanId: String(planIdForGate),
      trialActive: trialForGate,
    })
  }

  if (
    !orgPassesPlanGate({
      planId: planIdForGate,
      trialActive: trialForGate,
      requiredFeatures: def.planGate.requiredFeatures,
      minimumPlanTier: def.planGate.minimumPlanTier,
    })
  ) {
    return false
  }
  return true
}

/**
 * Explains why `canPrepareAidenAction` would return false (for structured API errors).
 * Does **not** apply `platformAdminPlanBypass` — callers pass real session permissions and org plan.
 */
export function diagnosePreparedWorkspacePrepareDenial(
  args: CanPrepareAidenActionArgs,
  def: AidenPreparedWorkspaceActionDefinition | null | undefined,
): "ok" | "permission" | "plan" {
  if (!def) return "permission"
  const permOk =
    def.requireAnyPermission ?
      orgHasAnyPermissionKey(args.permissions, def.requiredPermissions)
    : orgHasAllPermissionKeys(args.permissions, def.requiredPermissions)
  if (!permOk) return "permission"

  if (isAidenPreparedWorkspaceTierGatingEnabled()) {
    return preparedWorkspaceActionAllowedByTierMatrix({
      actionId: def.id,
      storedPlanId: String(args.planId),
      trialActive: args.trialActive,
    }) ?
        "ok"
      : "plan"
  }

  if (
    orgPassesPlanGate({
      planId: args.planId,
      trialActive: args.trialActive,
      requiredFeatures: def.planGate.requiredFeatures,
      minimumPlanTier: def.planGate.minimumPlanTier,
    })
  ) {
    return "ok"
  }
  return "plan"
}
