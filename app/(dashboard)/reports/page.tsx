"use client"

import { useState, useMemo } from "react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"
import {
  Download, FileText, Clock, Mail, Copy, TrendingUp,
  AlertTriangle, Shield, RefreshCcw, DollarSign,
  ChevronDown, Calendar, User, MapPin, Filter, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkspaceData } from "@/lib/tenant-store"
import { useSupabaseDashboard } from "@/lib/dashboard/use-supabase-dashboard"

// ─── Report mock data ─────────────────────────────────────────────────────────

const woByType = [
  { type: "Repair",                count: 98,  fill: "var(--color-chart-1)" },
  { type: "Preventive\nMaint.",    count: 134, fill: "var(--color-chart-2)" },
  { type: "Emergency",             count: 24,  fill: "var(--color-chart-5)" },
  { type: "Install",               count: 41,  fill: "var(--color-chart-3)" },
]

const techProductivity = [
  { name: "Sandra Liu",    jobs: 31, completion: 99, rating: 4.8 },
  { name: "Marcus Webb",  jobs: 28, completion: 96, rating: 4.9 },
  { name: "Priya Mehta",  jobs: 24, completion: 97, rating: 4.9 },
  { name: "Denise Harmon",jobs: 22, completion: 98, rating: 4.8 },
  { name: "James Torres", jobs: 19, completion: 88, rating: 4.6 },
  { name: "Tyler Oakes",  jobs: 17, completion: 91, rating: 4.7 },
]

const equipmentDueByMonth = [
  { month: "May",  count: 14 },
  { month: "Jun",  count: 22 },
  { month: "Jul",  count: 18 },
  { month: "Aug",  count: 31 },
  { month: "Sep",  count: 27 },
  { month: "Oct",  count: 19 },
]

const topCustomersByRevenue = [
  { name: "Summit Construction",  revenue: 46300, contracts: 2, wos: 7 },
  { name: "Apex Fabricators",     revenue: 42100, contracts: 3, wos: 5 },
  { name: "Clearfield Foods",     revenue: 22000, contracts: 1, wos: 4 },
  { name: "Riverstone Logistics", revenue: 18500, contracts: 1, wos: 3 },
  { name: "Metro Warehousing",    revenue: 14800, contracts: 1, wos: 2 },
  { name: "Lakefront Printing",   revenue: 0,     contracts: 0, wos: 0 },
]

const contractRenewalPipeline = [
  { customer: "Clearfield Foods",     value: 22000, renewsIn: "Jun 2026", health: "At Risk",  type: "Full Coverage" },
  { customer: "Apex Fabricators",     value: 42100, renewsIn: "Aug 2026", health: "Healthy",  type: "Full Coverage" },
  { customer: "Metro Warehousing",    value: 14800, renewsIn: "Sep 2026", health: "Healthy",  type: "PM Plan" },
  { customer: "Riverstone Logistics", value: 18500, renewsIn: "Dec 2026", health: "Healthy",  type: "PM Plan" },
  { customer: "Summit Construction",  value: 46300, renewsIn: "Jan 2027", health: "Upgrade",  type: "Labor Only" },
]

const savedReports = [
  { id: "SR-1", name: "Executive Summary",         desc: "Revenue, WOs, KPIs, and top risks for the current period.", icon: FileText,      lastRun: "Apr 30, 2026" },
  { id: "SR-2", name: "Technician Scorecard",      desc: "Jobs completed, ratings, utilization, and certification status.", icon: User,          lastRun: "Apr 28, 2026" },
  { id: "SR-3", name: "PM Due Next 30 Days",       desc: "All equipment with preventive maintenance due within 30 days.", icon: Calendar,      lastRun: "Apr 30, 2026" },
  { id: "SR-4", name: "Overdue Assets",            desc: "Equipment past their scheduled service date with no completed WO.", icon: AlertTriangle, lastRun: "Apr 29, 2026" },
  { id: "SR-5", name: "Customer Equipment History",desc: "Full service log per customer — parts, labor, and costs.", icon: RefreshCcw,    lastRun: "Apr 25, 2026" },
]

const REGIONS = ["All Regions", "Midwest", "Northeast", "Southeast", "Southwest", "West"]
const DATE_RANGES = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 6 months", "Last 12 months", "Custom"]

