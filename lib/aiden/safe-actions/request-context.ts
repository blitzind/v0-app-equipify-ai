import "server-only"

import { NextResponse } from "next/server"
import type { PlanId } from "@/lib/plans"
import { canUseAidenCapability } from "@/lib/aiden/tier-capabilities"
import { SAFE_ACTIONS_PLAN_REQUIRED_MESSAGE } from "@/lib/aiden/safe-actions/messages"
import { canAccessApp } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import type { OrgPermissionKey, OrgPermissions } from "@/lib/permissions/model"

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

/** Anyone who might confirm a safe mutation (viewer excluded via capability mix). */
const SAFE_ACTION_PREPARE_CAPS: OrgPermissionKey[] = [
  "canEditWorkOrders",
  "canManageCommunications",
  "canManageProspects",
]

export type SafeActionsRequestContext = {
  userId: string
  organizationId: string
  planId: PlanId
  permissions: OrgPermissions
  supabase: import("@supabase/supabase-js").SupabaseClient
}

export async function resolveSafeActionsRequest(
  organizationId: string,
): Promise<{ ok: true; ctx: SafeActionsRequestContext } | { ok: false; response: NextResponse }> {
  const gate = await requireAnyOrgPermission(organizationId, SAFE_ACTION_PREPARE_CAPS)
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
  if (!canUseAidenCapability(planId, "safe_aiden_actions")) {
    return {
      ok: false,
      response: jsonError("plan_required", SAFE_ACTIONS_PLAN_REQUIRED_MESSAGE, 403),
    }
  }

  return {
    ok: true,
    ctx: {
      userId: gate.userId,
      organizationId,
      planId,
      permissions: gate.permissions,
      supabase: gate.supabase,
    },
  }
}
