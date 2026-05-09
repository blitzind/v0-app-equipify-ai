"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarClock, CheckCircle2, ClipboardList, Clock3, Search, Wrench } from "lucide-react"

type Wo = {
  id: string
  display: string
  title: string
  statusLabel: string
  appointmentGroup: "upcoming" | "in_progress" | "completed" | "all"
  isAppointment: boolean
  typeLabel: string
  scheduledOn: string | null
  /**
   * Phase: Scheduling Field-Speed Polish — start time (HH:MM, 24h) of the
   * appointment. Optional; the API returns null for legacy or unscheduled
   * records.
   */
  scheduledTime: string | null
  completedAt: string | null
  equipmentName: string
  locationLabel: string | null
  technicianName: string | null
}

type Filter = "upcoming" | "in_progress" | "completed" | "all"

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
    "Pending confirmation": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    Canceled: { bg: "var(--portal-danger-muted)", text: "var(--portal-danger)" },
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

function whenLabel(wo: Wo): string {
  if (wo.appointmentGroup === "completed") return wo.completedAt ? fmtDate(wo.completedAt.slice(0, 10)) : fmtDate(wo.scheduledOn)
  const time = fmtTime(wo.scheduledTime)
  return `${fmtDate(wo.scheduledOn)}${time ? ` at ${time}` : ""}`
}

function ServiceCard({ wo }: { wo: Wo }) {
  const Icon = wo.appointmentGroup === "completed" ? CheckCircle2 : wo.appointmentGroup === "in_progress" ? Wrench : CalendarClock
  return (
    <div className="portal-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--portal-accent-muted)" }}>
          <Icon size={17} style={{ color: "var(--portal-accent)" }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>{wo.title}</p>
            <StatusBadge status={wo.statusLabel} />
          </div>
          <p className="mt-1 text-xs font-medium" style={{ color: "var(--portal-secondary)" }}>
            {whenLabel(wo)}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
            {[wo.display, wo.equipmentName, wo.locationLabel, wo.technicianName ? `Technician: ${wo.technicianName}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/portal/documents" className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-accent)" }}>
              Documents
            </Link>
            <Link href="/portal/certificates" className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-nav-text)" }}>
              Certificates
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PortalWorkOrdersPage() {
  const [items, setItems] = useState<Wo[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("upcoming")

  useEffect(() => {
    fetch("/api/portal/work-orders")
      .then((r) => r.json())
      .then((j: { items?: Wo[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((w) => {
      if (filter !== "all" && w.appointmentGroup !== filter) return false
      const hay = `${w.display} ${w.title} ${w.equipmentName} ${w.technicianName ?? ""}`.toLowerCase()
      return q ? hay.includes(q) : true
    })
  }, [items, query, filter])

  const upcoming = useMemo(
    () =>
      items
        .filter((w) => w.appointmentGroup === "upcoming" && w.isAppointment)
        .sort((a, b) => `${a.scheduledOn ?? ""} ${a.scheduledTime ?? ""}`.localeCompare(`${b.scheduledOn ?? ""} ${b.scheduledTime ?? ""}`)),
    [items],
  )
  const recentCompleted = useMemo(
    () =>
      items
        .filter((w) => w.appointmentGroup === "completed")
        .slice(0, 4),
    [items],
  )
  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "upcoming", label: "Upcoming", count: items.filter((w) => w.appointmentGroup === "upcoming").length },
    { id: "in_progress", label: "In progress", count: items.filter((w) => w.appointmentGroup === "in_progress").length },
    { id: "completed", label: "Completed", count: items.filter((w) => w.appointmentGroup === "completed").length },
    { id: "all", label: "All", count: items.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Service visits
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            Upcoming appointments and service history across your locations.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={15} style={{ color: "var(--portal-accent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Upcoming service visits</h2>
          </div>
          {loading ? (
            <p className="portal-card p-4 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading appointments…</p>
          ) : upcoming.length === 0 ? (
            <p className="portal-card p-4 text-sm" style={{ color: "var(--portal-nav-text)" }}>No upcoming scheduled visits.</p>
          ) : (
            <div className="space-y-3">{upcoming.slice(0, 3).map((wo) => <ServiceCard key={wo.id} wo={wo} />)}</div>
          )}
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 size={15} style={{ color: "var(--portal-accent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Recent service activity</h2>
          </div>
          {loading ? (
            <p className="portal-card p-4 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading service history…</p>
          ) : recentCompleted.length === 0 ? (
            <p className="portal-card p-4 text-sm" style={{ color: "var(--portal-nav-text)" }}>No completed service visits yet.</p>
          ) : (
            <div className="space-y-3">{recentCompleted.map((wo) => <ServiceCard key={wo.id} wo={wo} />)}</div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: filter === f.id ? "var(--portal-accent)" : "var(--portal-border-light)",
              background: filter === f.id ? "var(--portal-accent-muted)" : "transparent",
              color: filter === f.id ? "var(--portal-accent-text)" : "var(--portal-nav-text)",
            }}
          >
            {f.label} · {f.count}
          </button>
        ))}
      </div>

      <div className="portal-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <ClipboardList size={16} style={{ color: "var(--portal-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            {filters.find((f) => f.id === filter)?.label ?? "All"} service records
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
                  <th className="px-4 py-2.5 font-medium">Appointment / service date</th>
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
                      {wo.locationLabel ? (
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--portal-nav-text)" }}>{wo.locationLabel}</p>
                      ) : null}
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
        Need a new visit? <Link href="/portal/request-repair" style={{ color: "var(--portal-accent)" }} className="font-medium">Submit a service request</Link>. Your service provider will confirm scheduling.
      </p>
    </div>
  )
}
