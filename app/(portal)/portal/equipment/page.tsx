"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Search, CalendarClock, Shield, MapPin } from "lucide-react"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type EqRow = {
  id: string
  name: string
  equipmentCode: string | null
  manufacturer: string | null
  category: string | null
  serialNumber: string | null
  statusLabel: string
  installDate: string | null
  warrantyExpiresAt: string | null
  lastServiceAt: string | null
  nextDueAt: string | null
  locationLabel: string | null
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysUntil(d: string | null | undefined) {
  if (!d) return null
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Active: { bg: "#f0fdf4", text: "#15803d" },
    "Needs Service": { bg: "#fffbeb", text: "#d97706" },
    "In Repair": { bg: "#fef2f2", text: "#dc2626" },
    "Out of Service": { bg: "#f9fafb", text: "#6b7280" },
  }
  const s = map[status] ?? { bg: "#f3f4f6", text: "#6b7280" }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
      {status}
    </span>
  )
}

export default function PortalEquipmentPage() {
  const [items, setItems] = useState<EqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    fetch("/api/portal/equipment")
      .then((r) => r.json())
      .then((j: { items?: EqRow[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((e) => {
      const hay = `${e.name} ${e.equipmentCode ?? ""} ${e.serialNumber ?? ""} ${e.manufacturer ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={PAGE_STANDARD_PAGE_TITLE} style={{ color: "var(--portal-foreground)" }}>
            Equipment
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            Assets registered under your account.
          </p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--portal-nav-icon)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search equipment…"
            className="w-full pl-8 pr-3 py-2 rounded-md border text-xs"
            style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
          />
        </div>
      </div>

      {loading && (
        <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
          Loading equipment…
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <div className="portal-card p-8 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
          No equipment found.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((eq) => {
          const days = daysUntil(eq.nextDueAt)
          const warrantyDays = daysUntil(eq.warrantyExpiresAt)
          const primary = getEquipmentDisplayPrimary({
            id: eq.id,
            name: eq.name,
            equipment_code: eq.equipmentCode,
            serial_number: eq.serialNumber,
            category: eq.category,
          })
          const secondary = getEquipmentSecondaryLine(
            {
              id: eq.id,
              name: eq.name,
              equipment_code: eq.equipmentCode,
              serial_number: eq.serialNumber,
              category: eq.category,
            },
            "",
          )
          return (
            <div key={eq.id} className="portal-card overflow-hidden hover:shadow-md transition-shadow">
              <div
                className="h-1"
                style={{
                  background:
                    eq.statusLabel === "Active" ? "var(--portal-success)"
                    : eq.statusLabel === "Needs Service" ? "var(--portal-warning)"
                    : "var(--portal-danger)",
                }}
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <StatusPill status={eq.statusLabel} />
                    <h3 className="text-sm font-semibold text-pretty mt-2" style={{ color: "var(--portal-foreground)" }}>
                      {primary}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                      {secondary}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                      {[eq.manufacturer, eq.category].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs mb-4">
                  <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{eq.locationLabel ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
                    <CalendarClock size={12} className="shrink-0" />
                    <span>Next service: </span>
                    <span
                      className="font-medium"
                      style={{
                        color:
                          days != null && days <= 14 ? "var(--portal-warning)"
                          : days != null && days < 0 ? "var(--portal-danger)"
                          : "var(--portal-secondary)",
                      }}
                    >
                      {fmtDate(eq.nextDueAt)} {days != null && days < 0 ? "(overdue)" : days != null ? `(${days}d)` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
                    <Shield size={12} className="shrink-0" />
                    <span>Warranty: </span>
                    <span
                      className="font-medium"
                      style={{
                        color:
                          warrantyDays != null && warrantyDays < 0 ? "var(--portal-danger)"
                          : warrantyDays != null && warrantyDays <= 30 ? "var(--portal-warning)"
                          : "var(--portal-secondary)",
                      }}
                    >
                      {warrantyDays != null && warrantyDays < 0 ? "Expired" : `Expires ${fmtDate(eq.warrantyExpiresAt)}`}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/portal/equipment/${eq.id}`}
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-xs font-medium transition-colors"
                  style={{ background: "var(--portal-accent-muted)", color: "var(--portal-accent-text)" }}
                >
                  View details <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
