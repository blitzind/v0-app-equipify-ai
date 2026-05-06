import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; templateId: string }> },
) {
  const { organizationId: rawOrg, templateId: rawTpl } = await context.params
  const organizationId = parseUuid(rawOrg)
  const templateId = parseUuid(rawTpl)
  if (!organizationId || !templateId) {
    return NextResponse.json({ error: "invalid_ids", message: "Invalid ids." }, { status: 400 })
  }

  let body: { subject?: string; body?: string; name?: string }
  try {
    body = (await request.json()) as { subject?: string; body?: string; name?: string }
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "No access to this organization." }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.subject === "string") patch.subject = body.subject
  if (typeof body.body === "string") patch.body = body.body
  if (typeof body.name === "string") patch.name = body.name

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "invalid_payload", message: "No updates." }, { status: 400 })
  }

  const { data: row, error: upErr } = await supabase
    .from("communication_templates")
    .update(patch)
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .select("id, template_key, name, category, subject, body, channel, updated_at")
    .maybeSingle()

  if (upErr) {
    return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Template not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, template: row })
}
