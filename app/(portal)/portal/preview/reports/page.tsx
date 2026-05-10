import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"

export default async function StaffPreviewReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Reports"
          description="The live customer portal /reports page still uses illustrative content in this build. Staff preview does not duplicate that mock UI."
        />

        <div className="portal-card p-5 space-y-3 text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          <p>
            After signing in as a real portal user, customers open <strong style={{ color: "var(--portal-foreground)" }}>Reports</strong>{" "}
            from the standard portal nav. There is no separate staff-preview reports dataset.
          </p>
          <p className="text-xs opacity-90">
            Use Overview and other preview sections (documents, invoices, certificates) for customer-safe, data-backed
            readouts.
          </p>
        </div>
      </div>
    </StaffPreviewSubpageShell>
  )
}
