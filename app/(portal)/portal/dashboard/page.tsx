"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Wrench,
  ClipboardList,
  Calendar,
  Receipt,
  FilePen,
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react"
import { usePortalSession } from "@/components/portal/portal-session-context"

type DashboardPayload = {
  certificateSummary?: {
    total: number
    unlocked: number
    locked: number
  }
  stats: {
    equipmentTotal: number
    equipmentDueSoon: number
    openWorkOrders: number
    outstandingCents: number
    pendingQuotes: number
  }
  alerts: {
    overdueInvoice: { id: string; amountCents: number; statusLabel: string } | null
    pendingQuote: { id: string; amountCents: number; title: string } | null
  }
  recentWorkOrders: Array<{
    id: string
    display: string
    title: string
    statusLabel: string
    typeLabel: string
    scheduledOn: string | null
    equipmentName: string
    technicianName: string | null
  }>
  recentInvoices: Array<{
    id: string
    number: string
    title: string
    amountCents: number
    statusLabel: string
    issuedAt: string
  }>
  maintenancePlans: Array<{
    id: string
    name: string
    statusLabel: string
    nextDueDate: string | null
    equipmentName: string
    intervalLabel: string
  }>
  nextScheduledService: {
    planName: string
    equipmentName: string
    nextDueDate: string | null
  } | null
  formatters: { currency: { outstandingLabel: string } }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Open: { bg: "var(--portal-accent-muted)", text: "var(--portal-accent-text)" },
    "In Progress": { bg: "#fff7ed", text: "#c2410c" },
    Scheduled: { bg: "#f0fdf4", text: "#15803d" },
    Completed: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    Invoiced: { bg: "#f5f3ff", text: "#6d28d9" },
    Unpaid: { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    Overdue: { bg: "var(--portal-danger-muted)", text: "var(--portal-danger)" },
    Paid: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    Active: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    "Awaiting Signature": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    "Pending Approval": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
  }
  const s = map[status] ?? { bg: "#f3f4f6", text: "#6b7280" }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent?: boolean
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

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string
  icon: React.ElementType
  label: string
  description: string
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
        <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
          {label}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          {description}
        </p>
      </div>
      <ChevronRight
        size={15}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--portal-accent)" }}
      />
    </Link>
  )
}

