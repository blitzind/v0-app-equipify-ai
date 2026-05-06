import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; eventId: string }> },
) {
  const { organizationId: rawOrg, eventId: rawEvent } = await context.params
  const organizationId = parseUuid(rawOrg)
  const eventId = parseUuid(rawEvent)
  if (!organizationId || !eventId) {
    return NextResponse.json({ error: "invalid_ids", message: "Invalid ids." }, { status: 400 })
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

  const { data: ev, error: evErr } = await supabase
    .from("communication_events")
    .select("id, organization_id")
    .eq("id", eventId)
    .maybeSingle()

  if (evErr || !ev || (ev as { organization_id: string }).organization_id !== organizationId) {
    return NextResponse.json({ error: "not_found", message: "Event not found." }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { error: insErr } = await supabase.from("communication_event_reads").upsert(
    {
      communication_event_id: eventId,
      user_id: user.id,
      read_at: now,
    },
    { onConflict: "communication_event_id,user_id" },
  )

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
