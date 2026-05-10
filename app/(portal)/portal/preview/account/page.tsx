import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"

export default async function StaffPreviewAccountPage({
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
          title="Account"
          description="Contacts, notification preferences, and profile edits require a customer portal session."
        />

        <div className="portal-card p-5 space-y-3 text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          <p>
            This screen is informational only in staff preview. Customers manage account details after authenticating via
            invite or magic link.
          </p>
          <p className="text-xs">
            Previewing as <strong style={{ color: "var(--portal-foreground)" }}>{ctx.snapshot.previewCustomer?.companyName}</strong>{" "}
            does not create or impersonate a <code className="text-[11px]">portal_users</code> row.
          </p>
        </div>
      </div>
    </StaffPreviewSubpageShell>
  )
}
