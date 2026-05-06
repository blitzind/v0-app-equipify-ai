import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

/**
 * Session bootstrap for portal shell UI (names, ids).
 */
export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const [{ data: org }, { data: customer }] = await Promise.all([
    svc.from("organizations").select("name").eq("id", portalUser.organization_id).maybeSingle(),
    svc
      .from("customers")
      .select("company_name")
      .eq("organization_id", portalUser.organization_id)
      .eq("id", portalUser.customer_id)
      .maybeSingle(),
  ])

  const displayName =
    portalUser.display_name?.trim() ||
    portalUser.email.split("@")[0] ||
    portalUser.email

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?"

  return NextResponse.json({
    portalUserId: portalUser.id,
    organizationId: portalUser.organization_id,
    customerId: portalUser.customer_id,
    email: portalUser.email,
    displayName,
    initials,
    organizationName: (org as { name?: string } | null)?.name ?? "Organization",
    customerCompanyName: (customer as { company_name?: string } | null)?.company_name ?? "Customer",
    features: {
      onlinePayments: false,
    },
  })
}
