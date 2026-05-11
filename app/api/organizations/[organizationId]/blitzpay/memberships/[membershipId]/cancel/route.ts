import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getBlitzpayMembershipById, insertMembershipEvent } from "@/lib/blitzpay/blitzpay-memberships"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; membershipId: string }> },
) {
  const { organizationId, membershipId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(membershipId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/memberships/[membershipId]/cancel",
  )
  if (schemaResp) return schemaResp

  let reason: string | null = null
  try {
    const b = (await request.json()) as { reason?: string }
    reason = typeof b.reason === "string" ? b.reason.slice(0, 500) : null
  } catch {
    reason = null
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 })
  }
  const now = new Date().toISOString()
  try {
    await admin
      .from("blitzpay_memberships")
      .update({
        status: "canceled",
        canceled_at: now,
        cancellation_reason: reason,
        auto_bill_enabled: false,
        updated_at: now,
      })
      .eq("id", membershipId)
      .eq("organization_id", organizationId)
    await insertMembershipEvent(admin, {
      organizationId,
      membershipId,
      eventType: "canceled",
      eventSummary: "Membership canceled by staff.",
      metadata: { reason },
    })
    const membership = await getBlitzpayMembershipById(admin, organizationId, membershipId)
    return NextResponse.json({ membership })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "cancel_failed", message: msg }, { status: 400 })
  }
}
