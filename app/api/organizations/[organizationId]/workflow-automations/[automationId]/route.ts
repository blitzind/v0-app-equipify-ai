import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { canUseFeature } from "@/lib/billing/entitlements"
import { loadOrgBillingContext } from "@/lib/billing/server-guard"
import { isTrialActive } from "@/lib/billing/subscriptions"
import type { WorkflowTriggerType } from "@/lib/workflows/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TRIGGER_TYPES = new Set<string>([
  "work_order_created",
  "work_order_completed",
  "work_order_status_changed",
  "maintenance_due",
  "invoice_overdue",
  "quote_accepted",
  "equipment_warranty_expiring",
  "certificate_uploaded",
  "ai_assistant_digest_ready",
])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function requireManager(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  organizationId: string,
) {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  if (!mem || !["owner", "admin", "manager"].includes(mem.role as string)) {
    return false
  }
  return true
}

export async function PATCH(
  request: NextRequest,
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

  if (!(await requireManager(supabase, user.id, organizationId))) {
    return jsonError("Forbidden.", 403)
  }

  const billing = await loadOrgBillingContext(supabase, organizationId)
  if (!canUseFeature(billing.subscription?.plan_id ?? "solo", "automation", isTrialActive(billing.subscription))) {
    return jsonError("Workflow automation requires Growth plan or trial.", 403)
  }

  const body = (await request.json()) as {
    name?: string
    description?: string
    enabled?: boolean
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    condition_config?: Record<string, unknown>
    action_config?: Record<string, unknown>
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.name === "string") patch.name = body.name.trim()
  if (typeof body.description === "string") patch.description = body.description
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled
  if (body.trigger_type !== undefined) {
    if (!TRIGGER_TYPES.has(body.trigger_type)) return jsonError("Invalid trigger_type.", 400)
    patch.trigger_type = body.trigger_type as WorkflowTriggerType
  }
  if (body.trigger_config !== undefined) patch.trigger_config = body.trigger_config
  if (body.condition_config !== undefined) patch.condition_config = body.condition_config
  if (body.action_config !== undefined) patch.action_config = body.action_config

  if (Object.keys(patch).length === 0) return jsonError("No updates.", 400)

  const { data, error } = await supabase
    .from("workflow_automations")
    .update(patch)
    .eq("id", automationId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError("Not found.", 404)
  return NextResponse.json({ automation: data })
}

export async function DELETE(
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

  if (!(await requireManager(supabase, user.id, organizationId))) {
    return jsonError("Forbidden.", 403)
  }

  const { error } = await supabase
    .from("workflow_automations")
    .delete()
    .eq("id", automationId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
