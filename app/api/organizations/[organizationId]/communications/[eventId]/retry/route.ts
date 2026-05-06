import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid, requireOrganizationMember } from "@/lib/email/route-auth"

export const runtime = "nodejs"

/**
 * Marks a failed delivery for retry (queue). Actual provider resend hooks (Resend/Twilio) land later.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; eventId: string }> },
) {
  const { organizationId: rawOrg, eventId: rawEv } = await context.params
  const organizationId = parseUuid(rawOrg)
  const eventId = parseUuid(rawEv)
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

  const { data: ev, error: loadErr } = await supabase
    .from("communication_events")
    .select("id, organization_id, metadata, delivery_status")
    .eq("id", eventId)
    .maybeSingle()

  if (loadErr || !ev || (ev as { organization_id: string }).organization_id !== organizationId) {
    return NextResponse.json({ error: "not_found", message: "Event not found." }, { status: 404 })
  }

  const meta = ((ev as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  const { error: upErr } = await supabase
    .from("communication_events")
    .update({
      delivery_status: "queued",
      error_message: null,
      metadata: {
        ...meta,
        retry_requested_at: now,
        retry_requested_by: user.id,
      },
    })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (upErr) {
    return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: "Retry queued. Provider webhooks will confirm delivery when integrated.",
  })
}
