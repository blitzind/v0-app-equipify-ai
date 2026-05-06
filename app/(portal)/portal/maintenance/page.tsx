"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar } from "lucide-react"

type Plan = {
  id: string
  name: string
  statusLabel: string
  priority: string
  nextDueDate: string | null
  intervalLabel: string
  equipmentName: string
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

export default function PortalMaintenancePage() {
  const [items, setItems] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/portal/maintenance")
      .then((r) => r.json())
      .then((j: { items?: Plan[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Maintenance
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Upcoming preventive maintenance tied to your equipment.
        </p>
      </div>

      {loading && <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="portal-card p-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
          No maintenance plans found.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((p) => {
          const days = daysUntil(p.nextDueDate)
          return (
            <div key={p.id} className="portal-card p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar size={14} style={{ color: "var(--portal-accent)" }} />
                  <h3 className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>
                    {p.name}
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-semibold shrink-0" style={{ color: "var(--portal-nav-text)" }}>
                  {p.statusLabel}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                {p.equipmentName} • {p.intervalLabel}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span style={{ color: "var(--portal-nav-text)" }}>Next due</span>
                <span
                  className="font-medium"
                  style={{
                    color: days != null && days <= 14 ? "var(--portal-warning)" : "var(--portal-secondary)",
                  }}
                >
                  {fmtDate(p.nextDueDate)}
                  {days != null ? ` • ${days}d` : ""}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        Want to schedule sooner?{" "}
        <Link href="/portal/book-maintenance" style={{ color: "var(--portal-accent)" }} className="font-medium">
          Book maintenance
        </Link>
      </p>
    </div>
  )
}
