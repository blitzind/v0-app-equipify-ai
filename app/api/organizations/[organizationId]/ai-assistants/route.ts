import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ASSISTANT_UI, ASSISTANT_TASK_MAP } from "@/lib/ai/operational-assistants/registry"
import { OPERATIONAL_ASSISTANT_IDS } from "@/lib/ai/operational-assistants/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
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

  const assistants = OPERATIONAL_ASSISTANT_IDS.map((id) => ({
    id,
    taskId: ASSISTANT_TASK_MAP[id],
    ...ASSISTANT_UI[id],
  }))

  return NextResponse.json({ ok: true, assistants })
}
