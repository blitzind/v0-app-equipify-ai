"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardList, Search } from "lucide-react"

type Wo = {
  id: string
  display: string
  title: string
  statusLabel: string
  typeLabel: string
  priority: string
  scheduledOn: string | null
  /**
   * Phase: Scheduling Field-Speed Polish — start time (HH:MM, 24h) of the
   * appointment. Optional; the API returns null for legacy or unscheduled
   * records.
   */
  scheduledTime: string | null
  completedAt: string | null
  equipmentName: string
  technicianName: string | null
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function fmtTime(hhmm: string | null) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(":")
  const hour = Number.parseInt(h ?? "", 10)
  const min = Number.parseInt(m ?? "0", 10)
  if (!Number.isFinite(hour)) return null
  const d = new Date()
  d.setHours(hour, Number.isFinite(min) ? min : 0, 0, 0)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Open: { bg: "var(--portal-accent-muted)", text: "var(--portal-accent-text)" },
    Scheduled: { bg: "#f0fdf4", text: "#15803d" },
    "In Progress": { bg: "#fff7ed", text: "#c2410c" },
    Completed: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    Invoiced: { bg: "#f5f3ff", text: "#6d28d9" },
    "Awaiting Signature": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
  }
  const s = map[status] ?? { bg: "#f3f4f6", text: "#6b7280" }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: s.bg, color: s.text }}>
      {status}
    </span>
  )
}

export default function PortalWorkOrdersPage() {
  const [items, setItems] = useState<Wo[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    fetch("/api/portal/work-orders")
      .then((r) => r.json())
      .then((j: { items?: Wo[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((w) => {
      const hay = `${w.display} ${w.title} ${w.equipmentName} ${w.technicianName ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Work Orders
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            Service activity across your locations.
          </p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--portal-nav-icon)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 rounded-md border text-xs"
            style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
          />
        </div>
      </div>

      <div className="portal-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <ClipboardList size={16} style={{ color: "var(--portal-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            All work orders
          </span>
        </div>
        {loading && <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>
            No work orders found.
          </p>
        )}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide" style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-nav-text)" }}>
                  <th className="px-4 py-2.5 font-medium">Work order</th>
                  <th className="px-4 py-2.5 font-medium">Equipment</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Scheduled</th>
                  <th className="px-4 py-2.5 font-medium">Technician</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo) => (
                  <tr key={wo.id} className="border-b last:border-0" style={{ borderColor: "var(--portal-border-light)" }}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-medium" style={{ color: "var(--portal-nav-text)" }}>
                        {wo.display}
                      </span>
                      <p className="text-sm mt-0.5" style={{ color: "var(--portal-foreground)" }}>
                        {wo.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-foreground)" }}>
                      {wo.equipmentName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={wo.statusLabel} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                      <div className="flex flex-col gap-0.5">
                        <span>{fmtDate(wo.scheduledOn)}</span>
                        {(() => {
                          const t = fmtTime(wo.scheduledTime)
                          return t ? (
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: "var(--portal-secondary)" }}
                            >
                              {t}
                            </span>
                          ) : null
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-secondary)" }}>
                      {wo.technicianName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        Need help? <Link href="/portal/request-repair" style={{ color: "var(--portal-accent)" }} className="font-medium">Submit a service request</Link>.
      </p>
    </div>
  )
}
