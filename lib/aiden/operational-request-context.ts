import "server-only"

import { NextResponse } from "next/server"
import type { PlanId } from "@/lib/plans"
import { canUseAidenCapability } from "@/lib/aiden/tier-capabilities"
import { OPERATIONAL_PLAN_REQUIRED_MESSAGE } from "@/lib/aiden/operational-messages"
import { canAccessApp } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import {
  isAssignedWorkOnly,
  loadAssignedWorkScope,
  type AssignedWorkScope,
} from "@/lib/permissions/technician-scope"
import type { OrgPermissions } from "@/lib/permissions/model"

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

export type OperationalRequestContext = {
  userId: string
  organizationId: string
  planId: PlanId
  permissions: OrgPermissions
  supabase: import("@supabase/supabase-js").SupabaseClient
  assignedScope: AssignedWorkScope | null
}

/**
 * Scale operational recommendations: view-work permission, active billing, Scale plan.
 */
export async function resolveOperationalRecommendationsRequest(
  organizationId: string,
): Promise<{ ok: true; ctx: OperationalRequestContext } | { ok: false; response: NextResponse }> {
  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) {
    return { ok: false, response: gate.error }
  }

  const subscription = await getOrganizationSubscription(gate.supabase, organizationId)
  if (!canAccessApp(subscription)) {
    return {
      ok: false,
      response: jsonError(
        "billing_inactive",
        "AIden is unavailable while billing is restricted for this workspace.",
        403,
      ),
    }
  }

  const planId = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
  if (!canUseAidenCapability(planId, "operational_copilot")) {
    return {
      ok: false,
      response: jsonError("plan_required", OPERATIONAL_PLAN_REQUIRED_MESSAGE, 403),
    }
  }

  let assignedScope: AssignedWorkScope | null = null
  if (isAssignedWorkOnly(gate.permissions)) {
    assignedScope = await loadAssignedWorkScope(gate.supabase, {
      organizationId,
      userId: gate.userId,
    })
  }

  return {
    ok: true,
    ctx: {
      userId: gate.userId,
      organizationId,
      planId,
      permissions: gate.permissions,
      supabase: gate.supabase,
      assignedScope,
    },
  }
}
