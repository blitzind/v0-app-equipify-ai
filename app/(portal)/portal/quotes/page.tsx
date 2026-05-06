"use client"

import { useEffect, useState } from "react"
import { FilePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Quote = {
  id: string
  quoteNumber: string
  title: string
  amountCents: number
  statusLabel: string
  createdAt: string
  canApprove: boolean
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalQuotesPage() {
  const [items, setItems] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  function reload() {
    fetch("/api/portal/quotes")
      .then((r) => r.json())
      .then((j: { items?: Quote[] }) => setItems(j.items ?? []))
  }

  useEffect(() => {
    fetch("/api/portal/quotes")
      .then((r) => r.json())
      .then((j: { items?: Quote[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function approve(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/portal/quotes/${id}/approve`, { method: "POST" })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(j.error ?? "Could not approve quote.")
      toast.success("Quote approved.")
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Quotes
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Review and approve estimates from your service provider.
        </p>
      </div>

      <div className="portal-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <FilePen size={16} style={{ color: "var(--portal-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Quotes
          </span>
        </div>
        {loading && <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>No quotes yet.</p>
        )}
        {!loading && items.length > 0 && (
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {items.map((q) => (
              <div key={q.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono font-medium" style={{ color: "var(--portal-nav-text)" }}>
                    {q.quoteNumber}
                  </p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: "var(--portal-foreground)" }}>
                    {q.title}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--portal-nav-text)" }}>
                    {fmtDate(q.createdAt)} • {q.statusLabel}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                    {fmtCurrency(q.amountCents)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    disabled={!q.canApprove || busyId === q.id}
                    onClick={() => approve(q.id)}
                  >
                    {busyId === q.id ? "Saving…" : q.canApprove ? "Approve" : "—"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
