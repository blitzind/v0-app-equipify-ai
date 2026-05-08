import { NextResponse } from "next/server"
import { pickPreferredDocumentLogoUrl } from "@/lib/organization/document-branding"
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
    svc
      .from("organizations")
      .select("name, logo_url, document_logo_url")
      .eq("id", portalUser.organization_id)
      .maybeSingle(),
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

  const orgRow = org as { name?: string; logo_url?: string | null; document_logo_url?: string | null } | null
  const workspaceLogoUrl = pickPreferredDocumentLogoUrl(
    orgRow?.document_logo_url ?? null,
    orgRow?.logo_url ?? null,
  )

  return NextResponse.json({
    portalUserId: portalUser.id,
    organizationId: portalUser.organization_id,
    customerId: portalUser.customer_id,
    email: portalUser.email,
    displayName,
    initials,
    organizationName: orgRow?.name?.trim() || "Organization",
    workspaceLogoUrl,
    customerCompanyName: (customer as { company_name?: string } | null)?.company_name ?? "Customer",
    features: {
      onlinePayments: false,
    },
  })
}
