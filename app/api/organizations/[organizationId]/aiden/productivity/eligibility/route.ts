import { NextResponse } from "next/server"
import { canUseAidenCapability } from "@/lib/aiden/tier-capabilities"
import { canAccessApp } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ ok: false, error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ ok: false, error: "forbidden", message: "You do not have access to this organization." }, { status: 403 })
  }

  const subscription = await getOrganizationSubscription(supabase, organizationId)
  const planId = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
  const billingOk = canAccessApp(subscription)
  const productivityEnabled = billingOk && canUseAidenCapability(planId, "productivity_ai")
  const operationalCopilotEnabled = billingOk && canUseAidenCapability(planId, "operational_copilot")
  /** Growth / Scale when billing ok — used for Scale-only messaging without exposing nag copy to Solo/Core. */
  const operationalGrowthHint = billingOk && productivityEnabled && !operationalCopilotEnabled

  return NextResponse.json({
    ok: true,
    productivityEnabled,
    operationalCopilotEnabled,
    operationalGrowthHint,
    planTier: planId,
  })
}