// ─── KPI data ─────────────────────────────────────────────────────────────────

const kpis = [
  {
    label: "Monthly Revenue",
    value: "$184,250",
    change: "+7.2%",
    positive: true,
    sub: "vs. $171,800 last month",
    icon: DollarSign,
    tile: "ds-icon-tile-info",
  },
  {
    label: "Completed Work Orders",
    value: "214",
    change: "+12%",
    positive: true,
    sub: "vs. 191 last month",
    icon: RefreshCcw,
    tile: "ds-icon-tile-success",
  },
  {
    label: "Avg Response Time",
    value: "4.2 hrs",
    change: "-18 min",
    positive: true,
    sub: "vs. 4.5 hrs last month",
    icon: Clock,
    tile: "ds-icon-tile-warning",
  },
  {
    label: "Renewed PM Contracts",
    value: "3",
    change: "$55,300",
    positive: true,
    sub: "contract value renewed",
    icon: TrendingUp,
    tile: "ds-icon-tile-accent",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n}`
}

function fmtFull$(n: number) {
  return `$${n.toLocaleString()}`
}

function healthBadge(h: string) {
  if (h === "At Risk")  return "ds-badge-danger border"
  if (h === "Upgrade")  return "ds-badge-warning border"
  return "ds-badge-success border"
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="text-primary font-bold">{fmtFull$(payload[0].value)}</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{payload[0]?.payload?.type ?? label}</p>
      <p className="text-foreground">{payload[0].value} <span className="text-muted-foreground">work orders</span></p>
    </div>
  )
}

function HorizTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{payload[0]?.payload?.name}</p>
      <p className="text-foreground">{payload[0].value} <span className="text-muted-foreground">jobs</span></p>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, sub, action, children }: {
  title: string
  sub?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-border shrink-0">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const dash = useSupabaseDashboard()
  const { customers, technicians, revenueData, repeatRepairs: wrRepeat, expiringWarranties: wrWarranty } =
    useWorkspaceData()
  const useLive = Boolean(dash.organizationId) && !dash.loading

  const kpiStrip = useMemo(() => {
    if (!useLive) return kpis
    const s = dash.stats
    return [
      {
        label: "Monthly revenue (closed WOs)",
        value: fmtFull$(Math.round(s.monthlyRevenueCents / 100)),
        change: "Live",
        positive: true,
        sub: "Labor + parts on completed / invoiced work this month",
        icon: DollarSign,
        tile: "ds-icon-tile-info",
      },
      {
        label: "Open work orders",
        value: String(s.openWorkOrders),
        change: "Live",
        positive: true,
        sub: "Open, scheduled, and in progress",
        icon: RefreshCcw,
        tile: "ds-icon-tile-success",
      },
      {
        label: "Overdue service",
        value: String(s.overdueService),
        change: "Live",
        positive: s.overdueService === 0,
        sub: "Active assets past next service date",
        icon: Clock,
        tile: "ds-icon-tile-warning",
      },
      {
        label: "Warranties expiring (30d)",
        value: String(s.expiringWarrantiesCount),
        change: "Live",
        positive: true,
        sub: "Recorded warranty windows",
        icon: TrendingUp,
        tile: "ds-icon-tile-accent",
      },
    ]
  }, [useLive, dash.stats])

  const revenueChartData = useMemo(() => {
    if (useLive && dash.revenueByMonth.length > 0) return dash.revenueByMonth
    return revenueData
  }, [useLive, dash.revenueByMonth, revenueData])

  const woStatusChart = useMemo(() => {
    const palette = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-5)", "var(--color-chart-3)"]
    if (useLive && dash.workOrdersByStatus.length > 0) {
      return dash.workOrdersByStatus.map((x, i) => ({
        type: x.status,
        count: x.count,
        fill: palette[i % palette.length]!,
      }))
    }
    return woByType
  }, [useLive, dash.workOrdersByStatus])

  const repeatDisplay = useMemo(() => {
    if (useLive) {
      return dash.repeatRepairs.map((r) => ({
        equipment: r.equipmentName,
        customer: r.customerName,
        repairs: r.repairs,
        lastRepair: r.lastRepair,
        issue: r.issue,
      }))
    }
    return wrRepeat
  }, [useLive, dash.repeatRepairs, wrRepeat])

  const warrantyDisplay = useMemo(() => {
    if (useLive) {
      return dash.expiringWarranties.map((w) => ({
        equipment: w.equipmentName,
        customer: w.customerName,
        expires: w.expires,
        daysLeft: w.daysLeft,
      }))
    }
    return wrWarranty
  }, [useLive, dash.expiringWarranties, wrWarranty])

  const [dateRange, setDateRange] = useState("Last 6 months")
  const [customer, setCustomer] = useState("All Customers")
  const [technician, setTechnician] = useState("All Technicians")
  const [region, setRegion] = useState("All Regions")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const customerNames = useMemo(
    () => ["All Customers", ...customers.map((c) => c.company)],
    [customers]
  )
  const technicianNames = useMemo(
    () => ["All Technicians", ...technicians.map((t) => t.name)],
    [technicians]
  )

  const hasActiveFilters =
    customer !== "All Customers" ||
    technician !== "All Technicians" ||
    region !== "All Regions"

  function clearFilters() {
    setCustomer("All Customers")
    setTechnician("All Technicians")
    setRegion("All Regions")
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Filter bar ── */}
      <div className="ds-toolbar">
        <div className="flex flex-wrap items-center gap-3 w-full">

          {/* Date range */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* Customer */}
          <div className="relative">
            <select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {customerNames.map((c) => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* Technician */}
          <div className="relative">
            <select
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {technicianNames.map((t) => <option key={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* Region */}
          <div className="relative">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}

          <div className="flex-1" />

          {/* Export buttons */}
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </div>

      {useLive && (
        <p className="text-xs text-muted-foreground -mt-2">
          KPIs, revenue trend, work-order status, repeat alerts, and warranty alerts use live organization data. Sections
          labeled “Sample” are illustrative until full reporting ships.
        </p>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {kpiStrip.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="ds-kpi-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.tile}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="ds-kpi-value">{k.value}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-xs font-semibold ${k.positive ? "ds-change-positive" : "ds-change-negative"}`}>
                    {k.change}
                  </span>
                  <span className="text-xs text-muted-foreground">{k.sub}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Charts row 1: Revenue + WO by Type ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">

        {/* Revenue by month — line chart */}
        <div className="lg:col-span-3 h-full">
          <Section
            title="Revenue by Month"
            sub={useLive ? "Last 12 months — completed / invoiced work (live)" : "Last 6 months — workspace demo bundle"}
            action={
              <span className="text-xs font-semibold ds-badge-success border px-2 py-0.5 rounded-full">
                {useLive ? "Live" : "Demo"}
              </span>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<RevenueTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ fill: "var(--primary)", r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* Work Orders by Type — vertical bar chart */}
        <div className="lg:col-span-2 h-full">
          <Section
            title={useLive ? "Open Work Orders by Status" : "Work Orders by Type"}
            sub={useLive ? "Live — open, scheduled, and in progress" : "Sample — mix of job types (demo)"}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={woStatusChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(v: string) => v.replace("\n", " ")}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {woStatusChart.map((entry) => (
                    <Cell key={entry.type} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      </div>

      {/* ── Charts row 2: Tech Productivity + Equipment Due by Month ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

        {/* Technician Productivity — horizontal bars */}
        <Section title="Technician Productivity" sub="Sample data — productivity scoring not wired to payroll yet">
          <div className="space-y-3">
            {techProductivity.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{t.completion}%</span>
                      <span className="text-[10px] font-bold text-foreground">{t.jobs} jobs</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(t.jobs / techProductivity[0].jobs) * 100}%` }}
                    />
                  </div>
                </div>
                {/* Star rating */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <svg className="w-3 h-3 fill-amber-400" viewBox="0 0 12 12"><path d="M6 0l1.5 4.5H12L8 7.5l1.5 4.5L6 9l-3.5 3L4 7.5 0 4.5h4.5z"/></svg>
                  <span className="text-[10px] font-semibold text-foreground">{t.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Equipment Due by Month — bar chart */}
        <Section title="Equipment Due by Month" sub="Sample trend — use dashboard equipment views for live due dates">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={equipmentDueByMonth} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="text-foreground">{payload[0].value} <span className="text-muted-foreground">units due</span></p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-chart-2)">
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ── Tables row: Top Customers + Contract Renewal Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

        {/* Top Customers by Revenue */}
        <Section title="Top Customers by Revenue" sub="Sample rankings — connect to accounting export in a future release">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-3">#</th>
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Customer</th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Revenue</th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Contracts</th>
                  <th className="text-right text-muted-foreground font-medium pb-2">WOs</th>
                </tr>
              </thead>
              <tbody>
                {topCustomersByRevenue.map((c, i) => (
                  <tr key={c.name} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 text-muted-foreground font-medium">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                          {c.name[0]}
                        </div>
                        <span className="font-medium text-foreground truncate">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold text-foreground">
                      {c.revenue > 0 ? fmtFull$(c.revenue) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">{c.contracts}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{c.wos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Contract Renewal Pipeline */}
        <Section title="Contract Renewal Pipeline" sub="Sample pipeline — renewal CRM integration coming later">
          <div className="space-y-2">
            {contractRenewalPipeline.map((c) => (
              <div key={c.customer} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-secondary/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground truncate">{c.customer}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${healthBadge(c.health)}`}>
                      {c.health}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{c.type} · Renews {c.renewsIn}</p>
                </div>
                <span className="text-xs font-bold text-foreground shrink-0">{fmtFull$(c.value)}<span className="text-muted-foreground font-normal">/yr</span></span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Alert tables: Repeat Failures + Expiring Warranties ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

        {/* Repeat Failure Alerts */}
        <Section
          title="Repeat Failure Alerts"
          sub="Equipment repaired 3+ times for the same issue"
          action={
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ds-badge-danger border">
              {repeatDisplay.length} alerts
            </span>
          }
        >
          <div className="space-y-2">
            {repeatDisplay.map((r) => (
              <div key={r.equipment} className="flex items-start gap-3 p-3 rounded-lg ds-alert-danger border">
                <RefreshCcw className="w-4 h-4 ds-icon-danger mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{r.equipment}</p>
                  <p className="text-[11px] text-muted-foreground">{r.customer}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] font-medium ds-text-danger">{r.repairs}x repairs</span>
                    <span className="text-[11px] text-muted-foreground">Issue: {r.issue}</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">Last: {r.lastRepair}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Warranty Expiring Soon */}
        <Section
          title="Warranty Expiring Soon"
          sub="Equipment with warranty expiring within 90 days"
          action={
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ds-badge-warning border">
              {warrantyDisplay.length} expiring
            </span>
          }
        >
          <div className="space-y-2">
            {warrantyDisplay.map((w) => (
              <div key={w.equipment} className="flex items-start gap-3 p-3 rounded-lg ds-alert-warning border">
                <Shield className="w-4 h-4 ds-icon-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{w.equipment}</p>
                  <p className="text-[11px] text-muted-foreground">{w.customer}</p>
                  <p className="text-[11px] ds-text-warning font-medium mt-0.5">Expires {w.expires}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold ${w.daysLeft <= 15 ? "ds-text-danger" : "ds-text-warning"}`}>
                    {w.daysLeft}d
                  </span>
                  <p className="text-[10px] text-muted-foreground">remaining</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Saved Reports ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Saved Reports</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Run, schedule, or duplicate pre-built report templates.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedReports.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{r.desc}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Last run: {r.lastRun}</p>
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-secondary cursor-not-allowed opacity-60 rounded-md py-1.5"
                  >
                    <Download className="w-3 h-3" /> Run Report
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="inline-flex items-center justify-center gap-1 text-[11px] font-medium rounded-md py-1.5 px-2.5 border border-border bg-secondary text-muted-foreground cursor-not-allowed opacity-60"
                  >
                    <Mail className="w-3 h-3" />
                    Schedule
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="inline-flex items-center justify-center gap-1 text-[11px] font-medium rounded-md py-1.5 px-2.5 border border-border bg-secondary text-muted-foreground cursor-not-allowed opacity-60"
                  >
                    <Copy className="w-3 h-3" />
                    Duplicate
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
