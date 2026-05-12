import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import {
  listAutopayEnrollmentsSafe,
  upsertAutopayEnrollment,
} from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const autopayEnrollments = await listAutopayEnrollmentsSafe(svc, portalUser.organization_id, {
      customerId: portalUser.customer_id,
    })
    return NextResponse.json({
      autopayEnrollments: autopayEnrollments.map((a) => ({
        billingProfileId: a.billingProfileId,
        enrollmentStatus: a.enrollmentStatus,
        paymentTiming: a.paymentTiming,
        failureRetryEnabled: a.failureRetryEnabled,
      })),
    })
  } catch (e) {
    logBlitzpayServerFailure("GET portal/billing/autopay", e)
    return NextResponse.json({ error: "Could not load autopay preferences." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  let body: { billingProfileId?: string; enrollmentStatus?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 })
  }
  const billingProfileId = String(body.billingProfileId || "")
  const st = String(body.enrollmentStatus || "paused")
  if (!billingProfileId || !["active", "paused"].includes(st)) {
    return NextResponse.json({ error: "billingProfileId and enrollmentStatus (active|paused) required." }, { status: 400 })
  }
  try {
    const { data: prof, error } = await svc
      .from("blitzpay_customer_billing_profiles")
      .select("id, customer_id")
      .eq("organization_id", portalUser.organization_id)
      .eq("id", billingProfileId)
      .maybeSingle()
    if (error || !prof) {
      return NextResponse.json({ error: "Billing profile not found." }, { status: 404 })
    }
    if ((prof as { customer_id: string }).customer_id !== portalUser.customer_id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    await upsertAutopayEnrollment(svc, {
      organizationId: portalUser.organization_id,
      customerId: portalUser.customer_id,
      billingProfileId,
      enrollmentStatus: st as "active" | "paused",
      enrollmentSource: "customer",
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    logBlitzpayServerFailure("POST portal/billing/autopay", e)
    return NextResponse.json({ error: "Could not update autopay preference." }, { status: 500 })
  }
}
