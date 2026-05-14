import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { fetchOrganizationSeatMetrics } from "@/lib/billing/seat-counts"
import { requireOrganizationMember } from "@/lib/email/route-auth"
import { equipmentSaveServerDebug } from "@/lib/billing/equipment-save-server-debug"

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

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
    }

    equipmentSaveServerDebug("seat_metrics_eligibility_fetch", {
      helper: "GET /seat-metrics",
      organizationId,
    })

    const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
    if (!allowed) {
      return NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 })
    }

    equipmentSaveServerDebug("seat_metrics_fetch", {
      helper: "fetchOrganizationSeatMetrics",
      organizationId,
    })

    const metrics = await fetchOrganizationSeatMetrics(supabase, organizationId)
    if (!metrics) {
      return NextResponse.json(
        { error: "metrics_unavailable", message: "Could not load seat metrics. Try again." },
        { status: 503 },
      )
    }

    return NextResponse.json(metrics)
  } catch (e) {
    equipmentSaveServerDebug("seat_metrics_route_error", {
      helper: "GET /seat-metrics",
      organizationId,
      message: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: "server_error", message: "Could not load seat metrics. Try again." },
      { status: 503 },
    )
  }
}
