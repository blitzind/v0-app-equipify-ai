import { NextResponse } from "next/server"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { runOperationalAssistant } from "@/lib/ai/operational-assistants/run"
import { isOperationalAssistantId } from "@/lib/ai/operational-assistants/types"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; assistantId: string }> },
) {
  const { organizationId, assistantId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }
  if (!isOperationalAssistantId(assistantId)) {
    return NextResponse.json({ error: "invalid_assistant", message: "Unknown assistant." }, { status: 400 })
  }

  let skipCache = false
  try {
    const body = (await request.json()) as { skipCache?: boolean }
    skipCache = body?.skipCache === true
  } catch {
    // optional body
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: member, error: memberErr } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json({ error: "forbidden", message: "You do not have access to this organization." }, { status: 403 })
  }

  const featureGate = await requireFeatureAccess(supabase, organizationId, "ai")
  if (!featureGate.ok) {
    return NextResponse.json(
      { error: "feature_denied", message: featureGate.message },
      { status: featureGate.httpStatus },
    )
  }

  const result = await runOperationalAssistant(supabase, organizationId, assistantId, {
    skipCache,
    emitWorkflow: true,
  })

  if (!result.ok) {
    const msg = result.error?.message ?? "AI task failed."
    const planBlocked = result.meta.escalationReasons.includes("plan_blocked")
    return NextResponse.json(
      {
        ok: false,
        error: planBlocked ? "plan_blocked" : "ai_failed",
        message: msg,
      },
      { status: planBlocked ? 402 : 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    assistantId,
    card: result.output,
    meta: {
      task: result.meta.task,
      provider: result.meta.provider,
      model: result.meta.model,
      escalated: result.meta.escalated,
      cacheHit: result.meta.cacheHit ?? false,
      durationMs: result.meta.durationMs,
    },
  })
}
