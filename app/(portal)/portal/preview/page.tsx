import { redirect } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOrganizationMemberRecord } from "@/lib/api/org-role"
import { StaffPortalPreview } from "@/components/portal/staff-portal-preview"
import { pickPreferredDocumentLogoUrl } from "@/lib/organization/document-branding"
import { loadStaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"
import { portalAccentCssVariables, resolvePortalPrimaryAccentHex } from "@/lib/portal/portal-theme-css"
import { staffMayOpenPortalPreviewFromMembership } from "@/lib/portal/preview-access"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function PortalStaffPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const organizationId = sp.organizationId?.trim() ?? ""
  const rawCustomerId = sp.customerId?.trim() ?? ""
  const customerIdParam = UUID_RE.test(rawCustomerId) ? rawCustomerId : null

  if (!UUID_RE.test(organizationId)) {
    redirect("/settings/portal")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    const nextPath =
      customerIdParam ?
        `/portal/preview?organizationId=${encodeURIComponent(organizationId)}&customerId=${encodeURIComponent(customerIdParam)}`
      : `/portal/preview?organizationId=${encodeURIComponent(organizationId)}`
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const member = await getOrganizationMemberRecord(supabase, user.id, organizationId)
  if (!staffMayOpenPortalPreviewFromMembership(member)) {
    redirect("/settings/portal")
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, logo_url, document_logo_url, primary_color, status, portal_certificate_release_mode, portal_consolidated_documents_default",
    )
    .eq("id", organizationId)
    .maybeSingle()

  if (!org || (org as { status?: string }).status === "archived") {
    redirect("/settings/portal")
  }

  const name = String((org as { name?: string }).name ?? "").trim() || "Organization"
  const logoUrl = pickPreferredDocumentLogoUrl(
    (org as { document_logo_url?: string | null }).document_logo_url,
    (org as { logo_url?: string | null }).logo_url,
  )

  /**
   * Preview reads org-scoped operational rows (customers, equipment, documents, etc.).
   * Staff JWT + RLS can hide customers for users who also hold the `tech` role
   * (`can_read_customer_for_role` requires WO linkage). After we verified
   * owner/admin/manager access, use the service role only for read queries that
   * are always filtered by `organizationId` — no portal session cookies, no cross-org reads.
   */
  const previewDb = createServiceRoleSupabaseClient()
  const snapshot = await loadStaffPortalPreviewSnapshot(previewDb, organizationId, {
    customerId: customerIdParam,
  })

  const orgRow = org as {
    primary_color?: string | null
    portal_certificate_release_mode?: string | null
    portal_consolidated_documents_default?: boolean | null
  }

  const portalAccentVars = portalAccentCssVariables(resolvePortalPrimaryAccentHex(orgRow.primary_color))

  return (
    <StaffPortalPreview
      organizationId={organizationId}
      organizationName={name}
      logoUrl={logoUrl}
      portalAccentCssVariables={portalAccentVars}
      snapshot={snapshot}
      organizationPortalDefaults={{
        portalCertificateReleaseMode: orgRow.portal_certificate_release_mode ?? null,
        portalConsolidatedDocumentsDefault: orgRow.portal_consolidated_documents_default === true,
      }}
    />
  )
}
