"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"

type Inv = {
  id: string
  invoiceNumber: string
  title: string
  amountCents: number
  statusLabel: string
  issuedAt: string
  dueDate?: string | null
  payOnlineReady: boolean
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export default function PortalInvoicesPage() {
  const [items, setItems] = useState<Inv[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/portal/invoices")
      .then((r) => r.json())
      .then((j: { items?: Inv[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  const totalOpen = items.filter((i) => i.statusLabel !== "Paid").reduce((s, i) => s + i.amountCents, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Invoices
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Balances and payment history for your account.
        </p>
      </div>

      <div className="portal-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "var(--portal-accent-muted)" }}>
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
        {loading && <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>No invoices yet.</p>
        )}
        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide" style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">Due</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium text-right">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pay</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0" style={{ borderColor: "var(--portal-border-light)" }}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/portal/invoices/${inv.id}`}
                        className="text-xs font-mono font-medium hover:underline"
                        style={{ color: "var(--portal-accent)" }}
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                        {inv.title}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--portal-secondary)" }}>
                      {fmtDate(inv.issuedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-xs hidden md:table-cell" style={{ color: "var(--portal-secondary)" }}>
                      {inv.dueDate ? fmtDate(inv.dueDate) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                      {fmtCurrency(inv.amountCents)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right" style={{ color: "var(--portal-nav-text)" }}>
                      {inv.statusLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-7" disabled>
                        Pay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
