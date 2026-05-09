import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { resolveAiExecutionMode } from "@/lib/ai/execution-mode"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { runServiceRequestAiAssist } from "@/lib/service-requests/ai-assist"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; requestId: string }> },
) {
  const { organizationId, requestId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(requestId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  const { data: row, error } = await gate.supabase
    .from("org_service_requests")
    .select("issue_summary, description, requester_name, requester_email")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!row) return jsonError("Not found.", 404)

  const supabaseAuth = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  const { mode } = await resolveAiExecutionMode({
    organizationId,
    actingUserEmail: user?.email ?? null,
  })

  if (mode === "disabled") {
    return jsonError("AI assist is unavailable while billing is restricted.", 403)
  }

  const r = row as {
    issue_summary: string
    description: string | null
    requester_name: string | null
    requester_email: string | null
  }

  const assist = await runServiceRequestAiAssist({
    mode,
    issue_summary: r.issue_summary,
    description: r.description,
    requester_name: r.requester_name,
    requester_email: r.requester_email,
  })

  return NextResponse.json({
    assist,
    execution_mode: mode,
    disclaimer:
      "Suggestions only — confirm details before converting or messaging customers. Nothing is sent automatically.",
  })
}
