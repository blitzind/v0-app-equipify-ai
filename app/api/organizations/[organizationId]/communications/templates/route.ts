import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { DEFAULT_COMMUNICATION_TEMPLATES } from "@/lib/communications/default-templates"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId: rawOrg } = await context.params
  const organizationId = parseUuid(rawOrg)
  if (!organizationId) {
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

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "No access to this organization." }, { status: 403 })
  }

  const { count, error: countErr } = await supabase
    .from("communication_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (countErr) {
    return NextResponse.json({ error: "query_failed", message: countErr.message }, { status: 500 })
  }

  if ((count ?? 0) === 0) {
    const seedRows = DEFAULT_COMMUNICATION_TEMPLATES.map((t) => ({
      organization_id: organizationId,
      template_key: t.template_key,
      name: t.name,
      category: t.category,
      subject: t.subject,
      body: t.body,
      channel: t.channel,
      created_by: user.id,
    }))
    const { error: insErr } = await supabase.from("communication_templates").insert(seedRows)
    if (insErr) {
      return NextResponse.json({ error: "seed_failed", message: insErr.message }, { status: 500 })
    }
  }

  const { data: rows, error: listErr } = await supabase
    .from("communication_templates")
    .select("id, template_key, name, category, subject, body, channel, updated_at")
    .eq("organization_id", organizationId)
    .order("category", { ascending: true })

  if (listErr) {
    return NextResponse.json({ error: "query_failed", message: listErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, templates: rows ?? [] })
}
