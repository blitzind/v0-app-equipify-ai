import { redirect } from "next/navigation"
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
    .select("name, logo_url, document_logo_url, status")
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

  const snapshot = await loadStaffPortalPreviewSnapshot(supabase, organizationId)

  return <StaffPortalPreview organizationName={name} logoUrl={logoUrl} snapshot={snapshot} />
}
