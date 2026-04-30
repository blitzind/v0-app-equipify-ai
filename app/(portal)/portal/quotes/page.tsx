"use client"

import { useState } from "react"
import { Check, X, ChevronDown, FileText, MessageSquare, FilePen, Clock } from "lucide-react"
import { portalQuotes } from "@/lib/mock-data"
import type { Quote } from "@/lib/mock-data"

// Show all quotes so the demo is richer across all statuses
const allQuotes = portalQuotes

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

const STATUS_MAP: Record<string, { bg: string; text: string }> = {
  "Pending Approval": { bg: "#fffbeb", text: "#d97706" },
  "Approved":         { bg: "#f0fdf4", text: "#15803d" },
  "Declined":         { bg: "#fef2f2", text: "#dc2626" },
  "Expired":          { bg: "#f3f4f6", text: "#6b7280" },
}

function QuoteCard({ quote, onApprove, onDecline }: {
  quote: Quote & { currentStatus: Quote["status"] }
  onApprove: () => void
  onDecline: () => void
}) {
  const [expanded, setExpanded] = useState(quote.currentStatus === "Pending Approval")
  const [declineNote, setDeclineNote] = useState("")
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const s = STATUS_MAP[quote.currentStatus] ?? STATUS_MAP["Pending Approval"]
  const lineTotal = quote.lineItems.reduce((t, l) => t + l.qty * l.unit, 0)
  const isPending = quote.currentStatus === "Pending Approval"

  return (
    <div className="portal-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--portal-surface-2)] transition-colors text-left"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: s.bg }}>
            <FilePen size={15} style={{ color: s.text }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{quote.id}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: s.bg, color: s.text }}>{quote.currentStatus}</span>
              {isPending && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#fffbeb", color: "#d97706" }}>
                  <Clock size={10} /> Action Required
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--portal-nav-text)" }}>{quote.equipmentName}</p>
            <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
              Issued {fmtDate(quote.date)} &bull; Expires {fmtDate(quote.expiresDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
            {fmtCurrency(quote.amount)}
          </span>
          <ChevronDown size={15}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--portal-nav-icon)" }} />
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-4">
          {/* Description */}
          <div className="p-4 rounded-lg" style={{ background: "var(--portal-surface-2)", border: "1px solid var(--portal-border-light)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--portal-nav-text)" }}>Scope of Work</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--portal-secondary)" }}>{quote.description}</p>
          </div>

          {/* Line items */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--portal-border-light)" }}>
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
                {quote.lineItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--portal-border-light)" }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--portal-secondary)" }}>{item.description}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: "var(--portal-nav-text)" }}>{item.qty}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: "var(--portal-nav-text)" }}>
                      {fmtCurrency(item.unit)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                      {fmtCurrency(item.qty * item.unit)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "var(--portal-surface-2)" }}>
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-right"
                    style={{ color: "var(--portal-secondary)" }}>Total</td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums"
                    style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(lineTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="flex gap-2 p-3 rounded-lg"
              style={{ background: "var(--portal-accent-muted)", border: "1px solid #bfdbfe" }}>
              <MessageSquare size={14} className="shrink-0 mt-0.5" style={{ color: "var(--portal-accent)" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--portal-accent-text)" }}>{quote.notes}</p>
            </div>
          )}

          {/* Decline form */}
          {showDeclineForm && (
            <div className="p-4 rounded-lg" style={{ background: "var(--portal-danger-muted)", border: "1px solid #fecaca" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--portal-danger)" }}>
                Reason for declining (optional)
              </p>
              <textarea className="portal-textarea text-xs" rows={2}
                placeholder="e.g. Price is too high, will seek alternative..."
                value={declineNote} onChange={e => setDeclineNote(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button className="portal-btn-secondary text-xs h-8"
                  onClick={() => setShowDeclineForm(false)}>Cancel</button>
                <button
                  className="text-xs h-8 px-3 font-medium rounded-md transition-colors"
                  style={{ background: "var(--portal-danger)", color: "#fff" }}
                  onClick={() => { setShowDeclineForm(false); onDecline() }}>
                  Confirm Decline
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {isPending && !showDeclineForm && (
            <div className="flex items-center gap-3">
              <button className="portal-btn-secondary text-xs h-9" onClick={() => setShowDeclineForm(true)}>
                <X size={13} /> Decline
              </button>
              <button
                className="flex items-center gap-1.5 h-9 px-4 text-xs font-medium rounded-md text-white transition-colors"
                style={{ background: "var(--portal-success)" }}
                onClick={onApprove}>
                <Check size={13} /> Approve Quote {fmtCurrency(quote.amount)}
              </button>
            </div>
          )}

          {/* Status badge for resolved */}
          {quote.currentStatus === "Approved" && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--portal-success)" }}>
              <Check size={16} className="p-0.5 rounded-full" style={{ background: "#f0fdf4" }} />
              Quote approved. Our team will schedule the work and issue a work order shortly.
            </div>
          )}
          {quote.currentStatus === "Declined" && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--portal-nav-text)" }}>
              <X size={16} className="p-0.5 rounded-full" style={{ background: "#f3f4f6" }} />
              You declined this quote. Contact us if you change your mind.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PortalQuotesPage() {
  const [statuses, setStatuses] = useState<Record<string, Quote["status"]>>(() =>
    Object.fromEntries(allQuotes.map(q => [q.id, q.status]))
  )

  const quotes = allQuotes.map(q => ({ ...q, currentStatus: statuses[q.id] }))
  const pending  = quotes.filter(q => q.currentStatus === "Pending Approval")
  const resolved = quotes.filter(q => q.currentStatus !== "Pending Approval")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Quotes</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Review and approve service quotes from Equipify
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--portal-warning)" }}>
            Awaiting Your Approval ({pending.length})
          </h2>
          {pending.map((q) => (
            <QuoteCard key={q.id} quote={q}
              onApprove={() => setStatuses(s => ({ ...s, [q.id]: "Approved" }))}
              onDecline={() => setStatuses(s => ({ ...s, [q.id]: "Declined" }))} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
            Previous Quotes
          </h2>
          {resolved.map((q) => (
            <QuoteCard key={q.id} quote={q}
              onApprove={() => setStatuses(s => ({ ...s, [q.id]: "Approved" }))}
              onDecline={() => setStatuses(s => ({ ...s, [q.id]: "Declined" }))} />
          ))}
        </div>
      )}
    </div>
  )
}
