"use client"

import { use } from "react"
import Link from "next/link"
import {
  ChevronLeft, MapPin, CalendarClock, ShieldCheck,
  Hash, Wrench, CheckCircle2, Clock, AlertTriangle,
  FileDown, ArrowUpRight,
} from "lucide-react"
import { equipment, workOrders } from "@/lib/mock-data"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}
function daysUntil(d: string) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  PM:          { bg: "#eff6ff", text: "#1d4ed8" },
  Repair:      { bg: "#fef2f2", text: "#dc2626" },
  Inspection:  { bg: "#f0fdf4", text: "#15803d" },
  Install:     { bg: "#f5f3ff", text: "#6d28d9" },
}

export default function PortalEquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const eq = equipment.find((e) => e.id === id)
  if (!eq) {
    return (
      <div className="portal-card py-20 text-center">
        <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>Equipment not found</p>
        <Link href="/portal/equipment" className="text-sm mt-2 inline-flex items-center gap-1"
          style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back to equipment
        </Link>
      </div>
    )
  }

  const relatedWOs = workOrders.filter(w => w.equipmentId === id)
  const days = daysUntil(eq.nextDueDate)
  const warrantyDays = daysUntil(eq.warrantyExpiration)
  const totalSpend = eq.serviceHistory.reduce((s, h) => s + h.cost, 0)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal/equipment" className="flex items-center gap-1 font-medium"
          style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Equipment
        </Link>
        <span style={{ color: "var(--portal-nav-icon)" }}>/</span>
        <span style={{ color: "var(--portal-nav-text)" }}>{eq.model}</span>
      </div>

      {/* Header card */}
      <div className="portal-card overflow-hidden">
        <div className="h-1.5" style={{
          background: eq.status === "Active" ? "var(--portal-success)" :
            eq.status === "Needs Service" ? "var(--portal-warning)" : "var(--portal-danger)"
        }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: "var(--portal-hover)", color: "var(--portal-nav-text)" }}>{eq.id}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: eq.status === "Active" ? "#f0fdf4" : eq.status === "Needs Service" ? "#fffbeb" : "#fef2f2",
                    color: eq.status === "Active" ? "#15803d" : eq.status === "Needs Service" ? "#d97706" : "#dc2626",
                  }}>
                  {eq.status}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-balance" style={{ color: "var(--portal-foreground)" }}>{eq.model}</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{eq.manufacturer} &bull; {eq.category}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/portal/request-repair?equipment=${eq.id}`} className="portal-btn-primary">
                <Wrench size={14} /> Request Repair
              </Link>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Hash, label: "Serial No.", value: eq.serialNumber },
              { icon: MapPin, label: "Location", value: eq.location },
              { icon: CalendarClock, label: "Installed", value: fmtDate(eq.installDate) },
              { icon: ShieldCheck, label: "Warranty", value: warrantyDays < 0 ? "Expired" : `Exp. ${fmtDate(eq.warrantyExpiration)}`,
                warn: warrantyDays < 0 || warrantyDays <= 30 },
            ].map(({ icon: Icon, label, value, warn }) => (
              <div key={label}>
                <p className="text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>
                  <Icon size={11} className="inline mr-1" />{label}
                </p>
                <p className="text-sm font-medium"
                  style={{ color: warn ? "var(--portal-warning)" : "var(--portal-secondary)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Next service bar */}
          <div className="mt-5 p-3 rounded-lg flex items-center justify-between"
            style={{
              background: days < 0 ? "var(--portal-danger-muted)" : days <= 14 ? "var(--portal-warning-muted)" : "var(--portal-accent-muted)",
              border: `1px solid ${days < 0 ? "#fecaca" : days <= 14 ? "#fed7aa" : "#bfdbfe"}`,
            }}>
            <div className="flex items-center gap-2">
              {days < 0 ? <AlertTriangle size={14} style={{ color: "var(--portal-danger)" }} /> :
                days <= 14 ? <Clock size={14} style={{ color: "var(--portal-warning)" }} /> :
                <CalendarClock size={14} style={{ color: "var(--portal-accent)" }} />}
              <span className="text-sm font-medium" style={{
                color: days < 0 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-accent-text)"
              }}>
                {days < 0 ? `Service overdue by ${Math.abs(days)} days` :
                  `Next service due in ${days} days — ${fmtDate(eq.nextDueDate)}`}
              </span>
            </div>
            <Link href={`/portal/book-maintenance?equipment=${eq.id}`}
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: days < 0 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-accent)" }}>
              Book service <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Services", value: eq.serviceHistory.length },
          { label: "Total Spend", value: fmtCurrency(totalSpend) },
          { label: "Last Service", value: fmtDate(eq.lastServiceDate) },
        ].map(({ label, value }) => (
          <div key={label} className="portal-card p-4 text-center">
            <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Service history timeline */}
      <div className="portal-card">
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--portal-border-light)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Service History</h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--portal-hover)", color: "var(--portal-nav-text)" }}>
            {eq.serviceHistory.length} records
          </span>
        </div>
        <div className="px-6 py-4">
          {eq.serviceHistory.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--portal-nav-text)" }}>No service history yet.</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-3 bottom-3 w-px"
                style={{ background: "var(--portal-border)" }} />
              <div className="space-y-6">
                {eq.serviceHistory.map((h, i) => {
                  const tc = TYPE_COLORS[h.type] ?? { bg: "#f3f4f6", text: "#6b7280" }
                  return (
                    <div key={h.id} className="flex gap-5">
                      {/* Dot */}
                      <div className="relative z-10 shrink-0 flex items-center justify-center w-8 h-8 rounded-full border-2"
                        style={{
                          background: i === 0 ? "var(--portal-accent)" : "var(--portal-surface)",
                          borderColor: i === 0 ? "var(--portal-accent)" : "var(--portal-border)",
                        }}>
                        {i === 0
                          ? <CheckCircle2 size={14} style={{ color: "#fff" }} />
                          : <Clock size={12} style={{ color: "var(--portal-nav-icon)" }} />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ background: tc.bg, color: tc.text }}>{h.type}</span>
                            <span className="text-xs font-mono" style={{ color: "var(--portal-nav-text)" }}>{getWorkOrderDisplay({ id: h.workOrderId })}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold tabular-nums"
                              style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(h.cost)}</span>
                            <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>{fmtDate(h.date)}</span>
                          </div>
                        </div>
                        <p className="text-sm" style={{ color: "var(--portal-foreground)" }}>{h.description}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--portal-nav-text)" }}>
                          Technician: <span className="font-medium" style={{ color: "var(--portal-secondary)" }}>{h.technician}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {eq.notes && (
        <div className="portal-card p-5">
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>Technician Notes</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--portal-secondary)" }}>{eq.notes}</p>
        </div>
      )}
    </div>
  )
}
