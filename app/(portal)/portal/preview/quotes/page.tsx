import { StaffPreviewPageHeading } from "@/components/portal/staff-preview-page-heading"
import { StaffPreviewSubpageShell } from "@/components/portal/staff-preview-subpage-shell"
import { requireStaffPreviewContext } from "@/lib/portal/staff-preview-load"
import { staffPreviewQuoteItems } from "@/lib/portal/staff-preview-queries"

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function StaffPreviewQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; customerId?: string }>
}) {
  const sp = await searchParams
  const ctx = await requireStaffPreviewContext(sp, { requireSelectedCustomer: true })
  const items = await staffPreviewQuoteItems(ctx.previewDb, ctx.organizationId, ctx.customerId)

  return (
    <StaffPreviewSubpageShell ctx={ctx}>
      <div className="space-y-6">
        <StaffPreviewPageHeading
          title="Quotes"
          description="Staff preview never enables approve or decline — customers must sign in to the live portal. Rows show what a customer would see."
        />

        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--portal-border)",
            background: "var(--portal-surface-2)",
            color: "var(--portal-nav-text)",
          }}
        >
          Quote actions are <strong style={{ color: "var(--portal-foreground)" }}>disabled</strong> here by design (no
          impersonation). If a quote shows as actionable for customers, it is marked below for reference only.
        </div>

        <div className="portal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--portal-surface-2)" }}>
                <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2 font-medium">Quote</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                  <th className="px-4 py-2 font-medium">Customer action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--portal-border)" }}>
                {items.length === 0 ?
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                      No quotes for this account.
                    </td>
                  </tr>
                : items.map((q) => (
                    <tr key={q.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                          #{q.quoteNumber}
                        </p>
                        <p className="text-xs line-clamp-2" style={{ color: "var(--portal-nav-text)" }}>
                          {q.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtDate(q.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs">{q.statusLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
                        {fmtCurrency(q.amountCents)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                        {q.wouldBeActionableForCustomer ? "Would be actionable in live portal" : "Not actionable"}
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
