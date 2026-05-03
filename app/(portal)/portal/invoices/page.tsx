"use client"

import { useState } from "react"
import { Receipt, FileDown, ChevronDown, ExternalLink, CheckCircle2, AlertTriangle, Clock, CreditCard } from "lucide-react"
import { portalInvoices } from "@/lib/mock-data"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import type { Invoice } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
const myInvoices = portalInvoices.filter((i) => i.customerId === CUSTOMER_ID)

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

const STATUS_MAP: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  "Paid":    { bg: "#f0fdf4", text: "#15803d", icon: CheckCircle2 },
  "Unpaid":  { bg: "#fffbeb", text: "#d97706", icon: Clock },
  "Overdue": { bg: "#fef2f2", text: "#dc2626", icon: AlertTriangle },
  "Draft":   { bg: "#f3f4f6", text: "#6b7280", icon: Receipt },
}

function InvoiceRow({ inv, expanded, onToggle, onPay }: {
  inv: Invoice; expanded: boolean; onToggle: () => void; onPay: () => void
}) {
  const s = STATUS_MAP[inv.status] ?? STATUS_MAP.Unpaid
  const StatusIcon = s.icon
  const lineTotal = inv.lineItems.reduce((t, l) => t + l.qty * l.unit, 0)

  return (
    <div className="border-b last:border-b-0 transition-colors"
      style={{ borderColor: "var(--portal-border-light)" }}>
      {/* Summary row */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--portal-surface-2)] transition-colors text-left"
        onClick={onToggle}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: s.bg }}>
            <StatusIcon size={14} style={{ color: s.text }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{inv.id}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: s.bg, color: s.text }}>{inv.status}</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
              Issued {fmtDate(inv.date)} &bull; Due {fmtDate(inv.dueDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
            {fmtCurrency(inv.amount)}
          </span>
          <ChevronDown size={15}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--portal-nav-icon)" }} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 pt-1">
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--portal-border-light)" }}>
            {/* Line items */}
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--portal-border-light)", background: "var(--portal-surface-2)" }}>
                  {["Description", "Qty", "Unit Price", "Total"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium"
                      style={{ color: "var(--portal-nav-text)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.lineItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--portal-border-light)" }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--portal-secondary)" }}>
                      {item.description}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: "var(--portal-nav-text)" }}>
                      {item.qty}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: "var(--portal-nav-text)" }}>
                      {fmtCurrency(item.unit)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                      {fmtCurrency(item.qty * item.unit)}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ background: "var(--portal-surface-2)" }}>
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-right"
                    style={{ color: "var(--portal-secondary)" }}>Total</td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums"
                    style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(lineTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button className="portal-btn-secondary text-xs h-8 px-3">
                <FileDown size={13} /> Download PDF
              </button>
              <button className="portal-btn-secondary text-xs h-8 px-3">
                <ExternalLink size={13} /> Work Order {getWorkOrderDisplay({ id: inv.workOrderId })}
              </button>
            </div>
            {inv.status !== "Paid" && (
              <button className="portal-btn-primary text-xs h-8 px-4" onClick={onPay}>
                <CreditCard size={13} /> Pay Now {fmtCurrency(inv.amount)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortalInvoicesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(myInvoices[0]?.id ?? null)
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set(
    myInvoices.filter(i => i.status === "Paid").map(i => i.id)
  ))

  const displayInvoices = myInvoices.map(inv => ({
    ...inv,
    status: paidIds.has(inv.id) ? "Paid" as const : inv.status,
  }))

  const unpaidTotal = displayInvoices.filter(i => i.status !== "Paid").reduce((s, i) => s + i.amount, 0)
  const overdueTotal = displayInvoices.filter(i => i.status === "Overdue").reduce((s, i) => s + i.amount, 0)
  const paidTotal = displayInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Invoices</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          View, download, and pay your invoices
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Outstanding", value: fmtCurrency(unpaidTotal), color: unpaidTotal > 0 ? "var(--portal-warning)" : "var(--portal-success)" },
          { label: "Overdue", value: fmtCurrency(overdueTotal), color: overdueTotal > 0 ? "var(--portal-danger)" : "var(--portal-success)" },
          { label: "Paid to Date", value: fmtCurrency(paidTotal), color: "var(--portal-success)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="portal-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>{label}</p>
            <p className="text-xl font-semibold tabular-nums mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div className="portal-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--portal-border-light)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>All Invoices</h2>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--portal-hover)", color: "var(--portal-nav-text)" }}>
            {displayInvoices.length} invoices
          </span>
        </div>
        <div>
          {displayInvoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              inv={inv}
              expanded={expandedId === inv.id}
              onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
              onPay={() => setPaidIds((prev) => new Set([...prev, inv.id]))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
