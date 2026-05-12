import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { UUID_RE, isPreparedWorkspaceActionId } from "@/lib/aiden/prepared-actions/prepared-actions-shared"
import {
  canPrepareAidenActionId,
  diagnosePreparedWorkspacePrepareDenial,
  getPreparedWorkspaceActionDefinition,
  isFinancialAidenAction,
  requiresAidenConfirmation,
} from "@/lib/aiden/actions/action-registry"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { getAidenActionAvailability } from "@/lib/permissions/aiden-actions"
import { isAssignedWorkOnly } from "@/lib/permissions/technician-scope"
import type { OrgPermissionKey, OrgPermissions } from "@/lib/permissions/model"

export { UUID_RE, isPreparedWorkspaceActionId } from "@/lib/aiden/prepared-actions/prepared-actions-shared"

export async function requireWorkspacePreparedActionPermissions(
  organizationId: string,
  actionId: string,
): Promise<
  | { userId: string; supabase: SupabaseClient; role: string | null; permissions: OrgPermissions }
  | { error: NextResponse }
> {
  if (!isPreparedWorkspaceActionId(actionId)) {
    return {
      error: NextResponse.json({ error: "unknown_action", message: "Unknown action id on row." }, { status: 400 }),
    }
  }
  const def = getPreparedWorkspaceActionDefinition(actionId)
  if (!def) {
    return {
      error: NextResponse.json({ error: "unknown_action", message: "Unknown action id on row." }, { status: 400 }),
    }
  }
  const keys = [...def.requiredPermissions] as OrgPermissionKey[]
  if (def.requireAnyPermission) {
    return requireAnyOrgPermission(organizationId, keys)
  }
  return requireOrgPermission(organizationId, keys)
}

export async function fetchOrgSubscriptionForTrial(
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

export async function assertAidenActionsEnabled(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<true | { error: NextResponse }> {
  const availability = await getAidenActionAvailability({ supabase, organizationId })
  if (!availability.enabled) {
    return {
      error: NextResponse.json(
        {
          error: "aiden_actions_disabled",
          message: "AIden Actions is not enabled for this workspace.",
        },
        { status: 403 },
      ),
    }
  }
  return true
}

export function getServiceRoleOrNull(): SupabaseClient | null {
  try {
    return createServiceRoleSupabaseClient()
  } catch {
    return null
  }
}

export async function canPrepareWorkspaceActionForUser(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  actionId: AidenPreparedWorkspaceActionId
  isPlatformAdmin?: boolean
}): Promise<boolean> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const sub = await fetchOrgSubscriptionForTrial(args.supabase, args.organizationId)
  const trialActive = isTrialActive(sub)
  return canPrepareAidenActionId(
    {
      permissions: args.permissions,
      planId,
      trialActive,
      platformAdminPlanBypass: Boolean(args.isPlatformAdmin),
    },
    args.actionId,
  )
}

export async function diagnoseWorkspacePrepareDenialForUser(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  actionId: AidenPreparedWorkspaceActionId
}): Promise<"ok" | "permission" | "plan"> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const sub = await fetchOrgSubscriptionForTrial(args.supabase, args.organizationId)
  const trialActive = isTrialActive(sub)
  const def = getPreparedWorkspaceActionDefinition(args.actionId)
  return diagnosePreparedWorkspacePrepareDenial(
    { permissions: args.permissions, planId, trialActive },
    def,
  )
}

export function assertFinancialActionAllowedForTechnician(
  permissions: OrgPermissions,
  actionId: AidenPreparedWorkspaceActionId,
): true | { error: NextResponse } {
  const def = getPreparedWorkspaceActionDefinition(actionId)
  if (!def) return true
  if (isFinancialAidenAction(def) && isAssignedWorkOnly(permissions)) {
    return {
      error: NextResponse.json(
        {
          error: "aiden_actions_denied",
          message:
            "This action is restricted for technician roles. Ask an owner, admin, or manager to run it.",
        },
        { status: 403 },
      ),
    }
  }
  return true
}

/** JSON-safe view for API clients (camelCase). */
export function serializePreparedAction(row: AidenPreparedActionRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestedBy: row.requested_by,
    actionId: row.action_id,
    status: row.status,
    riskLevel: row.risk_level,
    inputPayload: row.input_payload,
    resolvedPayload: row.resolved_payload,
    previewPayload: row.preview_payload,
    executionPayload: row.execution_payload,
    sourceRecordType: row.source_record_type,
    sourceRecordId: row.source_record_id,
    targetRecordType: row.target_record_type,
    targetRecordId: row.target_record_id,
    confidenceScore: row.confidence_score,
    requiresConfirmation: row.requires_confirmation,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    executedBy: row.executed_by,
    executedAt: row.executed_at,
    canceledBy: row.canceled_by,
    canceledAt: row.canceled_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function definitionRequiresExplicitConfirmation(actionId: AidenPreparedWorkspaceActionId): boolean {
  const def = getPreparedWorkspaceActionDefinition(actionId)
  if (!def) return true
  return requiresAidenConfirmation(def)
}
