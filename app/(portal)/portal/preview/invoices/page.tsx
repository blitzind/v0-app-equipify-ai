import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { fetchPortalInvoiceListItems } from "@/lib/portal/staff-preview-queries"
import { Receipt } from "lucide-react"

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const items = await fetchPortalInvoiceListItems(ctx.previewDb, ctx.organizationId, ctx.customerId)
  const totalOpen = items.reduce((s, i) => s + (i.balanceDueCents > 0 ? i.balanceDueCents : 0), 0)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Invoices"
          description="Read-only list for the preview customer. PDF downloads and online pay require a customer portal session."
        />

        <div className="portal-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex items-center justify-center w-10 h-10 rounded-lg"
              style={{ background: "var(--portal-accent-muted)" }}
            >
              <Receipt size={18} style={{ color: "var(--portal-accent)" }} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                Outstanding (excl. paid)
              </p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                {fmtCurrency(totalOpen)}
              </p>
            </div>
          </div>
        </div>

        <div className="portal-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--portal-border)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--portal-nav-text)" }}>
              {items.length} invoice{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Invoice</th>
                  <th className="px-4 py-2 font-medium">Issued</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {items.length === 0 ?
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No invoices for this account.
                    </td>
                  </tr>
                : items.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                          #{inv.invoiceNumber}
                        </p>
                        <p className="text-xs line-clamp-2" style={{ color: "var(--portal-nav-text)" }}>
                          {inv.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtDate(inv.issuedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {inv.statusLabel} · {inv.paymentStatusLabel}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
                        {fmtCurrency(inv.balanceDueCents)}
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
