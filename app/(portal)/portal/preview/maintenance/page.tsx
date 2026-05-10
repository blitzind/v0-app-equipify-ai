import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { staffPreviewMaintenancePayload } from "@/lib/portal/staff-preview-queries"

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const { items, forecast } = await staffPreviewMaintenancePayload(ctx.previewDb, ctx.organizationId, ctx.customerId)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Maintenance"
          description={`${forecast.forecastableCount} plan${forecast.forecastableCount === 1 ? "" : "s"} with dates · overdue ${forecast.overdue} (portal-facing summary).`}
        />

        <div className="portal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium">Equipment</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Next due</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {items.length === 0 ?
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No maintenance plans for this account.
                    </td>
                  </tr>
                : items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                          {p.name}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                          {p.intervalLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {p.equipmentName}
                      </td>
                      <td className="px-4 py-3 text-xs">{p.statusLabel}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtDate(p.nextDueDate)}
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
