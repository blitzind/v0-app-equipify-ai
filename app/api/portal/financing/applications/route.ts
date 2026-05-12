import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { listPortalFinancingApplications } from "@/lib/blitzpay/blitzpay-financing-service"
import { daysUntilExpirationYmd } from "@/lib/blitzpay/blitzpay-financing-marketplace"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  const today = new Date().toISOString().slice(0, 10)
  try {
    const applications = await listPortalFinancingApplications(svc, portalUser.organization_id, portalUser.customer_id)
    const safe = applications.map((a) => ({
      id: a.id,
      applicationType: a.application_type,
      applicationStatus: a.application_status,
      requestedAmountCents: Math.round(Number(a.requested_amount_cents)),
      approvedAmountCents: a.approved_amount_cents != null ? Math.round(Number(a.approved_amount_cents)) : null,
      expirationDate: a.expiration_date,
      daysUntilExpiration: daysUntilExpirationYmd(a.expiration_date, today),
      submittedAt: a.submitted_at,
      decisionedAt: a.decisioned_at,
      createdAt: a.created_at,
    }))
    return NextResponse.json({
      applications: safe,
      disclaimer:
        "Financing options are offered through third-party providers. Approval and terms are determined by the financing provider.",
    })
  } catch {
    return NextResponse.json({ error: "load_failed", message: "Could not load financing applications." }, { status: 500 })
  }
}