export default function PortalDashboardPage() {
  const { bootstrap } = usePortalSession()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/portal/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load dashboard.")
        return r.json() as Promise<DashboardPayload>
      })
      .then(setData)
      .catch(() => setLoadError("Unable to load dashboard data."))
  }, [])

  const greetingName = bootstrap?.displayName?.split(/\s+/)[0] ?? "there"

  if (loadError) {
    return (
      <div className="portal-card p-8 text-center text-sm" style={{ color: "var(--portal-danger)" }}>
        {loadError}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="portal-card p-12 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
        Loading dashboard…
      </div>
    )
  }

  const overdueInvoice = data.alerts.overdueInvoice
  const pendingQuote = data.alerts.pendingQuote
  const activePlan = data.nextScheduledService

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-balance" style={{ color: "var(--portal-foreground)" }}>
            Hello, {greetingName}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            {bootstrap?.customerCompanyName ?? "Customer"} — Customer Portal
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

      {(overdueInvoice || pendingQuote) && (
        <div className="space-y-2">
          {overdueInvoice && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm"
              style={{
                background: "var(--portal-danger-muted)",
                borderColor: "#fecaca",
                color: "var(--portal-danger)",
              }}
            >
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                An invoice for {fmtCurrency(overdueInvoice.amountCents)} is{" "}
                <strong>{overdueInvoice.statusLabel}</strong>.
              </span>
              <Link
                href="/portal/invoices"
                className="ml-auto flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline"
              >
                View <ArrowRight size={12} />
              </Link>
            </div>
          )}
          {pendingQuote && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm"
              style={{
                background: "var(--portal-warning-muted)",
                borderColor: "#fed7aa",
                color: "var(--portal-warning)",
              }}
            >
              <Clock size={15} className="shrink-0" />
              <span>
                Quote <strong>{pendingQuote.title}</strong> for {fmtCurrency(pendingQuote.amountCents)} awaits your
                approval.
              </span>
              <Link
                href="/portal/quotes"
                className="ml-auto flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline"
              >
                Review <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      )}

      {data.certificateSummary && data.certificateSummary.total > 0 && (
        <div className="portal-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Compliance documents
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
              {data.certificateSummary.unlocked} available · {data.certificateSummary.locked} pending release
            </p>
          </div>
          <Link
            href="/portal/certificates"
            className="portal-btn-secondary text-xs inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium"
          >
            View certificates
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Equipment"
          value={data.stats.equipmentTotal}
          sub={`${data.stats.equipmentDueSoon} due soon`}
          icon={Wrench}
        />
        <StatCard
          label="Open Work Orders"
          value={data.stats.openWorkOrders}
          sub="active"
          icon={ClipboardList}
          accent
        />
        <StatCard
          label="Outstanding Balance"
          value={data.formatters.currency.outstandingLabel}
          sub="all invoices"
          icon={Receipt}
        />
        <StatCard
          label="Pending Quotes"
          value={data.stats.pendingQuotes}
          sub="awaiting approval"
          icon={FilePen}
          accent
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 portal-card">
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--portal-border-light)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Recent Work Orders
            </h2>
            <Link
              href="/portal/work-orders"
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: "var(--portal-accent)" }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {data.recentWorkOrders.length === 0 && (
              <p className="px-5 py-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>
                No work orders yet.
              </p>
            )}
            {data.recentWorkOrders.map((wo) => (
              <Link
                key={wo.id}
                href="/portal/work-orders"
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[--portal-surface-2] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium" style={{ color: "var(--portal-nav-text)" }}>
                      {wo.display}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: wo.typeLabel === "Repair" ? "#fef3c7" : "var(--portal-accent-muted)",
                        color: wo.typeLabel === "Repair" ? "#92400e" : "var(--portal-accent-text)",
                      }}
                    >
                      {wo.typeLabel}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 truncate" style={{ color: "var(--portal-foreground)" }}>
                    {wo.equipmentName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                    {wo.technicianName ?? "Technician TBD"} • {fmtDate(wo.scheduledOn)}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <StatusBadge status={wo.statusLabel} />
                  <ChevronRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--portal-accent)" }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {activePlan && activePlan.nextDueDate && (
            <div className="portal-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} style={{ color: "var(--portal-accent)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
                  Next Scheduled Service
                </h3>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                {activePlan.planName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                {activePlan.equipmentName}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className="text-xs px-2 py-1 rounded-md font-medium"
                  style={{ background: "var(--portal-accent-muted)", color: "var(--portal-accent-text)" }}
                >
                  {fmtDate(activePlan.nextDueDate)}
                </span>
                <span
                  className="text-xs"
                  style={{
                    color:
                      (daysUntil(activePlan.nextDueDate) ?? 99) <= 14 ?
                        "var(--portal-warning)"
                      : "var(--portal-nav-text)",
                  }}
                >
                  {daysUntil(activePlan.nextDueDate) ?? "—"} days away
                </span>
              </div>
            </div>
          )}

          <div className="portal-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
                Recent Invoices
              </h3>
              <Link href="/portal/invoices" className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                View all
              </Link>
            </div>
            <div className="space-y-2.5">
              {data.recentInvoices.length === 0 && (
                <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                  No invoices yet.
                </p>
              )}
              {data.recentInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/portal/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-md px-1 py-1 -mx-1 hover:bg-[--portal-surface-2] transition-colors"
                >
                  <div>
                    <p className="text-xs font-mono font-medium" style={{ color: "var(--portal-accent)" }}>
                      {inv.number}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                      {fmtDate(inv.issuedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                      {fmtCurrency(inv.amountCents)}
                    </p>
                    <StatusBadge status={inv.statusLabel} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--portal-foreground)" }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction href="/portal/request-repair" icon={Wrench} label="Request a Repair" description="Submit a service request" />
          <QuickAction href="/portal/book-maintenance" icon={Calendar} label="Book Maintenance" description="Schedule a visit" />
          <QuickAction href="/portal/invoices" icon={Receipt} label="Invoices" description="View balances (payments coming soon)" />
          <QuickAction href="/portal/reports" icon={FileText} label="Reports" description="Service summaries" />
        </div>
      </div>

      {data.maintenancePlans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Maintenance Plans
            </h2>
            <Link
              href="/portal/maintenance"
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: "var(--portal-accent)" }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.maintenancePlans.slice(0, 2).map((plan) => {
              const days = daysUntil(plan.nextDueDate)
              return (
                <div key={plan.id} className="portal-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                        {plan.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                        {plan.equipmentName}
                      </p>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ background: "var(--portal-success-muted)", color: "var(--portal-success)" }}
                    >
                      {plan.intervalLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span style={{ color: "var(--portal-nav-text)" }}>Next due</span>
                    <span
                      className="font-medium"
                      style={{
                        color:
                          days != null && days <= 14 ? "var(--portal-warning)" : "var(--portal-secondary)",
                      }}
                    >
                      {fmtDate(plan.nextDueDate)} {days != null ? `• ${days}d` : ""}
                    </span>
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
