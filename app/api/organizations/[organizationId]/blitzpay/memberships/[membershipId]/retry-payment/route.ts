import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getBlitzpayMembershipById, insertMembershipEvent } from "@/lib/blitzpay/blitzpay-memberships"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; membershipId: string }> },
) {
  const { organizationId, membershipId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(membershipId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/memberships/[membershipId]/retry-payment",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 })
  }
  const now = new Date().toISOString()
  try {
    await admin
      .from("blitzpay_membership_payment_failures")
      .update({ recovery_status: "recovered", updated_at: now, next_retry_at: null })
      .eq("organization_id", organizationId)
      .eq("membership_id", membershipId)
      .eq("recovery_status", "open")

    await admin
      .from("blitzpay_memberships")
      .update({ status: "active", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", membershipId)
      .in("status", ["delinquent", "paused"])

    await insertMembershipEvent(admin, {
      organizationId,
      membershipId,
      eventType: "retry_payment",
      eventSummary: "Staff requested payment retry / recovery reset (deterministic bookkeeping only).",
    })
    const membership = await getBlitzpayMembershipById(admin, organizationId, membershipId)
    return NextResponse.json({ membership, note: "No Stripe off-session charge is executed here." })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "retry_failed", message: msg }, { status: 400 })
  }
}
