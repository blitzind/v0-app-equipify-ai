import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { staffPreviewDocumentsPack } from "@/lib/portal/staff-preview-queries"

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const pack = await staffPreviewDocumentsPack(ctx.previewDb, ctx.organizationId, ctx.customerId)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Documents"
          description="Same document library rules as the live portal. View/download URLs require a customer session — preview is list-only."
        />

        <div className="portal-card overflow-hidden">
          <div className="px-4 py-3 border-b text-xs" style={{ borderColor: "var(--portal-border)", color: "var(--portal-nav-text)" }}>
            {pack.items.length} item{pack.items.length === 1 ? "" : "s"} · consolidated scope matches live portal
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {pack.items.length === 0 ?
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No documents in the library for this scope.
                    </td>
                  </tr>
                : pack.items.map((it) => (
                    <tr key={it.key}>
                      <td className="px-4 py-3">
                        <p className="font-medium line-clamp-2" style={{ color: "var(--portal-foreground)" }}>
                          {it.title}
                        </p>
                        {it.accountLabel ?
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                            {it.accountLabel}
                          </p>
                        : null}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize" style={{ color: "var(--portal-nav-text)" }}>
                        {it.kind.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-xs">{it.statusLabel}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtDate(it.occurredAt)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {it.downloadPath || it.viewPath ?
                          <span className="opacity-80">Open/download in live portal</span>
                        : <span>—</span>}
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
