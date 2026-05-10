import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { staffPreviewCertificates } from "@/lib/portal/staff-preview-queries"

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const { items, summary } = await staffPreviewCertificates(ctx.previewDb, ctx.organizationId, ctx.customerId)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Certificates"
          description={`${summary.unlocked} available · ${summary.locked} pending for this customer. File download requires a signed-in portal session.`}
        />

        <div className="portal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Template</th>
                  <th className="px-4 py-2 font-medium">Equipment</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {items.length === 0 ?
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No calibration certificates for this account.
                    </td>
                  </tr>
                : items.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--portal-foreground)" }}>
                        {c.templateName}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {c.equipmentName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">{c.reasonLabel}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {c.unlocked && c.downloadPath ?
                          <span className="opacity-80">Live portal only</span>
                        : <span>Locked</span>}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StaffPreviewSubpageShell>
  )
}
