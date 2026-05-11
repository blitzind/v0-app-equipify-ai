"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend,
} from "recharts"
import {
  Download, Clock, TrendingUp,
  AlertTriangle, Shield, RefreshCcw, DollarSign,
  ChevronDown, Filter, X, Printer, BookmarkPlus, Trash2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkspaceData } from "@/lib/tenant-store"
import { useSupabaseDashboard } from "@/lib/dashboard/use-supabase-dashboard"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { reportRangeFromPreset } from "@/lib/reporting/date-range"
import type { ReportAnalyticsResponse } from "@/lib/reporting/types"
import { downloadCsv, rowsToCsv } from "@/lib/reporting/export-csv"
import { equipifyExportFilename } from "@/lib/reporting/export-filename"
import {
  loadEquipmentCategoryBreakdown,
  type EquipmentCategoryBreakdownRow,
} from "@/lib/equipment/intelligence-rollup"
import { EquipmentCategoryBreakdownCard } from "@/components/equipment/equipment-category-breakdown-card"
import { FinancialInvoiceReportSection } from "@/components/reporting/financial-invoice-report-section"
import { ReportExportCenter } from "@/components/reporting/report-export-center"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const woByTypeFallback = [
  { type: "Repair", count: 98, fill: "var(--color-chart-1)" },
  { type: "Preventive Maint.", count: 134, fill: "var(--color-chart-2)" },
  { type: "Emergency", count: 24, fill: "var(--color-chart-5)" },
  { type: "Install", count: 41, fill: "var(--color-chart-3)" },
]

const DATE_RANGES = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 6 months", "Last 12 months", "Custom"] as const
const WO_STATUS_OPTIONS = [
  { value: "all", label: "All WO statuses" },
  { value: "open", label: "Open" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "invoiced", label: "Invoiced" },
] as const

type SavedPreset = {
  id: string
  name: string
  dateRange: string
  customFrom?: string
  customTo?: string
  customerId: string
  technicianId: string
  equipmentCategory: string
  workOrderStatus: string
  savedAt: string
}

function presetsStorageKey(orgId: string) {
  return `equipify_report_presets_v1_${orgId}`
}

function loadPresets(orgId: string): SavedPreset[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(presetsStorageKey(orgId))
    if (!raw) return []
    const p = JSON.parse(raw) as SavedPreset[]
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function savePresets(orgId: string, presets: SavedPreset[]) {
  localStorage.setItem(presetsStorageKey(orgId), JSON.stringify(presets))
}

function fmtFull$(n: number) {
  return `$${n.toLocaleString()}`
}

function fmtUsdFromCents(cents: number) {
  return fmtFull$(Math.round(cents / 100))
}

function equipmentTypeLabel(row: { category?: string | null; subcategory?: string | null }) {
  return row.category?.trim() || row.subcategory?.trim() || "Uncategorized"
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="text-primary font-bold">{fmtFull$(payload[0].value ?? 0)}</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; payload?: { type?: string } }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{payload[0]?.payload?.type ?? label}</p>
      <p className="text-foreground">
        {payload[0].value} <span className="text-muted-foreground">work orders</span>
      </p>
    </div>
  )
}

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

