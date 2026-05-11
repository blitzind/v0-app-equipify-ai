import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { fetchOrganizationSeatMetrics } from "@/lib/billing/seat-counts"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: mem, error: memErr } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return NextResponse.json({ error: "query_failed", message: memErr.message }, { status: 500 })
  }
  if (!mem) {
    return NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 })
  }

  const metrics = await fetchOrganizationSeatMetrics(supabase, organizationId)
  if (!metrics) {
    return NextResponse.json(
      { error: "metrics_unavailable", message: "Could not load seat metrics. Try again." },
      { status: 503 },
    )
  }

  return NextResponse.json(metrics)
}
