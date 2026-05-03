"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Search, ClipboardList, Filter } from "lucide-react"
import { workOrders } from "@/lib/mock-data"
import { getWorkOrderDisplay, workOrderMatchesSearch } from "@/lib/work-orders/display"

const CUSTOMER_ID = "CUS-001"
const myWOs = workOrders.filter((w) => w.customerId === CUSTOMER_ID)

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  "Open":        { bg: "#eff6ff", text: "#1d4ed8" },
  "Scheduled":   { bg: "#f0fdf4", text: "#15803d" },
  "In Progress": { bg: "#fff7ed", text: "#c2410c" },
  "Completed":   { bg: "#f0fdf4", text: "#15803d" },
  "Invoiced":    { bg: "#f5f3ff", text: "#6d28d9" },
}
const PRIORITY_STYLES: Record<string, { color: string }> = {
  "Critical": { color: "#dc2626" },
  "High":     { color: "#d97706" },
  "Normal":   { color: "#6b7280" },
  "Low":      { color: "#9ca3af" },
}

export default function PortalWorkOrdersPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All")

  const filtered = myWOs.filter((w) => {
    const matchSearch = [w.id, w.equipmentName, w.description, w.technicianName]
      .some(f => f.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = status === "All" || w.status === status
    return matchSearch && matchStatus
  })

  const statuses = ["All", "Open", "Scheduled", "In Progress", "Completed", "Invoiced"]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Work Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            All service and repair tickets for your account
          </p>
        </div>
        <Link href="/portal/request-repair" className="portal-btn-primary">
          <ClipboardList size={14} /> New Request
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: "var(--portal-hover)", border: "1px solid var(--portal-border-light)" }}>
          {statuses.map((s) => (
            <button key={s}
              onClick={() => setStatus(s)}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                background: status === s ? "var(--portal-surface)" : "transparent",
                color: status === s ? "var(--portal-foreground)" : "var(--portal-nav-text)",
                boxShadow: status === s ? "var(--portal-shadow-sm)" : "none",
              }}>
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--portal-nav-icon)" }} />
          <input className="portal-input pl-8 w-56" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="portal-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--portal-border-light)", background: "var(--portal-surface-2)" }}>
                {["WO #", "Equipment", "Type", "Technician", "Scheduled", "Status", "Priority", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium"
                    style={{ color: "var(--portal-nav-text)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
                    No work orders found
                  </td>
                </tr>
              ) : filtered.map((wo, i) => {
                const ss = STATUS_STYLES[wo.status] ?? { bg: "#f3f4f6", text: "#6b7280" }
                const ps = PRIORITY_STYLES[wo.priority] ?? { color: "#6b7280" }
                return (
                  <tr key={wo.id}
                    className="transition-colors hover:bg-[var(--portal-surface-2)] cursor-pointer"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--portal-border-light)" : "none" }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium" style={{ color: "var(--portal-accent)" }}>{getWorkOrderDisplay(wo)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs" style={{ color: "var(--portal-foreground)" }}>{wo.equipmentName}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{wo.location}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "var(--portal-hover)", color: "var(--portal-nav-text)" }}>{wo.type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-secondary)" }}>{wo.technicianName}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--portal-nav-text)" }}>{fmtDate(wo.scheduledDate)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: ss.bg, color: ss.text }}>{wo.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: ps.color }}>
                        {wo.priority === "Critical" ? "● " : wo.priority === "High" ? "● " : "○ "}{wo.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/portal/work-orders/${wo.id}`}
                        className="flex items-center justify-end gap-1 text-xs font-medium"
                        style={{ color: "var(--portal-accent)" }}>
                        Details <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
