import { NextResponse } from "next/server"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import {
  OPERATIONAL_ASSISTANT_REFRESH_TASK,
} from "@/lib/ai/jobs/run-operational-assistant-job"
import { isOperationalAssistantId } from "@/lib/ai/operational-assistants/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; assistantId: string }> },
) {
  const { organizationId, assistantId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }
  if (!isOperationalAssistantId(assistantId)) {
    return NextResponse.json({ error: "invalid_assistant", message: "Unknown assistant." }, { status: 400 })
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

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "service_unavailable", message: "Server automation unavailable." }, { status: 503 })
  }

  const jobInsert = await insertQueuedAiJob(svc, {
    organization_id: organizationId,
    created_by: user.id,
    task: OPERATIONAL_ASSISTANT_REFRESH_TASK,
    input_json: { assistantId },
    source_type: "operational_assistant",
    source_id: assistantId,
  })

  if ("error" in jobInsert) {
    return NextResponse.json({ error: "job_create_failed", message: jobInsert.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    jobId: jobInsert.jobId,
    assistantId,
    status: "queued",
    task: OPERATIONAL_ASSISTANT_REFRESH_TASK,
  })
}
