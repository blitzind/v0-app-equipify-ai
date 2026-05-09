import { redirect } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { StaffPortalPreview } from "@/components/portal/staff-portal-preview"
import { pickPreferredDocumentLogoUrl } from "@/lib/organization/document-branding"
import { loadStaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Matches portal preview bridge: managers and above for the selected workspace. */
const PREVIEW_BRIDGE_ROLES = new Set(["owner", "admin", "manager"])

export default async function PortalStaffPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>
}) {
  const sp = await searchParams
  const organizationId = sp.organizationId?.trim() ?? ""

  if (!UUID_RE.test(organizationId)) {
    redirect("/settings/portal")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect(`/login?next=${encodeURIComponent(`/portal/preview?organizationId=${organizationId}`)}`)
  }

  const rawRole = await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = rawRole ?? ""
  if (!PREVIEW_BRIDGE_ROLES.has(role)) {
    redirect("/settings/portal")
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, logo_url, document_logo_url, status, portal_certificate_release_mode, portal_consolidated_documents_default",
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
  const snapshot = await loadStaffPortalPreviewSnapshot(previewDb, organizationId)

  const orgRow = org as {
    portal_certificate_release_mode?: string | null
    portal_consolidated_documents_default?: boolean | null
  }

  return (
    <StaffPortalPreview
      organizationName={name}
      logoUrl={logoUrl}
      snapshot={snapshot}
      organizationPortalDefaults={{
        portalCertificateReleaseMode: orgRow.portal_certificate_release_mode ?? null,
        portalConsolidatedDocumentsDefault: orgRow.portal_consolidated_documents_default === true,
      }}
    />
  )
}
