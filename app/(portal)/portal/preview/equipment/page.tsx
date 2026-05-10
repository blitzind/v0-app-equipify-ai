import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { staffPreviewEquipmentItems } from "@/lib/portal/staff-preview-queries"

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const items = await staffPreviewEquipmentItems(ctx.previewDb, ctx.organizationId, ctx.customerId)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Equipment"
          description="Assets registered to this customer for portal visibility (read-only)."
        />

        <div className="portal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Next due</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {items.length === 0 ?
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No equipment for this account.
                    </td>
                  </tr>
                : items.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                          {e.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                          {[e.manufacturer, e.category].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs">{e.statusLabel}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtDate(e.nextDueAt)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {e.locationLabel ?? "—"}
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
