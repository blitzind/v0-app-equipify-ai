"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Equipment, ServiceHistoryEntry } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { intervalFromDb, planStatusDbToUi } from "@/lib/maintenance-plans/db-map"
import type { MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  Wrench, ClipboardList, FileText, AlertTriangle, Pencil, X, Check,
  ExternalLink, CalendarPlus,
  AlertOctagon, Calendar,
  StickyNote, Shield, Cpu,
} from "lucide-react"
import { ContactActions } from "@/components/contact-actions"
import { AIRecommendationPanel, type AIRecommendation } from "@/components/ai"

let toastCounter = 0

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Equipment["status"], string> = {
  "Active":        "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service":"bg-destructive/15 text-destructive border-destructive/30",
  "In Repair":     "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

const STATUSES: Equipment["status"][] = ["Active", "Needs Service", "In Repair", "Out of Service"]

const TABS = [
  { id: "overview", label: "Overview", icon: Cpu },
  { id: "service", label: "Service History", icon: Wrench },
  { id: "plans", label: "Maintenance Plans", icon: Calendar },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "warranty", label: "Warranty", icon: Shield },
  { id: "notes", label: "Notes", icon: StickyNote },
] as const

type TabId = (typeof TABS)[number]["id"]

type PlanWoRow = {
  id: string
  work_order_number?: number | null
  title: string
  status: string
  type: string
  scheduled_on: string | null
  maintenance_plan_id: string | null
  created_at: string
}

type DrawerAssetWo = {
  id: string
  work_order_number?: number | null
  title: string
  status: string
  type: string
  scheduled_on: string | null
  created_at: string
  completed_at: string | null
  total_labor_cents: number
  total_parts_cents: number
  maintenance_plan_id: string | null
}

