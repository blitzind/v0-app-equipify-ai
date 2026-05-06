import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"
import { computeCommunicationSuggestions } from "@/lib/communications/compute-suggestions"

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

  const suggestions = await computeCommunicationSuggestions(supabase, organizationId)
  return NextResponse.json({ ok: true, suggestions })
}
