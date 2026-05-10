import "server-only"

import { redirect } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { pickPreferredDocumentLogoUrl } from "@/lib/organization/document-branding"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { portalAccentCssVariables, resolvePortalPrimaryAccentHex } from "@/lib/portal/portal-theme-css"
import { staffMayOpenPortalPreview } from "@/lib/portal/preview-access"
import type { StaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"
import { loadStaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type StaffPreviewServerContext = {
  organizationId: string
  customerId: string
  organizationName: string
  logoUrl: string | null
  portalAccentCssVariables: Record<string, string>
  snapshot: StaffPortalPreviewSnapshot
  organizationPortalDefaults: {
    portalCertificateReleaseMode: string | null
    portalConsolidatedDocumentsDefault: boolean
  }
  previewDb: SupabaseClient
}

function previewPathWithQuery(organizationId: string, customerId: string | null, path: string) {
  const q = new URLSearchParams()
  q.set("organizationId", organizationId)
  if (customerId) q.set("customerId", customerId)
  return `${path}?${q.toString()}`
}

/**
 * Staff portal preview: dashboard Supabase session + `canManagePortalSettings`,
 * then service-role reads scoped to org + selected customer (same as snapshot loader).
 */
export async function requireStaffPreviewContext(
  searchParams: { organizationId?: string; customerId?: string },
  opts?: { requireSelectedCustomer?: boolean },
): Promise<StaffPreviewServerContext> {
  const requireCustomer = opts?.requireSelectedCustomer === true

  const organizationId = searchParams.organizationId?.trim() ?? ""
  const rawCustomerId = searchParams.customerId?.trim() ?? ""
  const customerIdParam = UUID_RE.test(rawCustomerId) ? rawCustomerId : null

  if (!UUID_RE.test(organizationId)) {
    redirect("/settings/portal")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect(
      `/login?next=${encodeURIComponent(previewPathWithQuery(organizationId, customerIdParam, "/portal/preview"))}`,
    )
  }

  const rawRole = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!staffMayOpenPortalPreview(rawRole)) {
    redirect(`/portal/login?error=preview_forbidden&next=${encodeURIComponent("/portal/dashboard")}`)
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

  if (requireCustomer) {
    if (!snapshot.previewCustomer) {
      redirect(`/portal/preview?organizationId=${encodeURIComponent(organizationId)}`)
    }
  }

  const customerId = snapshot.previewCustomer?.id ?? ""

  if (requireCustomer && !UUID_RE.test(customerId)) {
    redirect(`/portal/preview?organizationId=${encodeURIComponent(organizationId)}`)
  }

  return {
    organizationId,
    customerId,
    organizationName: name,
    logoUrl,
    portalAccentCssVariables: portalAccentVars,
    snapshot,
    organizationPortalDefaults: {
      portalCertificateReleaseMode: orgRow.portal_certificate_release_mode ?? null,
      portalConsolidatedDocumentsDefault: orgRow.portal_consolidated_documents_default === true,
    },
    previewDb,
  }
}