type EqDrawerPlanRow = {
  id: string
  name: string
  status: string
  interval_value: number
  interval_unit: string
  next_due_date: string | null
  equipment_id: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function woDbStatusLabel(s: string) {
  const m: Record<string, string> = {
    open: "Open",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    invoiced: "Invoiced",
  }
  return m[s] ?? s
}

function woDbTypeLabel(s: string) {
  if (!s) return "—"
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function eqPlanIntervalLabel(row: EqDrawerPlanRow): string {
  const u = row.interval_unit as MaintenancePlanRow["interval_unit"]
  const { interval, customIntervalDays } = intervalFromDb(row.interval_value, u)
  return interval === "Custom" ? `${customIntervalDays} day cycle` : interval
}

function woTypeToServiceHistoryType(typeDb: string): ServiceHistoryEntry["type"] {
  const t = (typeDb ?? "").toLowerCase()
  if (t === "pm") return "PM"
  if (t === "inspection") return "Inspection"
  if (t === "install") return "Install"
  return "Repair"
}

function woRowsToServiceHistory(rows: DrawerAssetWo[]): ServiceHistoryEntry[] {
  return rows.map((wo) => ({
    id: wo.id,
    date: (wo.completed_at ?? wo.created_at).slice(0, 10),
    type: woTypeToServiceHistoryType(wo.type),
    technician: "",
    workOrderId: wo.id,
    description: wo.title,
    cost: ((wo.total_labor_cents ?? 0) + (wo.total_parts_cents ?? 0)) / 100,
    status:
      wo.status === "completed" || wo.status === "invoiced" ? ("Completed" as const) : ("Cancelled" as const),
  }))
}

function warrantyKpiLabel(days: number, hasDate: boolean): string {
  if (!hasDate) return "—"
  if (days < 0) return "Expired"
  if (days <= 90) return "Expiring"
  return "Active"
}

function daysToDue(dateStr: string) {
  if (!dateStr) return 9999
  const due   = new Date(dateStr + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

function ageYears(installDate: string) {
  if (!installDate) return 0
  return new Date().getFullYear() - new Date(installDate).getFullYear()
}

const drawerInputClass =
  "h-8 min-h-8 w-full px-2 text-xs md:text-xs bg-white border-border text-foreground"

function EditableRow({ label, value, editing, children }: {
  label: string; value: React.ReactNode; editing: boolean; children?: React.ReactNode
}) {
  return editing ? (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-1.5 w-32">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  ) : (
    <DrawerRow label={label} value={value} />
  )
}

// ─── AI Recommendations ───────────────────────────────────────────────────────

function buildAIRecommendations(eq: Equipment): AIRecommendation[] {
  const recs: AIRecommendation[] = []
  const days        = daysToDue(eq.nextDueDate)
  const warrantyDays= daysToDue(eq.warrantyExpiration)
  const repairCount = eq.serviceHistory.filter((h) => h.type === "Repair").length
  const age         = ageYears(eq.installDate)
  const totalRepairCost = eq.serviceHistory.filter(h => h.type === "Repair").reduce((s, h) => s + h.cost, 0)

  // Failure risk / replacement
  if (age >= 10 || repairCount >= 3) {
    const failureScore = Math.min(95, 40 + repairCount * 12 + Math.max(0, age - 8) * 4)
    recs.push({
      id: "failure-risk",
      title: `Failure risk score: ${failureScore}%`,
      description: age >= 10
        ? `This unit is ~${age} years old. Equipment beyond 10 years sees significantly higher failure rates and downtime costs.`
        : `This equipment has had ${repairCount} repair events totaling ${fmtCurrency(totalRepairCost)}. Frequent repairs often signal end-of-life.`,
      severity: failureScore >= 70 ? "critical" : "warning",
      meta: age >= 10 ? `${age} yrs old · ${repairCount} repairs` : `${repairCount} repairs · ${fmtCurrency(totalRepairCost)}`,
      actionLabel: "Create replacement quote",
      onAction: () => undefined,
    })
  }

  // Repeat repair alert
  const recentRepairs = eq.serviceHistory.filter(h => {
    if (h.type !== "Repair") return false
    const d = new Date(h.date)
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12)
    return d >= cutoff
  })
  if (recentRepairs.length >= 2) {
    recs.push({
      id: "repeat-repair",
      title: `Repeat repair alert — ${recentRepairs.length} repairs in 12 months`,
      description: "Multiple repairs within a single service year indicate a recurring failure mode. A root cause analysis is recommended to prevent further unplanned downtime.",
      severity: "warning",
      meta: `${recentRepairs.length} repairs / yr`,
      actionLabel: "Create work order",
      onAction: () => undefined,
    })
  }

  // Service overdue / due soon
  if (days <= 0) {
    recs.push({
      id: "service-now",
      title: "Schedule preventive service immediately",
      description: `Service is ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue. Delaying further increases the risk of unplanned downtime.`,
      severity: "critical",
      meta: `${Math.abs(days)}d overdue`,
      actionLabel: "Create work order",
      onAction: () => undefined,
    })
  } else if (days <= 14) {
    recs.push({
      id: "service-soon",
      title: "Preventive service due within 2 weeks",
      description: `Next scheduled service is in ${days} day${days !== 1 ? "s" : ""}. Book now to avoid scheduling conflicts.`,
      severity: "warning",
      meta: `Due in ${days}d`,
      actionLabel: "Schedule service",
      onAction: () => undefined,
    })
  }

  // PM recommendation
  const lastServiceDays = eq.lastServiceDate ? daysToDue(eq.lastServiceDate) : -999
  const hasGap = lastServiceDays < -180
  if (hasGap || repairCount === 0) {
    recs.push({
      id: "pm-plan",
      title: "Recommend a preventive maintenance plan",
      description: "This equipment does not appear to have a scheduled PM contract. A plan reduces emergency call-outs and generates recurring contract revenue.",
      severity: "info",
      meta: "Revenue opportunity",
      actionLabel: "Create maintenance plan",
      onAction: () => undefined,
    })
  }

  // Warranty expiring
  if (warrantyDays > 0 && warrantyDays <= 90) {
    recs.push({
      id: "warranty-expiring",
      title: "Warranty expiring soon",
      description: `Warranty expires in ${warrantyDays} days. Perform a pre-warranty inspection and address any latent issues before coverage ends.`,
      severity: "info",
      meta: `Expires in ${warrantyDays}d`,
      actionLabel: "Schedule inspection",
      onAction: () => undefined,
    })
  }

  // Replacement recommendation
  if (eq.replacementCost && totalRepairCost > eq.replacementCost * 0.4) {
    recs.push({
      id: "replacement-rec",
      title: "Replacement recommended",
      description: `Cumulative repair costs (${fmtCurrency(totalRepairCost)}) have exceeded 40% of replacement value (${fmtCurrency(eq.replacementCost)}). Replacing is likely more cost-effective.`,
      severity: "warning",
      meta: `${Math.round((totalRepairCost / eq.replacementCost) * 100)}% of replacement cost`,
      actionLabel: "Create replacement quote",
      onAction: () => undefined,
    })
  }

  if (recs.length === 0) {
    recs.push({
      id: "no-action",
      title: "No immediate action required",
      description: "This equipment is in good standing. Continue on current service schedule.",
      severity: "info",
      meta: "All checks passed",
    })
  }

  return recs
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EquipmentDrawerProps {
  equipmentId: string | null
  onClose: () => void
  onUpdated?: () => void
}

type DbEquipmentRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_code: string | null
  name: string
  manufacturer: string | null
  category: string | null
  serial_number: string | null
  status: "active" | "needs_service" | "out_of_service" | "in_repair"
  install_date: string | null
  warranty_start_date: string | null
  warranty_expiration_date: string | null
  /** Legacy field kept for backward compatibility while migrating. */
  warranty_expires_at: string | null
  last_service_at: string | null
  next_due_at: string | null
  location_label: string | null
  notes: string | null
}

type DrawerCustomer = {
  id: string
  company_name: string
}

function mapDbStatusToUiStatus(status: DbEquipmentRow["status"]): Equipment["status"] {
  switch (status) {
    case "active":
      return "Active"
    case "needs_service":
      return "Needs Service"
    case "in_repair":
      return "In Repair"
    case "out_of_service":
      return "Out of Service"
    default:
      return "Active"
  }
}

function mapUiStatusToDbStatus(status: Equipment["status"]): DbEquipmentRow["status"] {
  switch (status) {
    case "Active":
      return "active"
    case "Needs Service":
      return "needs_service"
    case "In Repair":
      return "in_repair"
    case "Out of Service":
      return "out_of_service"
    default:
      return "active"
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EquipmentDrawer({ equipmentId, onClose, onUpdated }: EquipmentDrawerProps) {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [eq, setEq] = useState<Equipment | null>(null)
  const [drawerWOs, setDrawerWOs] = useState<DrawerAssetWo[]>([])
  const [drawerPlans, setDrawerPlans] = useState<EqDrawerPlanRow[]>([])
  const [customers, setCustomers] = useState<DrawerCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Equipment>>({})
  const [warrantyEditing, setWarrantyEditing] = useState(false)
  const [warrantySaving, setWarrantySaving] = useState(false)
  const [warrantyDraftStartDate, setWarrantyDraftStartDate] = useState("")
  const [warrantyDraftExpirationDate, setWarrantyDraftExpirationDate] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [planLinkedWOs, setPlanLinkedWOs] = useState<PlanWoRow[]>([])
  const [planWoLoading, setPlanWoLoading] = useState(false)

  const eqPlanIdsKey = useMemo(() => drawerPlans.map((p) => p.id).sort().join(","), [drawerPlans])

  const openWOsList = useMemo(
    () => drawerWOs.filter((w) => w.status !== "completed" && w.status !== "invoiced"),
    [drawerWOs],
  )
  const completedWOCount = useMemo(
    () => drawerWOs.filter((w) => w.status === "completed" || w.status === "invoiced").length,
    [drawerWOs],
  )
  const activePlanCount = useMemo(
    () => drawerPlans.filter((p) => planStatusDbToUi(p.status) === "Active").length,
    [drawerPlans],
  )
  const planNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of drawerPlans) m[p.id] = p.name
    return m
  }, [drawerPlans])
  const activeMaintenancePlans = useMemo(
    () => drawerPlans.filter((p) => planStatusDbToUi(p.status) === "Active"),
    [drawerPlans],
  )
  const inactiveMaintenancePlans = useMemo(
    () => drawerPlans.filter((p) => planStatusDbToUi(p.status) !== "Active"),
    [drawerPlans],
  )
  const completedHistoryForAi = useMemo(
    () =>
      woRowsToServiceHistory(
        drawerWOs.filter((w) => w.status === "completed" || w.status === "invoiced"),
      ),
    [drawerWOs],
  )
  const eqForAi = useMemo((): Equipment | null => {
    if (!eq) return null
    return { ...eq, serviceHistory: completedHistoryForAi }
  }, [eq, completedHistoryForAi])
  const totalServiceCost = useMemo(
    () =>
      drawerWOs.reduce((s, w) => s + ((w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)) / 100, 0),
    [drawerWOs],
  )
  const overviewRecentTimeline = useMemo(() => {
    type Ev = { at: string; label: string; desc: string; accent: "success" | "warning" | "muted" }
    const ev: Ev[] = []
    for (const wo of drawerWOs) {
      ev.push({
        at: wo.created_at,
        label: `Work order opened · ${formatWorkOrderDisplay(wo.work_order_number, wo.id)}`,
        desc: `${wo.title} · ${woDbStatusLabel(wo.status)}`,
        accent: "muted",
      })
      if (wo.completed_at) {
        ev.push({
          at: wo.completed_at,
          label: `Work order completed · ${formatWorkOrderDisplay(wo.work_order_number, wo.id)}`,
          desc: wo.title,
          accent: "success",
        })
      }
    }
    ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return ev.slice(0, 12).map((e) => ({
      date: new Date(e.at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      label: e.label,
      description: e.desc,
      accent: e.accent,
    }))
  }, [drawerWOs])

  useEffect(() => {
    if (activeTab !== "plans" || !eq || !activeOrgId) return
    if (!eqPlanIdsKey) {
      setPlanLinkedWOs([])
      setPlanWoLoading(false)
      return
    }

    let cancelled = false
    setPlanWoLoading(true)
    const planIds = eqPlanIdsKey.split(",").filter(Boolean)

    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const eqPlanWoSelWithNum =
        "id, work_order_number, title, status, type, scheduled_on, maintenance_plan_id, created_at"
      const eqPlanWoSel = eqPlanWoSelWithNum.replace("work_order_number, ", "")

      let woRes = await supabase
        .from("work_orders")
        .select(eqPlanWoSelWithNum)
        .eq("organization_id", activeOrgId)
        .eq("equipment_id", eq.id)
        .in("maintenance_plan_id", planIds)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(40)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(eqPlanWoSel)
          .eq("organization_id", activeOrgId)
          .eq("equipment_id", eq.id)
          .in("maintenance_plan_id", planIds)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(40)
      }

      const { data, error } = woRes

      if (cancelled) return
      if (error) {
        setPlanLinkedWOs([])
        setPlanWoLoading(false)
        return
      }
      setPlanLinkedWOs((data ?? []) as PlanWoRow[])
      setPlanWoLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [activeTab, eq, activeOrgId, eqPlanIdsKey])

  const loadDrawerData = useCallback(async () => {
    if (!equipmentId) {
      setEq(null)
      setCustomers([])
      setDrawerWOs([])
      setDrawerPlans([])
      return
    }

    setLoading(true)
    const supabase = createBrowserSupabaseClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setEq(null)
        setCustomers([])
        setDrawerWOs([])
        setDrawerPlans([])
        return
      }

      const orgId = orgStatus === "ready" ? activeOrgId : null
      if (!orgId) {
        setEq(null)
        setCustomers([])
        setDrawerWOs([])
        setDrawerPlans([])
        return
      }

      const { data: customerRows } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .order("company_name", { ascending: true })

      setCustomers((customerRows ?? []) as DrawerCustomer[])

      const { data: row, error } = await supabase
        .from("equipment")
        .select(
          "id, organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number, status, install_date, warranty_start_date, warranty_expiration_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes"
        )
        .eq("id", equipmentId)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .maybeSingle()

      if (error || !row) {
        setEq(null)
        setDrawerWOs([])
        setDrawerPlans([])
        return
      }

      const equipmentRow = row as DbEquipmentRow
      const customerName =
        (customerRows as DrawerCustomer[] | null)?.find((c) => c.id === equipmentRow.customer_id)?.company_name ?? "Unknown Customer"

      setEq({
        id: equipmentRow.id,
        customerId: equipmentRow.customer_id,
        customerName,
        equipmentCode: equipmentRow.equipment_code ?? undefined,
        model: equipmentRow.name,
        manufacturer: equipmentRow.manufacturer ?? "",
        category: equipmentRow.category ?? "",
        serialNumber: equipmentRow.serial_number ?? "",
        installDate: equipmentRow.install_date ?? "",
        warrantyStartDate: equipmentRow.warranty_start_date ?? "",
        warrantyExpiration:
          equipmentRow.warranty_expiration_date ?? equipmentRow.warranty_expires_at ?? "",
        lastServiceDate: equipmentRow.last_service_at ?? "",
        nextDueDate: equipmentRow.next_due_at ?? "",
        status: mapDbStatusToUiStatus(equipmentRow.status),
        notes: equipmentRow.notes ?? "",
        location: equipmentRow.location_label ?? "",
        photos: [],
        manuals: [],
        serviceHistory: [],
      })
      setWarrantyDraftStartDate(equipmentRow.warranty_start_date ?? "")
      setWarrantyDraftExpirationDate(
        equipmentRow.warranty_expiration_date ?? equipmentRow.warranty_expires_at ?? "",
      )

      let woListRes = await supabase
        .from("work_orders")
        .select(WO_LIST_SELECT_WITH_NUM)
        .eq("organization_id", orgId)
        .eq("equipment_id", equipmentRow.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(150)

      if (woListRes.error && missingWorkOrderNumberColumn(woListRes.error)) {
        woListRes = await supabase
          .from("work_orders")
          .select(WO_LIST_SELECT)
          .eq("organization_id", orgId)
          .eq("equipment_id", equipmentRow.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(150)
      }

      if (woListRes.error) {
        setDrawerWOs([])
      } else {
        setDrawerWOs((woListRes.data ?? []) as DrawerAssetWo[])
      }

      const { data: planData } = await supabase
        .from("maintenance_plans")
        .select("id, name, status, interval_value, interval_unit, next_due_date, equipment_id")
        .eq("organization_id", orgId)
        .eq("equipment_id", equipmentRow.id)
        .eq("is_archived", false)
        .order("next_due_date", { ascending: true, nullsFirst: false })

      setDrawerPlans((planData ?? []) as EqDrawerPlanRow[])
    } finally {
      setLoading(false)
    }
  }, [equipmentId, activeOrgId, orgStatus])

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setActiveTab("overview")
    void loadDrawerData()
  }, [equipmentId, loadDrawerData])

  useEffect(() => {
    if (!equipmentId) {
      setEq(null)
      setCustomers([])
      setDrawerWOs([])
      setDrawerPlans([])
    }
  }, [equipmentId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!eq) return
    setDraft({
      model: eq.model, manufacturer: eq.manufacturer, category: eq.category,
      serialNumber: eq.serialNumber, location: eq.location,
      installDate: eq.installDate, warrantyStartDate: eq.warrantyStartDate ?? "", warrantyExpiration: eq.warrantyExpiration,
      lastServiceDate: eq.lastServiceDate, nextDueDate: eq.nextDueDate,
      status: eq.status, notes: eq.notes,
    })
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setDraft({}) }

  async function saveEdit() {
    if (!eq || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()

    const updatePayload = {
      name: (draft.model ?? eq.model).trim(),
      manufacturer: (draft.manufacturer ?? eq.manufacturer).trim() || null,
      category: (draft.category ?? eq.category).trim() || null,
      serial_number: (draft.serialNumber ?? eq.serialNumber).trim() || null,
      status: mapUiStatusToDbStatus((draft.status ?? eq.status) as Equipment["status"]),
      install_date: (draft.installDate ?? eq.installDate) || null,
      warranty_start_date: (draft.warrantyStartDate ?? eq.warrantyStartDate ?? "") || null,
      warranty_expiration_date: (draft.warrantyExpiration ?? eq.warrantyExpiration) || null,
      warranty_expires_at: (draft.warrantyExpiration ?? eq.warrantyExpiration) || null,
      last_service_at: (draft.lastServiceDate ?? eq.lastServiceDate) || null,
      next_due_at: (draft.nextDueDate ?? eq.nextDueDate) || null,
      location_label: (draft.location ?? eq.location).trim() || null,
      notes: (draft.notes ?? eq.notes).trim() || null,
    }

    const { error } = await supabase
      .from("equipment")
      .update(updatePayload)
      .eq("id", eq.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }

    setEditing(false)
    setDraft({})
    toast("Equipment updated successfully")
    await loadDrawerData()
    onUpdated?.()
  }

  async function archiveEquipment() {
    if (!eq || !activeOrgId) return
    if (!window.confirm("Archive this equipment?")) return
    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase
      .from("equipment")
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq("id", eq.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Archive failed: ${error.message}`)
      return
    }

    toast("Equipment archived")
    onUpdated?.()
    onClose()
  }

  function setField<K extends keyof Equipment>(field: K, value: Equipment[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function startWarrantyEdit() {
    if (!eq) return
    setWarrantyDraftStartDate(eq.warrantyStartDate ?? "")
    setWarrantyDraftExpirationDate(eq.warrantyExpiration ?? "")
    setWarrantyEditing(true)
  }

  function cancelWarrantyEdit() {
    if (!eq) return
    setWarrantyDraftStartDate(eq.warrantyStartDate ?? "")
    setWarrantyDraftExpirationDate(eq.warrantyExpiration ?? "")
    setWarrantyEditing(false)
  }

  async function saveWarrantyEdit() {
    if (!eq || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    setWarrantySaving(true)
    const { error } = await supabase
      .from("equipment")
      .update({
        warranty_start_date: warrantyDraftStartDate || null,
        warranty_expiration_date: warrantyDraftExpirationDate || null,
        warranty_expires_at: warrantyDraftExpirationDate || null,
      })
      .eq("id", eq.id)
      .eq("organization_id", activeOrgId)
    setWarrantySaving(false)
    if (error) {
      toast(`Warranty update failed: ${error.message}`)
      return
    }
    toast("Warranty updated")
    setWarrantyEditing(false)
    await loadDrawerData()
    onUpdated?.()
  }

  if (!equipmentId) return null

  if (!eq) {
    return (
      <DetailDrawer
        open={!!equipmentId}
        onClose={onClose}
        title={loading ? "Loading equipment..." : "Equipment not found"}
        subtitle={loading ? "Fetching latest equipment data" : "This record may be archived or outside your organization"}
        width="xl"
      >
        <div className="px-5 py-6 text-sm text-muted-foreground">
          {loading ? "Loading..." : "Unable to load this equipment."}
        </div>
      </DetailDrawer>
    )
  }

  // Derived values (equipment row)
  const days = daysToDue(eq.nextDueDate)
  const daysLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`
  const daysColor = days < 0 ? "text-destructive" : days <= 7 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
  const warrantyDays = daysToDue(eq.warrantyExpiration)
  const warrantyHasDate = Boolean(eq.warrantyExpiration?.trim())
  const warrantyLabel =
    !warrantyHasDate ? "No warranty information added" : warrantyDays < 0 ? "Expired" : warrantyDays <= 30 ? `Expires in ${warrantyDays}d` : fmtDate(eq.warrantyExpiration)
  const warrantyColor =
    !warrantyHasDate
      ? "text-muted-foreground"
      : warrantyDays < 0
        ? "text-destructive"
        : warrantyDays <= 30
          ? "text-[color:var(--status-warning)]"
          : "text-foreground"
  const currentStatus = (draft.status ?? eq.status) as Equipment["status"]
  const age = ageYears(eq.installDate)
  const warrantyKpiDisplay = warrantyKpiLabel(warrantyDays, warrantyHasDate)
  const warrantyKpiSub = !warrantyHasDate
    ? "No warranty information added"
    : warrantyDays < 0
      ? `Expired ${fmtDate(eq.warrantyExpiration)}`
      : `Ends ${fmtDate(eq.warrantyExpiration)}`
  const warrantyDirty =
    warrantyDraftStartDate !== (eq.warrantyStartDate ?? "") ||
    warrantyDraftExpirationDate !== (eq.warrantyExpiration ?? "")

  const woNewHref = `/work-orders?action=new-work-order&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`
  const quoteNewHref = `/quotes?action=new-quote&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`
  const planNewHref = `/maintenance-plans?new=1&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`

  return (
    <>
      <DetailDrawer
        open={!!equipmentId}
        onClose={onClose}
        title={getEquipmentDisplayPrimary({
          id: eq.id,
          name: eq.model,
          equipment_code: eq.equipmentCode,
          serial_number: eq.serialNumber,
          category: eq.category,
        })}
        subtitle={`${getEquipmentSecondaryLine(
          {
            id: eq.id,
            name: eq.model,
            equipment_code: eq.equipmentCode,
            serial_number: eq.serialNumber,
            category: eq.category,
          },
          eq.customerName,
        )}${eq.manufacturer ? ` · ${eq.manufacturer}` : ""}`}
        width="xl"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_COLORS[currentStatus])}>
            {currentStatus}
          </Badge>
        }
        noScroll
        actions={
          editing ? (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={saveEdit}>
                <Check className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" asChild className="text-xs cursor-pointer">
                <Link href={woNewHref} className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 shrink-0" /> New Work Order
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="text-xs cursor-pointer">
                <Link href={quoteNewHref} className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 shrink-0" /> New Quote
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="text-xs cursor-pointer">
                <Link href={planNewHref} className="flex items-center gap-1.5">
                  <CalendarPlus className="w-3.5 h-3.5 shrink-0" /> New Maintenance Plan
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="text-xs cursor-pointer">
                <Link href={`/equipment/${eq.id}`} className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Full profile
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={archiveEquipment}
              >
                <AlertOctagon className="w-3.5 h-3.5" /> Archive
              </Button>
            </>
          )
        }
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          {!editing && days <= 7 && (
            <div className="shrink-0 px-5 pt-3">
              <div
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium",
                  days < 0
                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : "bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]",
                )}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Service {days < 0 ? "overdue" : `due in ${days} day${days !== 1 ? "s" : ""}`} — {fmtDate(eq.nextDueDate)}
                </span>
              </div>
            </div>
          )}

          {!editing && (
            <div className="shrink-0 bg-background border-b border-border z-[11]">
              <div className="flex min-w-0 gap-0 overflow-x-auto scrollbar-none px-5">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {tab.id === "service" && drawerWOs.length > 0 && (
                        <span className="ml-0.5 bg-muted text-muted-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                          {drawerWOs.length}
                        </span>
                      )}
                      {tab.id === "plans" && drawerPlans.length > 0 && (
                        <span className="ml-0.5 bg-muted text-muted-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                          {drawerPlans.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 space-y-5">

          {/* ── OVERVIEW ── */}
          {(activeTab === "overview" || editing) && (
            <>
              {/* AI Recommendations — shown only when not editing */}
              {!editing && eqForAi && (
                <AIRecommendationPanel
                  title="AI Insights"
                  recommendations={buildAIRecommendations(eqForAi)}
                  initialLimit={3}
                />
              )}

              {!editing && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {(
                    [
                      {
                        label: "Open Work Orders",
                        value: String(openWOsList.length),
                        sub: "not completed",
                        warn: openWOsList.length > 0,
                      },
                      {
                        label: "Completed Work Orders",
                        value: String(completedWOCount),
                        sub: "completed or invoiced",
                        warn: false,
                      },
                      {
                        label: "Active Maintenance Plans",
                        value: String(activePlanCount),
                        sub: "on this asset",
                        warn: false,
                      },
                      {
                        label: "Warranty Status",
                        value: warrantyKpiDisplay,
                        sub: warrantyKpiSub,
                        warn: warrantyHasDate && warrantyDays >= 0 && warrantyDays <= 90,
                      },
                    ] as const
                  ).map(({ label, value, sub, warn }) => (
                    <div
                      key={label}
                      className="bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p
                        className={cn(
                          "text-xl font-bold tracking-tight",
                          warn ? "text-[color:var(--status-warning)]" : "text-foreground",
                        )}
                      >
                        {value}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-snug">{sub}</p>
                    </div>
                  ))}
                </div>
              )}

              {!editing && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" asChild>
                      <Link href={woNewHref}>
                        <ClipboardList className="w-3.5 h-3.5" /> New Work Order
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" asChild>
                      <Link href={quoteNewHref}>
                        <FileText className="w-3.5 h-3.5" /> New Quote
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" asChild>
                      <Link href={planNewHref}>
                        <CalendarPlus className="w-3.5 h-3.5" /> New Maintenance Plan
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {!editing && overviewRecentTimeline.length > 0 && (
                <DrawerSection title="Recent service activity">
                  <DrawerTimeline items={overviewRecentTimeline} />
                </DrawerSection>
              )}

              {/* Equipment Details */}
              <DrawerSection title="Equipment Details">
                <EditableRow label="Model" value={eq.model} editing={editing}>
                  <Input
                    value={draft.model ?? ""}
                    onChange={(e) => setField("model", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Manufacturer" value={eq.manufacturer} editing={editing}>
                  <Input
                    value={draft.manufacturer ?? ""}
                    onChange={(e) => setField("manufacturer", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Category" value={eq.category} editing={editing}>
                  <Input
                    value={draft.category ?? ""}
                    onChange={(e) => setField("category", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Serial Number" value={eq.serialNumber || "—"} editing={editing}>
                  <Input
                    value={draft.serialNumber ?? ""}
                    onChange={(e) => setField("serialNumber", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Customer" value={
                  <Link href={`/customers?open=${eq.customerId}`} className="text-primary hover:underline font-medium">
                    {eq.customerName}
                  </Link>
                } editing={editing}>
                  <Input
                    readOnly
                    value={customers.find((c) => c.id === eq.customerId)?.company_name ?? eq.customerName}
                    className={cn(drawerInputClass, "bg-muted/40 text-muted-foreground")}
                    tabIndex={-1}
                  />
                </EditableRow>
                <EditableRow label="Location" value={eq.location || "—"} editing={editing}>
                  <Input
                    value={draft.location ?? ""}
                    onChange={(e) => setField("location", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Assigned Tech" value={eq.assignedTechnician || "—"} editing={editing}>
                  <Input
                    value={draft.assignedTechnician ?? ""}
                    onChange={(e) => setField("assignedTechnician", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Status" value={
                  <Badge variant="secondary" className={cn("text-[10px] border", STATUS_COLORS[eq.status])}>{eq.status}</Badge>
                } editing={editing}>
                  <Select
                    value={draft.status ?? eq.status}
                    onValueChange={(v) => setField("status", v as Equipment["status"])}
                  >
                    <SelectTrigger size="sm" className={cn(drawerInputClass, "w-full")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditableRow>
                {!editing && eq.location && (
                  <div className="pt-1">
                    <ContactActions address={eq.location} email={{ customerName: eq.customerName }} />
                  </div>
                )}
              </DrawerSection>

              {/* Service Information */}
              <DrawerSection title="Service Information">
                <EditableRow label="Installed" value={fmtDate(eq.installDate)} editing={editing}>
                  <Input
                    type="date"
                    value={draft.installDate ?? ""}
                    onChange={(e) => setField("installDate", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Last Service" value={fmtDate(eq.lastServiceDate)} editing={editing}>
                  <Input
                    type="date"
                    value={draft.lastServiceDate ?? ""}
                    onChange={(e) => setField("lastServiceDate", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow label="Next Due" value={
                  <span className={cn("font-semibold", daysColor)}>{fmtDate(eq.nextDueDate)} · {daysLabel}</span>
                } editing={editing}>
                  <Input
                    type="date"
                    value={draft.nextDueDate ?? ""}
                    onChange={(e) => setField("nextDueDate", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow
                  label="Warranty start"
                  value={eq.warrantyStartDate ? fmtDate(eq.warrantyStartDate) : "—"}
                  editing={editing}
                >
                  <Input
                    type="date"
                    value={draft.warrantyStartDate ?? ""}
                    onChange={(e) => setField("warrantyStartDate", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
                <EditableRow
                  label="Warranty expiration"
                  value={eq.warrantyExpiration ? fmtDate(eq.warrantyExpiration) : "—"}
                  editing={editing}
                >
                  <Input
                    type="date"
                    value={draft.warrantyExpiration ?? ""}
                    onChange={(e) => setField("warrantyExpiration", e.target.value)}
                    className={drawerInputClass}
                  />
                </EditableRow>
              </DrawerSection>
            </>
          )}

          {/* ── SERVICE HISTORY ── */}
          {activeTab === "service" && !editing && (
            <>
              {/* Summary stat row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Events", value: drawerWOs.length },
                  {
                    label: "Repairs",
                    value: drawerWOs.filter((w) => (w.type ?? "").toLowerCase() === "repair").length,
                  },
                  { label: "Total Cost", value: fmtCurrency(totalServiceCost) },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <DrawerSection title={`Service history (${drawerWOs.length})`}>
                {drawerWOs.length > 0 ? (
                  <div className="space-y-2">
                    {drawerWOs
                      .slice()
                      .sort((a, b) =>
                        (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at),
                      )
                      .map((wo) => (
                        <Link
                          key={wo.id}
                          href={`/work-orders?open=${wo.id}`}
                          className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <p className="text-xs font-semibold font-mono text-primary truncate">
                              {formatWorkOrderDisplay(wo.work_order_number, wo.id)}
                            </p>
                            <p className="text-xs text-foreground font-medium truncate">{wo.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {woDbTypeLabel(wo.type)} · {fmtDate(wo.scheduled_on ?? wo.created_at.slice(0, 10))}
                              {wo.completed_at ? ` · Done ${fmtDate(wo.completed_at.slice(0, 10))}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px]">
                              {woDbStatusLabel(wo.status)}
                            </Badge>
                            <ExternalLink
                              size={11}
                              className="text-muted-foreground/50 group-hover:text-primary transition-colors"
                            />
                          </div>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No work orders on record for this equipment.</p>
                )}
              </DrawerSection>
            </>
          )}

          {/* ── MAINTENANCE PLANS ── */}
          {activeTab === "plans" && !editing && (
            <>
              <DrawerSection
                title={`Maintenance plans (${drawerPlans.length})`}
                action={
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] cursor-pointer" asChild>
                    <Link href={planNewHref}>
                      <CalendarPlus className="w-3 h-3" /> New plan
                    </Link>
                  </Button>
                }
              >
                {drawerPlans.length > 0 ? (
                  <div className="space-y-4">
                    {activeMaintenancePlans.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Active</p>
                        <div className="space-y-2">
                          {activeMaintenancePlans.map((plan) => {
                            const uiStatus = planStatusDbToUi(plan.status)
                            return (
                            <Link
                              key={plan.id}
                              href={`/maintenance-plans?open=${plan.id}`}
                              className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{plan.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {eqPlanIntervalLabel(plan)} · Next:{" "}
                                  {plan.next_due_date ? fmtDate(plan.next_due_date.slice(0, 10)) : "—"}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] mt-1",
                                    uiStatus === "Active"
                                      ? "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border border-[color:var(--status-success)]/20"
                                      : "text-muted-foreground border-border",
                                  )}
                                >
                                  {uiStatus}
                                </Badge>
                              </div>
                              <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
                            </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {inactiveMaintenancePlans.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Inactive</p>
                        <div className="space-y-2">
                          {inactiveMaintenancePlans.map((plan) => {
                            const uiStatus = planStatusDbToUi(plan.status)
                            return (
                            <Link
                              key={plan.id}
                              href={`/maintenance-plans?open=${plan.id}`}
                              className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group opacity-90"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{plan.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {eqPlanIntervalLabel(plan)} · Next:{" "}
                                  {plan.next_due_date ? fmtDate(plan.next_due_date.slice(0, 10)) : "—"}
                                </p>
                                <Badge variant="secondary" className="text-[10px] mt-1 text-muted-foreground border-border">
                                  {uiStatus}
                                </Badge>
                              </div>
                              <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
                            </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">No maintenance plans linked to this equipment.</p>
                    <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs cursor-pointer" asChild>
                      <Link href={planNewHref}>
                        <CalendarPlus className="w-3.5 h-3.5" /> Create maintenance plan
                      </Link>
                    </Button>
                  </div>
                )}
              </DrawerSection>

              <DrawerSection title={`Plan work order history (${planLinkedWOs.length})`}>
                {planWoLoading ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
                ) : planLinkedWOs.length > 0 ? (
                  <div className="space-y-2">
                    {planLinkedWOs.map((wo) => {
                      const planName =
                        (wo.maintenance_plan_id ? planNameById[wo.maintenance_plan_id] : undefined) ??
                        "Maintenance plan"
                      return (
                        <Link
                          key={wo.id}
                          href={`/work-orders?open=${wo.id}`}
                          className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <p className="text-xs font-semibold font-mono text-primary truncate">{formatWorkOrderDisplay(wo.work_order_number, wo.id)}</p>
                            <p className="text-xs text-foreground font-medium truncate">{wo.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {planName} · {woDbTypeLabel(wo.type)} · {fmtDate(wo.scheduled_on ?? wo.created_at.slice(0, 10))}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px]">{woDbStatusLabel(wo.status)}</Badge>
                            <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {drawerPlans.length === 0
                      ? "Create a maintenance plan to generate linked work orders from this asset."
                      : "No work orders from these plans yet."}
                  </p>
                )}
              </DrawerSection>
            </>
          )}

          {/* ── QUOTES (quotes live in app workspace until a Supabase quotes API exists) ── */}
          {activeTab === "quotes" && !editing && (
            <DrawerSection
              title="Quotes"
              action={
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] cursor-pointer" asChild>
                  <Link href={quoteNewHref}>
                    <FileText className="w-3 h-3" /> New quote
                  </Link>
                </Button>
              }
            >
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Quotes are created from the Quotes workspace. Open Quotes with this customer and equipment pre-selected,
                  or start a new quote from quick actions on the overview tab.
                </p>
                <Button size="sm" variant="secondary" className="mt-4 gap-1.5 text-xs" asChild>
                  <Link href={quoteNewHref}>
                    <FileText className="w-3.5 h-3.5" /> New quote for this equipment
                  </Link>
                </Button>
              </div>
            </DrawerSection>
          )}

          {/* ── WARRANTY ── */}
          {activeTab === "warranty" && !editing && (
            <>
              <div className="flex justify-end">
                {!warrantyEditing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                    onClick={startWarrantyEdit}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit warranty
                  </Button>
                ) : null}
              </div>

              <div
                className={cn(
                  "rounded-xl border p-4 flex items-center gap-4",
                  !warrantyHasDate
                    ? "bg-muted/30 border-border"
                    : warrantyDays < 0
                      ? "bg-destructive/8 border-destructive/25"
                      : warrantyDays <= 30
                        ? "bg-[color:var(--status-warning)]/8 border-[color:var(--status-warning)]/25"
                        : "bg-[color:var(--status-success)]/8 border-[color:var(--status-success)]/25",
                )}
              >
                <Shield
                  className={cn(
                    "w-8 h-8 shrink-0",
                    !warrantyHasDate
                      ? "text-muted-foreground"
                      : warrantyDays < 0
                        ? "text-destructive"
                        : warrantyDays <= 30
                          ? "text-[color:var(--status-warning)]"
                          : "text-[color:var(--status-success)]",
                  )}
                />
                <div>
                  <p className={cn("text-sm font-semibold", warrantyColor)}>{warrantyLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {!warrantyHasDate
                      ? "No warranty information added"
                      : warrantyDays < 0
                        ? "Warranty has expired. Equipment is out of coverage."
                        : `Coverage ends ${fmtDate(eq.warrantyExpiration)}`}
                  </p>
                </div>
              </div>

              <DrawerSection title="Warranty details">
                {warrantyEditing && warrantyDirty ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                    <span className="text-xs font-medium text-amber-900 dark:text-amber-100">Unsaved changes</span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={cancelWarrantyEdit}
                        disabled={warrantySaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={saveWarrantyEdit}
                        disabled={warrantySaving}
                      >
                        {warrantySaving ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {warrantyEditing ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Warranty start date</p>
                      <Input
                        type="date"
                        value={warrantyDraftStartDate}
                        onChange={(e) => setWarrantyDraftStartDate(e.target.value)}
                        className={drawerInputClass}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Warranty expiration date</p>
                      <Input
                        type="date"
                        value={warrantyDraftExpirationDate}
                        onChange={(e) => setWarrantyDraftExpirationDate(e.target.value)}
                        className={drawerInputClass}
                      />
                    </div>
                  </div>
                ) : null}
                <DrawerRow label="Start date" value={eq.warrantyStartDate ? fmtDate(eq.warrantyStartDate) : "—"} />
                <DrawerRow
                  label="Expiration"
                  value={<span className={warrantyColor}>{warrantyHasDate ? fmtDate(eq.warrantyExpiration) : "—"}</span>}
                />
                <DrawerRow
                  label="Status"
                  value={
                    !warrantyHasDate ? "No warranty information added" : warrantyDays < 0 ? "Expired" : warrantyDays <= 30 ? "Warning" : "Active"
                  }
                />
                <DrawerRow label="Install date" value={fmtDate(eq.installDate)} />
                <DrawerRow label="Unit age" value={age > 0 ? `~${age} year${age !== 1 ? "s" : ""}` : "< 1 year"} />
              </DrawerSection>

              {warrantyHasDate && warrantyDays > 0 && warrantyDays <= 30 && (
                <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/8 p-3">
                  <p className="text-xs font-medium text-[color:var(--status-warning)]">
                    Warranty expiring soon — Schedule a pre-warranty inspection to address any issues while still under coverage.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs cursor-pointer h-7" asChild>
                    <Link href={woNewHref}>
                      <ClipboardList className="w-3 h-3" /> New work order
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── NOTES ── */}
          {activeTab === "notes" && !editing && (
            <DrawerSection title="Notes">
              {eq.notes ? (
                <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border whitespace-pre-wrap">{eq.notes}</p>
              ) : (
                <div className="py-8 text-center">
                  <StickyNote className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No notes on record.</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                    <Pencil className="w-3.5 h-3.5" /> Add Note
                  </Button>
                </div>
              )}
            </DrawerSection>
          )}

          {/* Notes when editing */}
          {editing && (
            <DrawerSection title="Notes">
              <Textarea
                value={draft.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Add notes about this equipment..."
                className="min-h-[88px] resize-none px-2 py-2 text-xs md:text-xs bg-white border-border text-foreground"
              />
            </DrawerSection>
          )}

          </div>
        </div>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
