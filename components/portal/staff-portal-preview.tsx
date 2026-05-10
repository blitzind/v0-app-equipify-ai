import { StaffPreviewFrame } from "@/components/portal/staff-preview-frame"
import { StaffPortalPreviewDashboard } from "@/components/portal/staff-portal-preview-dashboard"
import type { StaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"

export function StaffPortalPreview({
  organizationId,
  organizationName,
  logoUrl,
  portalAccentCssVariables: accentVars,
  snapshot,
  organizationPortalDefaults,
}: {
  organizationId: string
  organizationName: string
  logoUrl: string | null
  /** Same `--portal-accent*` variables as the live portal shell (from `organizations.primary_color`). */
  portalAccentCssVariables: Record<string, string>
  snapshot: StaffPortalPreviewSnapshot
  organizationPortalDefaults: {
    portalCertificateReleaseMode: string | null
    portalConsolidatedDocumentsDefault: boolean
  }
}) {
  const customerId = snapshot.previewCustomer?.id ?? ""

  return (
    <StaffPreviewFrame
      organizationId={organizationId}
      customerId={customerId}
      organizationName={organizationName}
      logoUrl={logoUrl}
      portalAccentCssVariables={accentVars}
      snapshot={snapshot}
    >
      <StaffPortalPreviewDashboard
        organizationId={organizationId}
        customerId={customerId}
        snapshot={snapshot}
        organizationPortalDefaults={organizationPortalDefaults}
      />
    </StaffPreviewFrame>
  )
}
