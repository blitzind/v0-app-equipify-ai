"use client"

import Link from "next/link"
import {
  Wrench, ClipboardList, Calendar, Receipt, FilePen,
  FileText, AlertTriangle, Clock, ArrowRight,
  ChevronRight,
} from "lucide-react"
import {
  customers, equipment, workOrders, portalInvoices,
  portalQuotes, maintenancePlans,
} from "@/lib/mock-data"

// Portal is scoped to CUS-001 — Riverstone Logistics
const CUSTOMER_ID = "CUS-001"

const customer     = customers.find((c) => c.id === CUSTOMER_ID)!
const myEquipment  = equipment.filter((e) => e.customerId === CUSTOMER_ID)
const myWorkOrders = workOrders.filter((w) => w.customerId === CUSTOMER_ID)
const myInvoices   = portalInvoices.filter((i) => i.customerId === CUSTOMER_ID)
const myQuotes     = portalQuotes.filter((q) => q.customerId === CUSTOMER_ID)
const myPlans      = maintenancePlans.filter((p) => p.customerId === CUSTOMER_ID)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    "Open":       { bg: "var(--portal-accent-muted)",   text: "var(--portal-accent-text)" },
    "In Progress":{ bg: "#fff7ed",                       text: "#c2410c" },
    "Scheduled":  { bg: "#f0fdf4",                       text: "#15803d" },
    "Completed":  { bg: "var(--portal-success-muted)",   text: "var(--portal-success)" },
    "Invoiced":   { bg: "#f5f3ff",                       text: "#6d28d9" },
    "Unpaid":     { bg: "var(--portal-warning-muted)",   text: "var(--portal-warning)" },
    "Overdue":    { bg: "var(--portal-danger-muted)",    text: "var(--portal-danger)" },
    "Paid":       { bg: "var(--portal-success-muted)",   text: "var(--portal-success)" },
    "Active":     { bg: "var(--portal-success-muted)",   text: "var(--portal-success)" },
    "Needs Service":{ bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    "In Repair":  { bg: "var(--portal-danger-muted)",    text: "var(--portal-danger)" },
    "Pending Approval": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    "Approved":   { bg: "var(--portal-success-muted)",   text: "var(--portal-success)" },
    "Declined":   { bg: "var(--portal-danger-muted)",    text: "var(--portal-danger)" },
  }
  const s = map[status] ?? { bg: "#f3f4f6", text: "#6b7280" }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}>
      {status}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent?: boolean
}) {
  return (
    <div className="portal-card p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
          {label}
        </p>
        <p className="text-2xl font-semibold mt-1 tabular-nums" style={{ color: "var(--portal-foreground)" }}>
          {value}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{sub}</p>}
      </div>
      <span
        className="flex items-center justify-center w-9 h-9 rounded-lg"
        style={{ background: accent ? "var(--portal-accent-muted)" : "var(--portal-surface-2)" }}
      >
        <Icon size={18} style={{ color: accent ? "var(--portal-accent)" : "var(--portal-nav-icon)" }} />
      </span>
    </div>
  )
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickAction({ href, icon: Icon, label, description }: {
  href: string; icon: React.ElementType; label: string; description: string
}) {
  return (
    <Link
      href={href}
      className="portal-card p-4 flex items-center gap-3 transition-shadow hover:shadow-md group"
    >
      <span
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        style={{ background: "var(--portal-accent-muted)" }}
      >
        <Icon size={18} style={{ color: "var(--portal-accent)" }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{label}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{description}</p>
      </div>
      <ChevronRight size={15} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--portal-accent)" }} />
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalHomePage() {
  const openWOs       = myWorkOrders.filter((w) => w.status === "Open" || w.status === "In Progress").length
  const unpaidTotal   = myInvoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + i.amount, 0)
  const pendingQuotes = myQuotes.filter((q) => q.status === "Pending Approval").length
  const equipDue      = myEquipment.filter((e) => daysUntil(e.nextDueDate) <= 30).length

  const overdueInvoice = myInvoices.find((i) => i.status === "Overdue")
  const pendingQuote   = myQuotes.find((q) => q.status === "Pending Approval")
  const activePlan     = myPlans.find((p) => p.status === "Active")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-balance" style={{ color: "var(--portal-foreground)" }}>
            Good morning, {customer.contacts[0].name.split(" ")[0]}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            {customer.company} &mdash; Customer Portal
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Link href="/portal/request-repair" className="portal-btn-primary">
            <Wrench size={14} />
            Request Repair
          </Link>
          <Link href="/portal/book-maintenance" className="portal-btn-secondary">
            <Calendar size={14} />
            Book Service
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {(overdueInvoice || pendingQuote) && (
        <div className="space-y-2">
          {overdueInvoice && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm"
              style={{ background: "var(--portal-danger-muted)", borderColor: "#fecaca", color: "var(--portal-danger)" }}>
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                Invoice <strong>{overdueInvoice.id}</strong> for {fmtCurrency(overdueInvoice.amount)} is overdue since {fmtDate(overdueInvoice.dueDate)}.
              </span>
              <Link href="/portal/invoices" className="ml-auto flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline">
                View <ArrowRight size={12} />
              </Link>
            </div>
          )}
          {pendingQuote && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm"
              style={{ background: "var(--portal-warning-muted)", borderColor: "#fed7aa", color: "var(--portal-warning)" }}>
              <Clock size={15} className="shrink-0" />
              <span>
                Quote <strong>{pendingQuote.id}</strong> for {fmtCurrency(pendingQuote.amount)} is awaiting your approval.
              </span>
              <Link href="/portal/quotes" className="ml-auto flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline">
                Review <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Equipment" value={myEquipment.length} sub={`${equipDue} due for service`} icon={Wrench} />
        <StatCard label="Open Work Orders" value={openWOs} sub="across all sites" icon={ClipboardList} accent />
        <StatCard label="Outstanding Balance" value={fmtCurrency(unpaidTotal)} sub="across all invoices" icon={Receipt} />
        <StatCard label="Pending Quotes" value={pendingQuotes} sub="awaiting approval" icon={FilePen} accent />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Work Orders */}
        <div className="lg:col-span-2 portal-card">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--portal-border-light)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Recent Work Orders</h2>
            <Link href="/portal/work-orders" className="text-xs font-medium flex items-center gap-1"
              style={{ color: "var(--portal-accent)" }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {myWorkOrders.slice(0, 4).map((wo) => (
              <Link key={wo.id} href={`/portal/work-orders/${wo.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[--portal-surface-2] transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium" style={{ color: "var(--portal-nav-text)" }}>{wo.id}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{
                      background: wo.type === "Repair" ? "#fef3c7" : "var(--portal-accent-muted)",
                      color: wo.type === "Repair" ? "#92400e" : "var(--portal-accent-text)",
                    }}>{wo.type}</span>
                  </div>
                  <p className="text-sm mt-0.5 truncate" style={{ color: "var(--portal-foreground)" }}>{wo.equipmentName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                    {wo.technicianName} &bull; {fmtDate(wo.scheduledDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <StatusBadge status={wo.status} />
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--portal-accent)" }} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar cards */}
        <div className="space-y-4">
          {/* Next service */}
          {activePlan && (
            <div className="portal-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} style={{ color: "var(--portal-accent)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Next Scheduled Service</h3>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{activePlan.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{activePlan.equipmentName}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs px-2 py-1 rounded-md font-medium"
                  style={{ background: "var(--portal-accent-muted)", color: "var(--portal-accent-text)" }}>
                  {fmtDate(activePlan.nextDueDate)}
                </span>
                <span className="text-xs" style={{ color: daysUntil(activePlan.nextDueDate) <= 14 ? "var(--portal-warning)" : "var(--portal-nav-text)" }}>
                  {daysUntil(activePlan.nextDueDate)} days away
                </span>
              </div>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--portal-border-light)" }}>
                <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                  Technician: <span style={{ color: "var(--portal-secondary)" }} className="font-medium">{activePlan.technicianName}</span>
                </p>
              </div>
            </div>
          )}

          {/* Equipment health */}
          <div className="portal-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Equipment Status</h3>
              <Link href="/portal/equipment" className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                View all
              </Link>
            </div>
            <div className="space-y-2.5">
              {myEquipment.slice(0, 4).map((eq) => (
                <div key={eq.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--portal-foreground)" }}>{eq.model}</p>
                    <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>{eq.location}</p>
                  </div>
                  <StatusBadge status={eq.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Invoices */}
          <div className="portal-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Recent Invoices</h3>
              <Link href="/portal/invoices" className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                View all
              </Link>
            </div>
            <div className="space-y-2.5">
              {myInvoices.slice(0, 3).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono font-medium" style={{ color: "var(--portal-foreground)" }}>{inv.id}</p>
                    <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>{fmtDate(inv.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(inv.amount)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--portal-foreground)" }}>Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction href="/portal/request-repair" icon={Wrench} label="Request a Repair" description="Submit a new repair ticket" />
          <QuickAction href="/portal/book-maintenance" icon={Calendar} label="Book Maintenance" description="Schedule a service visit" />
          <QuickAction href="/portal/invoices" icon={Receipt} label="Pay Invoice" description="View and pay outstanding bills" />
          <QuickAction href="/portal/reports" icon={FileText} label="Download Reports" description="Service summaries and health reports" />
        </div>
      </div>

      {/* Maintenance Plans */}
      {myPlans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Active Maintenance Plans</h2>
            <Link href="/portal/maintenance" className="text-xs font-medium flex items-center gap-1"
              style={{ color: "var(--portal-accent)" }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myPlans.filter(p => p.status === "Active").slice(0, 2).map((plan) => {
              const days = daysUntil(plan.nextDueDate)
              return (
                <div key={plan.id} className="portal-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{plan.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{plan.equipmentName}</p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: "var(--portal-success-muted)", color: "var(--portal-success)" }}>
                      {plan.interval}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span style={{ color: "var(--portal-nav-text)" }}>Next due</span>
                    <span className="font-medium" style={{ color: days <= 14 ? "var(--portal-warning)" : "var(--portal-secondary)" }}>
                      {fmtDate(plan.nextDueDate)} &bull; {days}d
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--portal-hover)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        background: days <= 7 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-accent)",
                        width: `${Math.max(4, Math.min(100, 100 - (days / 180) * 100))}%`,
                      }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