function reportToCsvRows(a: ReportAnalyticsResponse): string[][] {
  const { summary: s } = a
  const rows: string[][] = [
    ["Equipify operational report", `${a.from} through ${a.to}`],
    [],
    ["Metric", "Value"],
    ["Period revenue (USD)", String(Math.round(s.periodRevenueCents / 100))],
    ["Work orders created", String(s.workOrdersCreated)],
    ["Work orders completed (window)", String(s.workOrdersCompleted)],
    ["Open pipeline (current)", String(s.workOrdersInProgress)],
    ["Avg completion days", s.avgCompletionDays != null ? s.avgCompletionDays.toFixed(1) : "—"],
    ["Overdue invoices", String(s.overdueInvoicesCount)],
    ["Overdue invoice amount (USD)", String(Math.round(s.overdueInvoicesAmountCents / 100))],
    ["Active PM plans", String(s.activeMaintenancePlans)],
    ["PM plans past due date", String(s.maintenancePlansOverdue)],
    ["PM visits completed (window)", String(s.pmWorkOrdersCompletedInPeriod)],
    [
      "PM schedule health %",
      s.maintenanceScheduleHealthPct != null ? String(s.maintenanceScheduleHealthPct) : "—",
    ],
    ["Warranties expiring in window", String(s.warrantyExpiringInPeriod)],
    ["Repeat repair assets (90d lookback)", String(s.repeatRepairEquipmentCount)],
    [],
    ["Technician", "Completed WOs", "Labor + parts (USD)"],
    ...a.technicians.map((t) => [
      t.name,
      String(t.completedCount),
      String(Math.round(t.laborPartsCents / 100)),
    ]),
    [],
    ["Customer", "Revenue (USD)", "WO count"],
    ...a.topCustomers.map((c) => [
      c.name,
      String(Math.round(c.revenueCents / 100)),
      String(c.workOrderCount),
    ]),
    [],
    ["Overdue invoice #", "Customer", "Amount (USD)", "Days overdue"],
    ...a.overdueInvoices.map((r) => [
      r.invoiceNumber,
      r.customerName,
      String(Math.round(r.amountCents / 100)),
      String(r.daysOverdue),
    ]),
    [],
    [
      "equipment_type",
      "equipment_count",
      "work_order_count",
      "completed_work_order_count",
      "open_work_order_count",
      "calibration_count",
      "invoice_count",
      "linked_revenue_total",
      "average_revenue_per_work_order",
      "last_service_date",
      "next_due_count",
      "top_customers",
    ],
    ...a.equipmentTypePerformance.map((r) => [
      r.equipmentType,
      String(r.equipmentCount),
      String(r.workOrderCount),
      String(r.completedWorkOrderCount),
      String(r.openWorkOrderCount),
      String(r.calibrationCount),
      String(r.invoiceCount),
      String(Math.round(r.linkedRevenueCents / 100)),
      r.averageRevenuePerWorkOrderCents != null ? String(Math.round(r.averageRevenuePerWorkOrderCents / 100)) : "—",
      r.lastServiceDate ?? "—",
      String(r.nextDueCount),
      r.topCustomers.map((c) => `${c.customerName} (${c.workOrderCount} WO)`).join("; "),
    ]),
  ]
  return rows
}

