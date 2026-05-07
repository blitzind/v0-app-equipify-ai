import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { canUseFeature } from "@/lib/billing/entitlements"
import { loadOrgBillingContext } from "@/lib/billing/server-guard"
import { isTrialActive } from "@/lib/billing/subscriptions"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Workflow Automations Phase 2 — duplicate.
 *
 * Clones an automation with a "(copy)" suffix. The clone is **disabled
 * by default** so a duplicate never silently doubles a customer-facing
 * effect. Trigger / conditions / actions JSON are copied verbatim.
 *
 * Reuses the existing `workflow_automations` insert path (RLS gated by
 * manager+ role; same plan check the create endpoint enforces).
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string; automationId: string }> },
) {
  const { organizationId, automationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(automationId)) {
    return jsonError("Invalid id.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError("Unauthorized.", 401)

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (!mem || !["owner", "admin", "manager"].includes(mem.role as string)) {
    return jsonError("Forbidden.", 403)
  }

  const billing = await loadOrgBillingContext(supabase, organizationId)
  if (
    !canUseFeature(
      billing.subscription?.plan_id ?? "solo",
      "automation",
      isTrialActive(billing.subscription),
    )
  ) {
    return jsonError("Workflow automation requires Growth plan or trial.", 403)
  }

  const { data: src, error: sErr } = await supabase
    .from("workflow_automations")
    .select("*")
    .eq("id", automationId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (sErr) return jsonError(sErr.message, 500)
  if (!src) return jsonError("Not found.", 404)

  const newName = `${src.name as string} (copy)`.slice(0, 200)

  const { data, error } = await supabase
    .from("workflow_automations")
    .insert({
      organization_id: organizationId,
      name: newName,
      description: (src.description as string) ?? "",
      enabled: false,
      trigger_type: src.trigger_type,
      trigger_config: src.trigger_config ?? {},
      condition_config: src.condition_config ?? {},
      action_config: src.action_config ?? { actions: [] },
      created_by: user.id,
    })
    .select("*")
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ automation: data })
}
