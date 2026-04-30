"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Wrench, ChevronRight, Search, CalendarClock,
  ShieldCheck, MapPin, FileDown, Clock, ArrowUpRight,
} from "lucide-react"
import { equipment, workOrders } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
const myEquipment = equipment.filter((e) => e.customerId === CUSTOMER_ID)

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysUntil(d: string) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    "Active":        { bg: "#f0fdf4", text: "#15803d" },
    "Needs Service": { bg: "#fffbeb", text: "#d97706" },
    "In Repair":     { bg: "#fef2f2", text: "#dc2626" },
    "Out of Service":{ bg: "#f9fafb", text: "#6b7280" },
  }
  const s = map[status] ?? { bg: "#f3f4f6", text: "#6b7280" }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}>
      {status}
    </span>
  )
}

function EquipmentCard({ eq }: { eq: typeof myEquipment[number] }) {
  const days = daysUntil(eq.nextDueDate)
  const warrantyDays = daysUntil(eq.warrantyExpiration)
  const lastWO = workOrders.filter(w => w.equipmentId === eq.id).slice(0, 1)[0]

  return (
    <div className="portal-card overflow-hidden hover:shadow-md transition-shadow">
      {/* Status bar */}
      <div className="h-1" style={{
        background: eq.status === "Active" ? "var(--portal-success)" :
          eq.status === "Needs Service" ? "var(--portal-warning)" : "var(--portal-danger)"
      }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--portal-hover)", color: "var(--portal-nav-text)" }}>{eq.id}</span>
              <StatusPill status={eq.status} />
            </div>
            <h3 className="text-sm font-semibold text-pretty" style={{ color: "var(--portal-foreground)" }}>{eq.model}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{eq.manufacturer} &bull; {eq.category}</p>
          </div>
        </div>

        <div className="space-y-2 text-xs mb-4">
          <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{eq.location}</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
            <CalendarClock size={12} className="shrink-0" />
            <span>Next service: </span>
            <span className="font-medium" style={{ color: days <= 14 ? "var(--portal-warning)" : days < 0 ? "var(--portal-danger)" : "var(--portal-secondary)" }}>
              {fmtDate(eq.nextDueDate)} {days < 0 ? "(overdue)" : `(${days}d)`}
            </span>
          </div>
          <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
            <ShieldCheck size={12} className="shrink-0" />
            <span>Warranty: </span>
            <span className="font-medium" style={{ color: warrantyDays < 0 ? "var(--portal-danger)" : warrantyDays <= 30 ? "var(--portal-warning)" : "var(--portal-secondary)" }}>
              {warrantyDays < 0 ? "Expired" : `Expires ${fmtDate(eq.warrantyExpiration)}`}
            </span>
          </div>
          {lastWO && (
            <div className="flex items-center gap-2" style={{ color: "var(--portal-nav-text)" }}>
              <Clock size={12} className="shrink-0" />
              <span>Last service: {fmtDate(lastWO.scheduledDate)}</span>
            </div>
          )}
        </div>

        {/* History count */}
        <div className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: "var(--portal-border-light)" }}>
          <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
            {eq.serviceHistory.length} service records
          </span>
          <Link
            href={`/portal/equipment/${eq.id}`}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--portal-accent)" }}
          >
            View history <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PortalEquipmentPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")

  const filtered = myEquipment.filter((e) => {
    const matchSearch = [e.model, e.manufacturer, e.category, e.location, e.serialNumber]
      .some((f) => f.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === "All" || e.status === filter
    return matchSearch && matchFilter
  })

  const statuses = ["All", "Active", "Needs Service", "In Repair", "Out of Service"]
  const counts = {
    All: myEquipment.length,
    Active: myEquipment.filter(e => e.status === "Active").length,
    "Needs Service": myEquipment.filter(e => e.status === "Needs Service").length,
    "In Repair": myEquipment.filter(e => e.status === "In Repair").length,
    "Out of Service": myEquipment.filter(e => e.status === "Out of Service").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Equipment</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            {myEquipment.length} units registered to your account
          </p>
        </div>
        <Link href="/portal/request-repair" className="portal-btn-primary">
          <Wrench size={14} /> Request Repair
        </Link>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: "var(--portal-hover)", border: "1px solid var(--portal-border-light)" }}>
          {statuses.map((s) => (
            <button key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                background: filter === s ? "var(--portal-surface)" : "transparent",
                color: filter === s ? "var(--portal-foreground)" : "var(--portal-nav-text)",
                boxShadow: filter === s ? "var(--portal-shadow-sm)" : "none",
              }}>
              {s} {counts[s as keyof typeof counts] > 0 && (
                <span className="ml-1 text-[10px]" style={{ color: filter === s ? "var(--portal-accent)" : "var(--portal-nav-icon)" }}>
                  {counts[s as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--portal-nav-icon)" }} />
          <input
            className="portal-input pl-8 w-56"
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="portal-card py-16 text-center">
          <Wrench size={32} className="mx-auto mb-3" style={{ color: "var(--portal-nav-icon)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>No equipment found</p>
          <p className="text-xs mt-1" style={{ color: "var(--portal-nav-text)" }}>Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((eq) => <EquipmentCard key={eq.id} eq={eq} />)}
        </div>
      )}
    </div>
  )
}
