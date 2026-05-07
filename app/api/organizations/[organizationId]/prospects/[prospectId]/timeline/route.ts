import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * GET /api/organizations/{org}/prospects/{prospectId}/timeline
 *
 * Read-only timeline for a prospect — proxies the existing
 * `communication_events` table filtered by `related_entity_type='prospect'`
 * (and post-conversion events linked to the resulting customer). Read
 * gate is org membership only so techs/viewers can see the audit trail.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; prospectId: string }> },
) {
  const { organizationId, prospectId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(prospectId)) {
    return jsonError("Invalid id.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Sign in required.", 401, "unauthorized")

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))
  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) return jsonError("You are not a member of this organization.", 403, "forbidden")
  }

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, converted_customer_id")
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .maybeSingle()
  if (!prospect) return jsonError("Prospect not found.", 404, "not_found")

  const customerId = (prospect as { converted_customer_id?: string | null }).converted_customer_id

  // Pull events tied directly to the prospect, plus any post-conversion
  // events attached to the resulting customer with our metadata pointer.
  const { data: prospectEvents } = await supabase
    .from("communication_events")
    .select(
      "id, channel, direction, event_type, title, summary, body, recipient_address, related_entity_type, related_entity_id, provider, metadata, sent_at, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("related_entity_type", "prospect")
    .eq("related_entity_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(200)

  let conversionEvents: typeof prospectEvents = []
  if (customerId) {
    const { data } = await supabase
      .from("communication_events")
      .select(
        "id, channel, direction, event_type, title, summary, body, recipient_address, related_entity_type, related_entity_id, provider, metadata, sent_at, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("related_entity_type", "customer")
      .eq("related_entity_id", customerId)
      .eq("event_type", "prospect_converted")
      .order("created_at", { ascending: false })
      .limit(20)
    conversionEvents = data ?? []
  }

  return NextResponse.json({
    events: [...(prospectEvents ?? []), ...(conversionEvents ?? [])].sort(
      (a, b) => Date.parse(b.created_at as string) - Date.parse(a.created_at as string),
    ),
  })
}
