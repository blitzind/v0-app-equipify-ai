import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"

export default async function StaffPreviewServiceRequestsPage({
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
          title="Service requests"
          description="The live portal only lists requests created by the signed-in portal user. Staff preview has no portal user cookie, so this list is not shown here."
        />

        <div className="portal-card p-5 space-y-3 text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          <p>
            To see request intake as a customer, use a portal invite and sign in. Submitting new requests from the staff
            preview is intentionally disabled.
          </p>
          <p className="text-xs">
            The overview snapshot may still show counts or recent request summaries derived from org data — those are
            read-only and scoped to the selected preview customer. In the live portal, SLA / contract hints on the Service
            requests page still require a signed-in portal user.
          </p>
        </div>
      </div>
    </StaffPreviewSubpageShell>
  )
}
