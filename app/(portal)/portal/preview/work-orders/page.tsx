import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { fetchPortalWorkOrderListItems } from "@/lib/portal/staff-preview-queries"

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const items = await fetchPortalWorkOrderListItems(ctx.previewDb, ctx.organizationId, ctx.customerId)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Work orders"
          description="Service visits and jobs visible to this customer in the portal (read-only). Internal fields are not shown."
        />

        <div className="portal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Work order</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Scheduled</th>
                  <th className="px-4 py-2 font-medium">Equipment</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {items.length === 0 ?
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No work orders for this account.
                    </td>
                  </tr>
                : items.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                          {w.display}
                        </p>
                        <p className="text-xs line-clamp-2" style={{ color: "var(--portal-nav-text)" }}>
                          {w.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{w.statusLabel}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {w.scheduledOn ? fmtDate(w.scheduledOn) : "—"}
                        {w.scheduledTime ? ` · ${w.scheduledTime}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {w.equipmentName}
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
