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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Unauthorized.", 401)

  if (!isPlatformAdminEmail(user.email)) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) return jsonError("Forbidden.", 403)
  }

  const billing = await loadOrgBillingContext(supabase, organizationId)
  const trial = isTrialActive(billing.subscription)
  const planId = billing.subscription?.plan_id ?? "solo"
  const automationAllowed = canUseFeature(planId, "automation", trial)

  const { data: automations, error: aErr } = await supabase
    .from("workflow_automations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })

  if (aErr) return jsonError(aErr.message, 500)

  const list = automations ?? []
  const ids = list.map((r: { id: string }) => r.id)
  const lastRunByAutomation = new Map<
    string,
    { status: string; started_at: string; completed_at: string | null }
  >()

  if (ids.length > 0) {
    const { data: runs } = await supabase
      .from("workflow_runs")
      .select("automation_id, status, started_at, completed_at")
      .eq("organization_id", organizationId)
      .in("automation_id", ids)
      .order("started_at", { ascending: false })
      .limit(400)

    for (const row of (runs ?? []) as Array<{
      automation_id: string
      status: string
      started_at: string
      completed_at: string | null
    }>) {
      if (!lastRunByAutomation.has(row.automation_id)) {
        lastRunByAutomation.set(row.automation_id, {
          status: row.status,
          started_at: row.started_at,
          completed_at: row.completed_at,
        })
      }
    }
  }

  const enriched = list.map((a: Record<string, unknown> & { id: string }) => ({
    ...a,
    last_run: lastRunByAutomation.get(a.id) ?? null,
  }))

  return NextResponse.json({
    automations: enriched,
    automationAllowed,
    planId,
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

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
  const trial = isTrialActive(billing.subscription)
  const planId = billing.subscription?.plan_id ?? "solo"
  if (!canUseFeature(planId, "automation", trial)) {
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

  const trigger_type = body.trigger_type as WorkflowTriggerType | undefined
  if (!trigger_type || !TRIGGER_TYPES.has(trigger_type)) {
    return jsonError("Invalid trigger_type.", 400)
  }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return jsonError("Name is required.", 400)

  const { data, error } = await supabase
    .from("workflow_automations")
    .insert({
      organization_id: organizationId,
      name,
      description: typeof body.description === "string" ? body.description : "",
      enabled: body.enabled !== false,
      trigger_type,
      trigger_config: body.trigger_config ?? {},
      condition_config: body.condition_config ?? {},
      action_config: body.action_config ?? { actions: [] },
      created_by: user.id,
    })
    .select("*")
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ automation: data })
}