export default function ReportsPage() {
  const dash = useSupabaseDashboard()
  const activeOrg = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { revenueData, repeatRepairs: wrRepeat, expiringWarranties: wrWarranty } = useWorkspaceData()

  const orgId = activeOrg.status === "ready" ? activeOrg.organizationId : null
  const useLive = Boolean(orgId) && !dash.loading

  const [dateRange, setDateRange] = useState<string>("Last 6 months")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [customerId, setCustomerId] = useState<string>("all")
  const [technicianId, setTechnicianId] = useState<string>("all")
  const [equipmentCategory, setEquipmentCategory] = useState<string>("all")
  const [workOrderStatus, setWorkOrderStatus] = useState<string>("all")

  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; company_name: string }>>([])
  const [technicianOptions, setTechnicianOptions] = useState<Array<{ id: string; label: string }>>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])

  const [analytics, setAnalytics] = useState<ReportAnalyticsResponse | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  const [equipmentIntelRows, setEquipmentIntelRows] = useState<EquipmentCategoryBreakdownRow[] | null>(null)
  const [equipmentIntelLoading, setEquipmentIntelLoading] = useState(false)

  const [presets, setPresets] = useState<SavedPreset[]>([])
  const [presetName, setPresetName] = useState("")
  const [exportBusy, setExportBusy] = useState(false)
  const { toast } = useToast()

  const { from, to } = useMemo(
    () => reportRangeFromPreset(dateRange, customFrom || null, customTo || null),
    [dateRange, customFrom, customTo],
  )

  useEffect(() => {
    if (!orgId) {
      setPresets([])
      return
    }
    setPresets(loadPresets(orgId))
  }, [orgId])

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !orgId || cancelled) {
        if (!cancelled) {
          setCustomerOptions([])
          setTechnicianOptions([])
          setCategoryOptions([])
        }
        return
      }

      const [{ data: custRows }, { data: memberRows }, { data: eqCatRows }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .eq("status", "active")
          .is("archived_at", null)
          .order("company_name"),
        supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("status", "active")
          .in("role", ["owner", "admin", "manager", "tech"]),
        supabase.from("equipment").select("category, subcategory").eq("organization_id", orgId).is("archived_at", null),
      ])

      if (cancelled) return

      setCustomerOptions((custRows as Array<{ id: string; company_name: string }>) ?? [])

      const userIds = [...new Set((memberRows ?? []).map((m: { user_id: string }) => m.user_id))]
      let techOpts: Array<{ id: string; label: string }> = []
      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds)
        techOpts =
          (profRows as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.map((p) => ({
            id: p.id,
            label: (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Team member",
          })) ?? []
      }
      setTechnicianOptions(techOpts.sort((a, b) => a.label.localeCompare(b.label)))

      const cats = new Set<string>()
      for (const r of (eqCatRows ?? []) as Array<{ category: string | null; subcategory: string | null }>) {
        cats.add(equipmentTypeLabel(r))
      }
      setCategoryOptions([...cats].sort((a, b) => a.localeCompare(b)))
    })()

    return () => {
      cancelled = true
    }
  }, [orgId])

  const fetchAnalytics = useCallback(async () => {
    if (!orgId) {
      setAnalytics(null)
      return
    }
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const qs = new URLSearchParams({
        from,
        to,
        customerId,
        technicianId,
        equipmentCategory,
        workOrderStatus,
      })
      const res = await fetch(`/api/organizations/${orgId}/reports/analytics?${qs}`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as ReportAnalyticsResponse
      setAnalytics(data)
    } catch (e) {
      setAnalytics(null)
      setAnalyticsError(e instanceof Error ? e.message : "Failed to load analytics.")
    } finally {
      setAnalyticsLoading(false)
    }
  }, [orgId, from, to, customerId, technicianId, equipmentCategory, workOrderStatus])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  // Equipment Intelligence — Phase 2: org-wide (or customer-scoped) category
  // breakdown including revenue + upcoming due counts. Runs in parallel with
  // analytics; failures degrade silently to an empty list.
  useEffect(() => {
    if (!orgId) {
      setEquipmentIntelRows(null)
      return
    }
    let cancelled = false
    setEquipmentIntelLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const customerIds =
        customerId !== "all" ? [customerId] : undefined
      const rows = await loadEquipmentCategoryBreakdown(supabase, {
        organizationId: orgId,
        customerIds,
        since: from,
      }).catch(() => [] as EquipmentCategoryBreakdownRow[])
      if (cancelled) return
      const filtered =
        equipmentCategory !== "all"
          ? rows.filter((r) => r.category === equipmentCategory)
          : rows
      setEquipmentIntelRows(filtered)
      setEquipmentIntelLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, from, customerId, equipmentCategory])

  const hasActiveFilters =
    customerId !== "all" ||
    technicianId !== "all" ||
    equipmentCategory !== "all" ||
    workOrderStatus !== "all"

  function clearFilters() {
    setCustomerId("all")
    setTechnicianId("all")
    setEquipmentCategory("all")
    setWorkOrderStatus("all")
  }

  function saveCurrentPreset() {
    if (!orgId || !presetName.trim()) return
    const next: SavedPreset = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
      name: presetName.trim(),
      dateRange,
      customFrom: dateRange === "Custom" ? customFrom : undefined,
      customTo: dateRange === "Custom" ? customTo : undefined,
      customerId,
      technicianId,
      equipmentCategory,
      workOrderStatus,
      savedAt: new Date().toISOString(),
    }
    const merged = [...presets, next]
    setPresets(merged)
    savePresets(orgId, merged)
    setPresetName("")
  }

  function applyPreset(p: SavedPreset) {
    setDateRange(p.dateRange)
    if (p.customFrom) setCustomFrom(p.customFrom)
    if (p.customTo) setCustomTo(p.customTo)
    setCustomerId(p.customerId)
    setTechnicianId(p.technicianId)
    setEquipmentCategory(p.equipmentCategory)
    setWorkOrderStatus(p.workOrderStatus ?? "all")
  }

  function deletePreset(id: string) {
    if (!orgId) return
    const merged = presets.filter((x) => x.id !== id)
    setPresets(merged)
    savePresets(orgId, merged)
  }

  const exportCsv = () => {
    if (!analytics || exportBusy) return
    setExportBusy(true)
    queueMicrotask(() => {
      try {
        const csv = rowsToCsv(reportToCsvRows(analytics))
        const name = equipifyExportFilename({
          slug: "operational-report",
          range: { from: analytics.from, to: analytics.to },
        })
        downloadCsv(name, csv, { utf8Bom: true })
        toast({ title: "CSV ready", description: "Your download should start shortly." })
      } catch (e) {
        toast({
          title: "Could not build CSV",
          description: e instanceof Error ? e.message : "Try again with a narrower date range.",
          variant: "destructive",
        })
      } finally {
        setExportBusy(false)
      }
    })
  }

  const printPdf = () => {
    const prev = document.title
    document.title = `Equipify Report ${from} — ${to}`
    window.print()
    document.title = prev
  }

  const kpiStrip = useMemo(() => {
    if (analytics) {
      const s = analytics.summary
      return [
        {
          label: "Period revenue",
          value: fmtUsdFromCents(s.periodRevenueCents),
          change: `${from} → ${to}`,
          positive: true,
          sub: "Labor + parts on completed / invoiced work",
          icon: DollarSign,
          tile: "ds-icon-tile-info",
        },
        {
          label: "Work orders completed",
          value: String(s.workOrdersCompleted),
          change: "In range",
          positive: true,
          sub:
            s.avgCompletionDays != null
              ? `Avg cycle ${s.avgCompletionDays.toFixed(1)} days`
              : "Completion dates from ledger",
          icon: RefreshCcw,
          tile: "ds-icon-tile-success",
        },
        {
          label: "Open pipeline",
          value: String(s.workOrdersInProgress),
          change: "Now",
          positive: s.workOrdersInProgress < 50,
          sub: "Open, scheduled, and in progress",
          icon: Clock,
          tile: "ds-icon-tile-warning",
        },
        {
          label: "Overdue invoices",
          value: String(s.overdueInvoicesCount),
          change: fmtUsdFromCents(s.overdueInvoicesAmountCents),
          positive: s.overdueInvoicesCount === 0,
          sub: "Past due — unpaid / sent",
          icon: AlertTriangle,
          tile: "ds-icon-tile-accent",
        },
      ]
    }
    if (!useLive) {
      return [
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
    }
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
  }, [analytics, useLive, dash.stats, from, to])

  const revenueChartData = useMemo(() => {
    if (analytics?.revenueByMonth?.length) {
      return analytics.revenueByMonth.map((m) => ({
        month: m.monthLabel,
        revenue: Math.round(m.revenueCents / 100),
      }))
    }
    if (useLive && dash.revenueByMonth.length > 0) return dash.revenueByMonth
    return revenueData
  }, [analytics, useLive, dash.revenueByMonth, revenueData])

  const woStatusChart = useMemo(() => {
    const palette = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-5)", "var(--color-chart-3)", "var(--color-chart-4)"]
    if (analytics?.workOrdersByType?.length) {
      return analytics.workOrdersByType.map((x, i) => ({
        type: x.type,
        count: x.count,
        fill: palette[i % palette.length]!,
      }))
    }
    if (useLive && dash.workOrdersByStatus.length > 0) {
      return dash.workOrdersByStatus.map((x, i) => ({
        type: x.status,
        count: x.count,
        fill: palette[i % palette.length]!,
      }))
    }
    return woByTypeFallback
  }, [analytics, useLive, dash.workOrdersByStatus])

  const woTrendChart = useMemo(() => {
    if (!analytics?.workOrdersByWeek?.length) return []
    return analytics.workOrdersByWeek.map((w) => ({
      label: w.weekLabel,
      count: w.count,
    }))
  }, [analytics])

  const techChart = useMemo(() => {
    if (!analytics?.technicians?.length) return []
    const max = Math.max(...analytics.technicians.map((t) => t.completedCount), 1)
    return analytics.technicians.slice(0, 8).map((t) => ({
      name: t.name,
      jobs: t.completedCount,
      revenue: Math.round(t.laborPartsCents / 100),
      completion: Math.min(100, Math.round((t.completedCount / max) * 100)),
    }))
  }, [analytics])

  const pmDueChart = useMemo(() => {
    if (!analytics?.equipmentPmDueByMonth?.length) return []
    return analytics.equipmentPmDueByMonth
  }, [analytics])

  const equipmentTypeRows = useMemo(() => analytics?.equipmentTypePerformance ?? [], [analytics])
  const equipmentTypeLeaders = useMemo(() => {
    const byRevenue = equipmentTypeRows[0]
    const byWork = [...equipmentTypeRows].sort((a, b) => b.workOrderCount - a.workOrderCount)[0]
    const byCalibration = [...equipmentTypeRows].sort((a, b) => b.calibrationCount - a.calibrationCount)[0]
    return { byRevenue, byWork, byCalibration }
  }, [equipmentTypeRows])

  const repeatDisplay = useMemo(() => {
    if (analytics?.repeatRepairs?.length) {
      return analytics.repeatRepairs.map((r) => ({
        equipment: r.equipmentName,
        customer: r.customerName,
        repairs: r.repairs,
        lastRepair: r.lastRepair,
        issue: r.issue,
      }))
    }
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
  }, [analytics, useLive, dash.repeatRepairs, wrRepeat])

  const warrantyDisplay = useMemo(() => {
    if (analytics?.warrantiesExpiring?.length) {
      return analytics.warrantiesExpiring.map((w) => ({
        equipment: w.equipmentName,
        customer: w.customerName,
        expires: w.expires,
        daysLeft: w.daysLeft,
      }))
    }
    if (useLive) {
      return dash.expiringWarranties.map((w) => ({
        equipment: w.equipmentName,
        customer: w.customerName,
        expires: w.expires,
        daysLeft: w.daysLeft,
      }))
    }
    return wrWarranty
  }, [analytics, useLive, dash.expiringWarranties, wrWarranty])

  const pieMix = useMemo(() => {
    if (!analytics?.maintenanceMix?.length) return []
    const colors = ["var(--color-chart-2)", "var(--color-chart-1)", "var(--color-chart-4)"]
    return analytics.maintenanceMix.map((m, i) => ({
      name: m.label,
      value: m.count,
      fill: colors[i % colors.length]!,
    }))
  }, [analytics])

  const MIX_ICON_COLORS = ["var(--color-chart-2)", "var(--color-chart-1)", "var(--color-chart-4)"]

  return (
    <div className="flex flex-col gap-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body * { visibility: hidden; }
  #equipify-report-print, #equipify-report-print * { visibility: visible; }
  #equipify-report-print { position: absolute; left: 0; top: 0; width: 100%; }
}`,
        }}
      />

      <div id="equipify-report-print" className="flex flex-col gap-6">
        {/* ── Filter bar ── */}
        <div className="ds-toolbar print:hidden">
          <div className="flex flex-wrap items-center gap-3 w-full">
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {DATE_RANGES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            {dateRange === "Custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary"
                />
              </>
            )}

            <div className="relative">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer max-w-[200px]"
              >
                <option value="all">All customers</option>
                {customerOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer max-w-[200px]"
              >
                <option value="all">All technicians</option>
                {technicianOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={equipmentCategory}
                onChange={(e) => setEquipmentCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer max-w-[200px]"
              >
                <option value="all">All equipment types</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={workOrderStatus}
                onChange={(e) => setWorkOrderStatus(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer max-w-[180px]"
              >
                {WO_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              disabled={!analytics || exportBusy}
              onClick={exportCsv}
              title={analytics ? "Download CSV (UTF-8, Excel-friendly)" : "Load data first"}
            >
              {exportBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="w-3.5 h-3.5" aria-hidden />
              )}{" "}
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printPdf} title="Print or save as PDF">
              <Printer className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
        </div>

        {(analyticsLoading || analyticsError) && (
          <div
            className={cn(
              "-mt-2 print:hidden flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-xs",
              analyticsError
                ? "border-destructive/25 bg-destructive/5 text-destructive"
                : "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            {analyticsLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                Loading filtered analytics…
              </span>
            ) : (
              <>
                <span className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="font-medium break-words">{analyticsError}</span>
                </span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => void fetchAnalytics()}>
                  Retry
                </Button>
              </>
            )}
          </div>
        )}

        <ReportExportCenter
          canAccessOperationalAnalytics={
            permissions.canViewOperationalReports || permissions.canViewFinancialReports
          }
          showFinancialExportSection={Boolean(
            permissions.canViewBilling || permissions.canViewFinancials,
          )}
        />

        {(permissions.canViewBilling || permissions.canViewFinancials) && (
          <FinancialInvoiceReportSection
            organizationId={orgId}
            variant="synced"
            syncedFrom={from}
            syncedTo={to}
            syncedCustomerId={customerId}
          />
        )}

        {useLive && (
          <p className="text-xs text-muted-foreground -mt-2 print:hidden">
            Filters apply to operational metrics below. KPIs reflect the selected window when analytics load.
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

        {/* ── Charts row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
          <div className="lg:col-span-3 h-full">
            <Section
              title="Revenue by Month"
              sub={
                analytics
                  ? `Completed / invoiced activity — ${from} to ${to}`
                  : useLive
                    ? "Last 12 months — completed / invoiced work (live)"
                    : "Workspace demo bundle"
              }
              action={
                <span className="text-xs font-semibold ds-badge-success border px-2 py-0.5 rounded-full">
                  {analytics ? "Filtered" : useLive ? "Live" : "Demo"}
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

          <div className="lg:col-span-2 h-full">
            <Section
              title={analytics ? "Work Orders by Type" : useLive ? "Open Work Orders by Status" : "Work Orders by Type"}
              sub={analytics ? "Created in selected period" : useLive ? "Live — full pipeline" : "Demo"}
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
                    tickFormatter={(v: string) => String(v).replace("\n", " ")}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {woStatusChart.map((entry) => (
                      <Cell key={String(entry.type)} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>
        </div>

        {/* ── Charts row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <Section
            title="Work Order Volume by Week"
            sub={analytics ? "Created date within range" : "Apply filters and select an organization"}
          >
            {woTrendChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={woTrendChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) =>
                      active && payload?.length ? (
                        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                          <p className="font-semibold text-foreground">{label}</p>
                          <p className="text-foreground">
                            {payload[0].value} <span className="text-muted-foreground">created</span>
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-chart-3)">
                    <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No work orders created in this window for the current filters.</p>
            )}
          </Section>

          <Section
            title="Maintenance Mix"
            sub="Share of created work orders by type (Preventive vs Repair vs Other)"
            action={
              analytics?.summary.maintenanceScheduleHealthPct != null ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border">
                  Schedule health {analytics.summary.maintenanceScheduleHealthPct}%
                </span>
              ) : null
            }
          >
            {pieMix.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label>
                    {pieMix.map((_, i) => (
                      <Cell key={`mix-${i}`} fill={MIX_ICON_COLORS[i % MIX_ICON_COLORS.length]!} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">Select an organization and date range to load mix data.</p>
            )}
          </Section>
        </div>

        {/* ── Technician + PM due ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <Section title="Technician Performance" sub="Completed / invoiced work attributed to assignee (period revenue)">
            <div className="space-y-3">
              {techChart.length > 0 ? (
                techChart.map((t) => (
                  <div key={t.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">{fmtFull$(t.revenue)}</span>
                          <span className="text-[10px] font-bold text-foreground">{t.jobs} jobs</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${t.completion}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-6 text-center">No attributed completions in this window.</p>
              )}
            </div>
          </Section>

          <Section title="Equipment PM Due by Month" sub="Active assets with next service date in the selected window">
            {pmDueChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pmDueChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) =>
                      active && payload?.length ? (
                        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                          <p className="font-semibold text-foreground">{label}</p>
                          <p className="text-foreground">
                            {payload[0].value} <span className="text-muted-foreground">assets due</span>
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-chart-2)">
                    <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No scheduled due dates in this window.</p>
            )}
          </Section>
        </div>

        {/* ── Tables row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <Section title="Top Customers by Revenue" sub="Completed / invoiced labor + parts in range">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border ds-table-header-row-subtle">
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-3">#</th>
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Customer</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Revenue</th>
                    <th className="text-right text-muted-foreground font-medium pb-2">WOs</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.topCustomers?.length ? analytics.topCustomers : []).map((c, i) => (
                    <tr key={c.customerId} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 text-muted-foreground font-medium">{i + 1}</td>
                      <td className="py-2.5 pr-3 font-medium text-foreground truncate">{c.name}</td>
                      <td className="py-2.5 pr-3 text-right font-bold text-foreground">{fmtUsdFromCents(c.revenueCents)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{c.workOrderCount}</td>
                    </tr>
                  ))}
                  {!analytics?.topCustomers?.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No revenue in this window for the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Equipment Touch Density by Category" sub="Higher touches per asset may warrant reliability review">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border ds-table-header-row-subtle">
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Category</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">WOs</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Assets</th>
                    <th className="text-right text-muted-foreground font-medium pb-2">Touches / asset</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.equipmentByCategory ?? []).map((row) => (
                    <tr key={row.category} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-foreground">{row.category}</td>
                      <td className="py-2.5 pr-3 text-right">{row.workOrderCount}</td>
                      <td className="py-2.5 pr-3 text-right">{row.distinctEquipment}</td>
                      <td className="py-2.5 text-right">
                        {row.touchesPerAsset != null ? row.touchesPerAsset.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                  {!analytics?.equipmentByCategory?.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        Load analytics with equipment-linked work in range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── Equipment Type Reporting ── */}
        <Section
          title="Equipment Type Performance"
          sub="Revenue is counted only when invoices are linked directly to equipment or through linked work orders. Multi-type invoices are allocated evenly across linked types."
          action={
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border">
              {equipmentTypeRows.length} types
            </span>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Revenue leader",
                  value: equipmentTypeLeaders.byRevenue?.equipmentType ?? "—",
                  sub: equipmentTypeLeaders.byRevenue ? fmtUsdFromCents(equipmentTypeLeaders.byRevenue.linkedRevenueCents) : "No linked revenue",
                },
                {
                  label: "Most service demand",
                  value: equipmentTypeLeaders.byWork?.equipmentType ?? "—",
                  sub: equipmentTypeLeaders.byWork ? `${equipmentTypeLeaders.byWork.workOrderCount} work orders` : "No linked work",
                },
                {
                  label: "Calibration volume",
                  value: equipmentTypeLeaders.byCalibration?.equipmentType ?? "—",
                  sub: equipmentTypeLeaders.byCalibration ? `${equipmentTypeLeaders.byCalibration.calibrationCount} certificates` : "No certificates",
                },
              ].map((card) => (
                <div key={card.label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{card.label}</p>
                  <p className="mt-1 text-sm font-bold text-foreground truncate">{card.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[980px]">
                <thead>
                  <tr className="border-b border-border ds-table-header-row-subtle">
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Equipment type</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Assets</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">WOs</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Completed</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Open</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Cal / certs</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Invoices</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Linked revenue</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Avg / WO</th>
                    <th className="text-left text-muted-foreground font-medium pb-2">Top customers</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentTypeRows.map((row) => (
                    <tr key={row.equipmentType} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-semibold text-foreground">{row.equipmentType}</td>
                      <td className="py-2.5 pr-3 text-right">{row.equipmentCount}</td>
                      <td className="py-2.5 pr-3 text-right">{row.workOrderCount}</td>
                      <td className="py-2.5 pr-3 text-right">{row.completedWorkOrderCount}</td>
                      <td className="py-2.5 pr-3 text-right">{row.openWorkOrderCount}</td>
                      <td className="py-2.5 pr-3 text-right">{row.calibrationCount}</td>
                      <td className="py-2.5 pr-3 text-right">{row.invoiceCount}</td>
                      <td className="py-2.5 pr-3 text-right font-bold text-foreground">{fmtUsdFromCents(row.linkedRevenueCents)}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {row.averageRevenuePerWorkOrderCents != null ? fmtUsdFromCents(row.averageRevenuePerWorkOrderCents) : "—"}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {row.topCustomers.length > 0
                          ? row.topCustomers.slice(0, 3).map((c) => `${c.customerName} (${c.workOrderCount} WO)`).join(", ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {equipmentTypeRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground">
                        No equipment-linked activity in this window for the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Unlinked invoices are intentionally excluded from equipment-type revenue so the report does not overstate category performance.
            </p>
          </div>
        </Section>

        {/* ── Equipment Intelligence (Phase 2) ── */}
        <EquipmentCategoryBreakdownCard
          rows={equipmentIntelRows}
          loading={equipmentIntelLoading}
          title="Equipment Intelligence"
          subtitle={`Equipment count, open service load, upcoming due, and revenue grouped by equipment type${
            customerId !== "all" ? " for the selected customer" : ""
          }${equipmentCategory !== "all" ? ` (filtered to "${equipmentCategory}")` : ""}.`}
          emptyLabel="No equipment activity in this scope yet."
        />

        {/* ── Overdue invoices ── */}
        <Section
          title="Overdue Invoice Analytics"
          sub="Open balances past due date (excludes paid / void)"
          action={
            analytics ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ds-badge-danger border">
                {analytics.summary.overdueInvoicesCount} · {fmtUsdFromCents(analytics.summary.overdueInvoicesAmountCents)}
              </span>
            ) : null
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border ds-table-header-row-subtle">
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Invoice</th>
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Customer</th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Amount</th>
                  <th className="text-right text-muted-foreground font-medium pb-2">Days overdue</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.overdueInvoices ?? []).slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-foreground">{r.invoiceNumber}</td>
                    <td className="py-2.5 pr-3 truncate">{r.customerName}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{fmtUsdFromCents(r.amountCents)}</td>
                    <td className="py-2.5 text-right">{r.daysOverdue}</td>
                  </tr>
                ))}
                {!analytics?.overdueInvoices?.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No overdue invoices for the current customer filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Alerts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <Section
            title="Repeat Repair Analysis"
            sub="Trailing 90 days from report end — multiple work orders per asset"
            action={
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ds-badge-danger border">
                {repeatDisplay.length} assets
              </span>
            }
          >
            <div className="space-y-2">
              {repeatDisplay.slice(0, 12).map((r, idx) => (
                <div
                  key={`${r.equipment}-${r.customer}-${idx}`}
                  className="flex items-start gap-3 p-3 rounded-lg ds-alert-danger border"
                >
                  <RefreshCcw className="w-4 h-4 ds-icon-danger mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{r.equipment}</p>
                    <p className="text-[11px] text-muted-foreground">{r.customer}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] font-medium ds-text-danger">{r.repairs}× visits</span>
                      <span className="text-[11px] text-muted-foreground">{r.issue}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">Last: {r.lastRepair}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Warranty Expiration Tracking"
            sub="Equipment with warranty end date inside the selected window"
            action={
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ds-badge-warning border">
                {warrantyDisplay.length} expiring
              </span>
            }
          >
            <div className="space-y-2">
              {warrantyDisplay.slice(0, 12).map((w, idx) => (
                <div
                  key={`${w.equipment}-${w.customer}-${idx}`}
                  className="flex items-start gap-3 p-3 rounded-lg ds-alert-warning border"
                >
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

        {/* ── Saved presets ── */}
        <div className="print:hidden">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Filter className="w-4 h-4" /> Saved report presets
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Store filter combinations in this browser (per organization).</p>
            </div>
            <div className="flex-1" />
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary w-48"
            />
            <Button type="button" size="sm" variant="secondary" onClick={saveCurrentPreset} disabled={!orgId || !presetName.trim()}>
              <BookmarkPlus className="w-3.5 h-3.5" /> Save
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              type="button"
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors"
              onClick={() => {
                setDateRange("Last 30 days")
                clearFilters()
              }}
            >
              <p className="text-sm font-semibold text-foreground">Executive snapshot</p>
              <p className="text-[11px] text-muted-foreground mt-1">Last 30 days · all filters cleared</p>
            </button>
            <button
              type="button"
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors"
              onClick={() => {
                setDateRange("Last 90 days")
                setTechnicianId("all")
                setEquipmentCategory("all")
              }}
            >
              <p className="text-sm font-semibold text-foreground">Technician scorecard window</p>
              <p className="text-[11px] text-muted-foreground mt-1">Last 90 days — refine customer below</p>
            </button>
            <button
              type="button"
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors"
              onClick={() => {
                setDateRange("Last 60 days")
                clearFilters()
              }}
            >
              <p className="text-sm font-semibold text-foreground">Compliance & reliability</p>
              <p className="text-[11px] text-muted-foreground mt-1">60-day window for PM mix and asset density</p>
            </button>

            {presets.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {p.dateRange}
                    {p.customerId !== "all" ? " · customer scoped" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-md py-1.5 bg-primary text-primary-foreground"
                    onClick={() => applyPreset(p)}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center p-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive"
                    title="Delete preset"
                    onClick={() => deletePreset(p.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
