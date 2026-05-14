import { NextResponse } from "next/server"
import { canUseAidenCapability } from "@/lib/aiden/tier-capabilities"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"
import { isAidenPreparedWorkspaceTierGatingEnabled } from "@/lib/aiden/prepared-workspace-tier-gate-env"
import {
  getMinimumPlanForPreparedWorkspaceAction,
  preparedWorkspaceActionAllowedByTierMatrix,
} from "@/lib/aiden/prepared-workspace-tier-policy"
import { canAccessApp } from "@/lib/billing/access"
import { equipmentSaveServerDebug } from "@/lib/billing/equipment-save-server-debug"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription, isTrialActive } from "@/lib/billing/subscriptions"
import { getAidenActionAvailability, type AidenActionAvailability } from "@/lib/permissions/aiden-actions"
import { requireOrganizationMember } from "@/lib/email/route-auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safePreparedActionAccess(tierGating: boolean, subscriptionPlan: string, trialActive: boolean) {
  return AIDEN_PREPARED_WORKSPACE_ACTION_IDS.map((actionId) => ({
    actionId,
    allowed:
      !tierGating ||
      preparedWorkspaceActionAllowedByTierMatrix({
        actionId,
        storedPlanId: subscriptionPlan,
        trialActive,
      }),
    minPlan: getMinimumPlanForPreparedWorkspaceAction(actionId),
  }))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ ok: false, error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized", message: "Sign in required." }, { status: 401 })
    }

    equipmentSaveServerDebug("eligibility_membership_fetch", {
      helper: "GET aiden/productivity/eligibility",
      organizationId,
    })

    const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "forbidden", message: "You do not have access to this organization." },
        { status: 403 },
      )
    }

    equipmentSaveServerDebug("eligibility_subscription_fetch", {
      helper: "getOrganizationSubscription",
      organizationId,
    })

    const subscription = await getOrganizationSubscription(supabase, organizationId)
    const planId = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
    const billingOk = canAccessApp(subscription)
    const productivityEnabled = billingOk && canUseAidenCapability(planId, "productivity_ai")
    const operationalCopilotEnabled = billingOk && canUseAidenCapability(planId, "operational_copilot")
    const safeActionsEnabled = billingOk && canUseAidenCapability(planId, "safe_aiden_actions")

    let aidenActions: AidenActionAvailability
    try {
      aidenActions = await getAidenActionAvailability({ supabase, organizationId })
    } catch (e) {
      equipmentSaveServerDebug("eligibility_aiden_actions_failed", {
        helper: "getAidenActionAvailability",
        organizationId,
        message: e instanceof Error ? e.message : String(e),
      })
      aidenActions = {
        enabled: false,
        featureKey: "aiden_actions",
        source: "not_entitled",
        planEntitled: false,
        manuallyEnabled: false,
        manuallyDisabled: false,
        reason: null,
        planId: "solo",
      }
    }

    const preparedWorkspaceActionsEnabled = billingOk && aidenActions.enabled
    const trialActive = isTrialActive(subscription)
    const tierGating = isAidenPreparedWorkspaceTierGatingEnabled()
    const preparedWorkspaceActionAccess = safePreparedActionAccess(
      tierGating,
      subscription?.plan_id ?? "solo",
      trialActive,
    )
    const operationalGrowthHint = billingOk && productivityEnabled && !operationalCopilotEnabled
    const safeActionsGrowthHint = billingOk && productivityEnabled && !safeActionsEnabled

    return NextResponse.json({
      ok: true,
      productivityEnabled,
      operationalCopilotEnabled,
      safeActionsEnabled,
      preparedWorkspaceActionsEnabled,
      operationalGrowthHint,
      safeActionsGrowthHint,
      planTier: planId,
      preparedWorkspaceTierGatingEnabled: tierGating,
      preparedWorkspaceActionAccess,
    })
  } catch (e) {
    equipmentSaveServerDebug("eligibility_route_failed", {
      helper: "GET aiden/productivity/eligibility",
      organizationId,
      message: e instanceof Error ? e.message : String(e),
    })
    const tierGating = isAidenPreparedWorkspaceTierGatingEnabled()
    return NextResponse.json(
      {
        ok: false,
        error: "eligibility_unavailable",
        message: "Could not evaluate Aiden eligibility.",
        productivityEnabled: false,
        operationalCopilotEnabled: false,
        safeActionsEnabled: false,
        preparedWorkspaceActionsEnabled: false,
        operationalGrowthHint: false,
        safeActionsGrowthHint: false,
        planTier: "solo",
        preparedWorkspaceTierGatingEnabled: tierGating,
        preparedWorkspaceActionAccess: safePreparedActionAccess(tierGating, "solo", false),
      },
      { status: 200 },
    )
  }
}
