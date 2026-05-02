"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useWorkOrders } from "@/lib/work-order-store"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import type { Equipment } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  Wrench, ClipboardList, FileText, AlertTriangle, Pencil, X, Check,
  ShieldCheck, ExternalLink, CalendarPlus, QrCode, Mail, Upload,
  TrendingUp, AlertOctagon, RefreshCw, Calendar, DollarSign, Image as ImageIcon,
  StickyNote, HardHat, Cpu,
} from "lucide-react"
import { CertificatePanel } from "@/components/certificates/certificate-panel"
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
  { id: "overview",      label: "Overview",      icon: Cpu },
  { id: "service",       label: "Service History",icon: Wrench },
  { id: "workorders",    label: "Open WOs",       icon: ClipboardList },
  { id: "plans",         label: "Maintenance Plans", icon: Calendar },
  { id: "certs",         label: "Certificates",   icon: ShieldCheck },
  { id: "warranty",      label: "Warranty",       icon: HardHat },
  { id: "files",         label: "Files",          icon: FileText },
  { id: "photos",        label: "Photos",         icon: ImageIcon },
  { id: "financial",     label: "Financial",      icon: DollarSign },
  { id: "notes",         label: "Notes",          icon: StickyNote },
] as const

type TabId = (typeof TABS)[number]["id"]

type PlanWoRow = {
  id: string
  title: string
  status: string
  type: string
  scheduled_on: string | null
  maintenance_plan_id: string | null
  created_at: string
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

// ─── Shared edit inputs ───────────────────────────────────────────────────────

function EditInput({ value, onChange, type = "text", placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
    />
  )
}

function EditSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function EditTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
    />
  )
}

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
  name: string
  manufacturer: string | null
  category: string | null
  serial_number: string | null
  status: "active" | "needs_service" | "out_of_service" | "in_repair"
  install_date: string | null
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
  const { workOrders } = useWorkOrders()
  const { plans } = useMaintenancePlans()
  const [eq, setEq] = useState<Equipment | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<DrawerCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Equipment>>({})
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [planLinkedWOs, setPlanLinkedWOs] = useState<PlanWoRow[]>([])
  const [planWoLoading, setPlanWoLoading] = useState(false)

  const eqPlans = useMemo(
    () => (eq ? plans.filter((p) => p.equipmentId === eq.id) : []),
    [plans, eq?.id],
  )
  const eqPlanIdsKey = useMemo(() => eqPlans.map((p) => p.id).sort().join(","), [eqPlans])

  useEffect(() => {
    if (activeTab !== "plans" || !eq || !organizationId) return
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
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, title, status, type, scheduled_on, maintenance_plan_id, created_at")
        .eq("organization_id", organizationId)
        .eq("equipment_id", eq.id)
        .in("maintenance_plan_id", planIds)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(40)

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
  }, [activeTab, eq, organizationId, eqPlanIdsKey])

  const loadDrawerData = useCallback(async () => {
    if (!equipmentId) {
      setEq(null)
      setOrganizationId(null)
      setCustomers([])
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
        setOrganizationId(null)
        setCustomers([])
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()

      const orgId = profile?.default_organization_id ?? null
      setOrganizationId(orgId)
      if (!orgId) {
        setEq(null)
        setCustomers([])
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
          "id, organization_id, customer_id, name, manufacturer, category, serial_number, status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes"
        )
        .eq("id", equipmentId)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .maybeSingle()

      if (error || !row) {
        setEq(null)
        return
      }

      const equipmentRow = row as DbEquipmentRow
      const customerName =
        (customerRows as DrawerCustomer[] | null)?.find((c) => c.id === equipmentRow.customer_id)?.company_name ?? "Unknown Customer"

      setEq({
        id: equipmentRow.id,
        customerId: equipmentRow.customer_id,
        customerName,
        model: equipmentRow.name,
        manufacturer: equipmentRow.manufacturer ?? "",
        category: equipmentRow.category ?? "",
        serialNumber: equipmentRow.serial_number ?? "",
        installDate: equipmentRow.install_date ?? "",
        warrantyExpiration: equipmentRow.warranty_expires_at ?? "",
        lastServiceDate: equipmentRow.last_service_at ?? "",
        nextDueDate: equipmentRow.next_due_at ?? "",
        status: mapDbStatusToUiStatus(equipmentRow.status),
        notes: equipmentRow.notes ?? "",
        location: equipmentRow.location_label ?? "",
        photos: [],
        manuals: [],
        serviceHistory: [],
      })
    } finally {
      setLoading(false)
    }
  }, [equipmentId])

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setActiveTab("overview")
    void loadDrawerData()
  }, [equipmentId, loadDrawerData])

  useEffect(() => {
    if (!equipmentId) {
      setEq(null)
      setOrganizationId(null)
      setCustomers([])
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
      installDate: eq.installDate, warrantyExpiration: eq.warrantyExpiration,
      lastServiceDate: eq.lastServiceDate, nextDueDate: eq.nextDueDate,
      status: eq.status, notes: eq.notes,
    })
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setDraft({}) }

  async function saveEdit() {
    if (!eq || !organizationId) return
    const supabase = createBrowserSupabaseClient()

    const updatePayload = {
      name: (draft.model ?? eq.model).trim(),
      manufacturer: (draft.manufacturer ?? eq.manufacturer).trim() || null,
      category: (draft.category ?? eq.category).trim() || null,
      serial_number: (draft.serialNumber ?? eq.serialNumber).trim() || null,
      status: mapUiStatusToDbStatus((draft.status ?? eq.status) as Equipment["status"]),
      install_date: (draft.installDate ?? eq.installDate) || null,
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
      .eq("organization_id", organizationId)

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
    if (!eq || !organizationId) return
    if (!window.confirm("Archive this equipment?")) return
    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase
      .from("equipment")
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq("id", eq.id)
      .eq("organization_id", organizationId)

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

  // Derived values
  const days         = daysToDue(eq.nextDueDate)
  const daysLabel    = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`
  const daysColor    = days < 0 ? "text-destructive" : days <= 7 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
  const warrantyDays = daysToDue(eq.warrantyExpiration)
  const warrantyLabel= warrantyDays < 0 ? "Expired" : warrantyDays <= 90 ? `Expires in ${warrantyDays}d` : fmtDate(eq.warrantyExpiration)
  const warrantyColor= warrantyDays < 0 ? "text-destructive" : warrantyDays <= 90 ? "text-[color:var(--status-warning)]" : "text-foreground"
  const currentStatus= (draft.status ?? eq.status) as Equipment["status"]
  const age          = ageYears(eq.installDate)

  // Related records
  const openWOs = workOrders.filter(
    (wo) => wo.equipmentId === eq.id && !["Completed", "Invoiced"].includes(wo.status)
  )
  const activeMaintenancePlans = eqPlans.filter((p) => p.status === "Active")
  const inactiveMaintenancePlans = eqPlans.filter((p) => p.status !== "Active")
  const totalRepairCost = eq.serviceHistory.filter(h => h.type === "Repair").reduce((s, h) => s + h.cost, 0)
  const totalServiceCost= eq.serviceHistory.reduce((s, h) => s + h.cost, 0)

  // Timeline items for service history tab
  const timelineItems = eq.serviceHistory.map((h) => ({
    date: h.date,
    label: `${h.type} — ${h.workOrderId}`,
    href: `/work-orders?open=${h.workOrderId}`,
    description: h.description + (h.technician ? ` · ${h.technician}` : "") + ` · ${fmtCurrency(h.cost)}`,
    accent: (h.status === "Completed" ? "success" : "muted") as "success" | "muted",
  }))

  return (
    <>
      <DetailDrawer
        open={!!equipmentId}
        onClose={onClose}
        title={eq.model}
        subtitle={`${eq.id} · ${eq.manufacturer} · ${eq.category}`}
        width="xl"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_COLORS[currentStatus])}>
            {currentStatus}
          </Badge>
        }
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
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order created")}>
                <ClipboardList className="w-3.5 h-3.5" /> Create WO
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Scheduling opened")}>
                <CalendarPlus className="w-3.5 h-3.5" /> Schedule Service
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("QR label generated")}>
                <QrCode className="w-3.5 h-3.5" /> QR Label
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Email composed")}>
                <Mail className="w-3.5 h-3.5" /> Email Customer
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
        {/* Service urgency banner */}
        {days <= 7 && !editing && (
          <div className={cn(
            "mx-5 mt-4 flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium",
            days < 0
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]"
          )}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Service {days < 0 ? "overdue" : `due in ${days} day${days !== 1 ? "s" : ""}`} — {fmtDate(eq.nextDueDate)}</span>
          </div>
        )}

        {/* Tab bar */}
        {!editing && (
          <div className="sticky top-0 z-10 bg-background border-b border-border px-5 pt-4">
            <div className="flex gap-0 overflow-x-auto scrollbar-none">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {/* Badge for open WOs and plans */}
                    {tab.id === "workorders" && openWOs.length > 0 && (
                      <span className="ml-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                        {openWOs.length}
                      </span>
                    )}
                    {tab.id === "plans" && eqPlans.length > 0 && (
                      <span className="ml-0.5 bg-muted text-muted-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                        {eqPlans.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab content */}
        <div className="px-5 py-5 space-y-5">

          {/* ── OVERVIEW ── */}
          {(activeTab === "overview" || editing) && (
            <>
              {/* AI Recommendations — shown only when not editing */}
              {!editing && (
                <AIRecommendationPanel
                  title="AI Insights"
                  recommendations={buildAIRecommendations(eq)}
                  initialLimit={3}
                />
              )}

              {/* Equipment Details */}
              <DrawerSection title="Equipment Details">
                <EditableRow label="Model" value={eq.model} editing={editing}>
                  <EditInput value={draft.model ?? ""} onChange={(v) => setField("model", v)} />
                </EditableRow>
                <EditableRow label="Manufacturer" value={eq.manufacturer} editing={editing}>
                  <EditInput value={draft.manufacturer ?? ""} onChange={(v) => setField("manufacturer", v)} />
                </EditableRow>
                <EditableRow label="Category" value={eq.category} editing={editing}>
                  <EditInput value={draft.category ?? ""} onChange={(v) => setField("category", v)} />
                </EditableRow>
                <EditableRow label="Serial Number" value={eq.serialNumber || "—"} editing={editing}>
                  <EditInput value={draft.serialNumber ?? ""} onChange={(v) => setField("serialNumber", v)} />
                </EditableRow>
                <EditableRow label="Customer" value={
                  <Link href={`/customers?open=${eq.customerId}`} className="text-primary hover:underline font-medium">
                    {eq.customerName}
                  </Link>
                } editing={editing}>
                  <div className="w-full rounded border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                    {customers.find((c) => c.id === eq.customerId)?.company_name ?? eq.customerName}
                  </div>
                </EditableRow>
                <EditableRow label="Location" value={eq.location || "—"} editing={editing}>
                  <EditInput value={draft.location ?? ""} onChange={(v) => setField("location", v)} />
                </EditableRow>
                <EditableRow label="Assigned Tech" value={eq.assignedTechnician || "—"} editing={editing}>
                  <EditInput value={draft.assignedTechnician ?? ""} onChange={(v) => setField("assignedTechnician", v)} />
                </EditableRow>
                <EditableRow label="Status" value={
                  <Badge variant="secondary" className={cn("text-[10px] border", STATUS_COLORS[eq.status])}>{eq.status}</Badge>
                } editing={editing}>
                  <EditSelect value={draft.status ?? eq.status} onChange={(v) => setField("status", v as Equipment["status"])} options={STATUSES} />
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
                  <EditInput type="date" value={draft.installDate ?? ""} onChange={(v) => setField("installDate", v)} />
                </EditableRow>
                <EditableRow label="Last Service" value={fmtDate(eq.lastServiceDate)} editing={editing}>
                  <EditInput type="date" value={draft.lastServiceDate ?? ""} onChange={(v) => setField("lastServiceDate", v)} />
                </EditableRow>
                <EditableRow label="Next Due" value={
                  <span className={cn("font-semibold", daysColor)}>{fmtDate(eq.nextDueDate)} · {daysLabel}</span>
                } editing={editing}>
                  <EditInput type="date" value={draft.nextDueDate ?? ""} onChange={(v) => setField("nextDueDate", v)} />
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
                  { label: "Total Events", value: eq.serviceHistory.length },
                  { label: "Repairs", value: eq.serviceHistory.filter(h => h.type === "Repair").length },
                  { label: "Total Cost", value: fmtCurrency(totalServiceCost) },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <DrawerSection title={`Service History (${eq.serviceHistory.length})`}>
                {timelineItems.length > 0 ? (
                  <DrawerTimeline items={timelineItems} />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No service history on record.</p>
                )}
              </DrawerSection>
            </>
          )}

          {/* ── OPEN WORK ORDERS ── */}
          {activeTab === "workorders" && !editing && (
            <DrawerSection title={`Open Work Orders (${openWOs.length})`}>
              {openWOs.length > 0 ? (
                <div className="space-y-2">
                  {openWOs.map((wo) => (
                    <Link
                      key={wo.id}
                      href={`/work-orders?open=${wo.id}`}
                      className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-semibold font-mono text-primary">{wo.id}</p>
                        <p className="text-xs text-foreground font-medium">{wo.type} — {wo.description.slice(0, 60)}{wo.description.length > 60 ? "…" : ""}</p>
                        <p className="text-[10px] text-muted-foreground">{wo.technicianName} · {fmtDate(wo.scheduledDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">{wo.status}</Badge>
                        <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-xs text-muted-foreground">No open work orders for this equipment.</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order created")}>
                    <ClipboardList className="w-3.5 h-3.5" /> Create Work Order
                  </Button>
                </div>
              )}
            </DrawerSection>
          )}

          {/* ── MAINTENANCE PLANS ── */}
          {activeTab === "plans" && !editing && (
            <>
              <DrawerSection
                title={`Maintenance Plans (${eqPlans.length})`}
                action={
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] cursor-pointer" asChild>
                    <Link
                      href={`/maintenance-plans?new=1&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`}
                    >
                      <CalendarPlus className="w-3 h-3" /> New plan
                    </Link>
                  </Button>
                }
              >
                {eqPlans.length > 0 ? (
                  <div className="space-y-4">
                    {activeMaintenancePlans.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Active</p>
                        <div className="space-y-2">
                          {activeMaintenancePlans.map((plan) => (
                            <Link
                              key={plan.id}
                              href={`/maintenance-plans?open=${plan.id}`}
                              className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{plan.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {plan.interval} · Next: {fmtDate(plan.nextDueDate)}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] mt-1",
                                    "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border border-[color:var(--status-success)]/20",
                                  )}
                                >
                                  {plan.status}
                                </Badge>
                              </div>
                              <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {inactiveMaintenancePlans.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Inactive</p>
                        <div className="space-y-2">
                          {inactiveMaintenancePlans.map((plan) => (
                            <Link
                              key={plan.id}
                              href={`/maintenance-plans?open=${plan.id}`}
                              className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group opacity-90"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{plan.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {plan.interval} · Next: {fmtDate(plan.nextDueDate)}
                                </p>
                                <Badge variant="secondary" className="text-[10px] mt-1 text-muted-foreground border-border">
                                  {plan.status}
                                </Badge>
                              </div>
                              <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">No maintenance plans linked to this equipment.</p>
                    <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs cursor-pointer" asChild>
                      <Link
                        href={`/maintenance-plans?new=1&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`}
                      >
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
                        eqPlans.find((p) => p.id === wo.maintenance_plan_id)?.name ?? "Maintenance plan"
                      return (
                        <Link
                          key={wo.id}
                          href={`/work-orders?open=${wo.id}`}
                          className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <p className="text-xs font-semibold font-mono text-primary truncate">{wo.id}</p>
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
                    {eqPlans.length === 0
                      ? "Create a maintenance plan to generate linked work orders from this asset."
                      : "No work orders from these plans yet."}
                  </p>
                )}
              </DrawerSection>
            </>
          )}

          {/* ── CERTIFICATES ── */}
          {activeTab === "certs" && !editing && (
            <DrawerSection title="Calibration Certificates"
              action={
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] cursor-pointer" onClick={() => toast("Upload dialog opened")}>
                  <Upload className="w-3 h-3" /> Upload
                </Button>
              }
            >
              <CertificatePanel
                equipmentId={eq.id}
                equipmentName={eq.model}
                customerId={eq.customerId}
                customerName={eq.customerName}
              />
            </DrawerSection>
          )}

          {/* ── WARRANTY ── */}
          {activeTab === "warranty" && !editing && (
            <>
              {/* Warranty status card */}
              <div className={cn(
                "rounded-xl border p-4 flex items-center gap-4",
                warrantyDays < 0
                  ? "bg-destructive/8 border-destructive/25"
                  : warrantyDays <= 90
                  ? "bg-[color:var(--status-warning)]/8 border-[color:var(--status-warning)]/25"
                  : "bg-[color:var(--status-success)]/8 border-[color:var(--status-success)]/25"
              )}>
                <HardHat className={cn("w-8 h-8 shrink-0",
                  warrantyDays < 0 ? "text-destructive" : warrantyDays <= 90 ? "text-[color:var(--status-warning)]" : "text-[color:var(--status-success)]"
                )} />
                <div>
                  <p className={cn("text-sm font-semibold", warrantyColor)}>{warrantyLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {warrantyDays < 0 ? "Warranty has expired. Equipment is out of coverage." : `Coverage ends ${fmtDate(eq.warrantyExpiration)}`}
                  </p>
                </div>
              </div>

              <DrawerSection title="Warranty Details">
                <DrawerRow label="Expiration" value={<span className={warrantyColor}>{fmtDate(eq.warrantyExpiration)}</span>} />
                <DrawerRow label="Status" value={warrantyDays < 0 ? "Expired" : warrantyDays <= 90 ? "Expiring Soon" : "Active"} />
                <DrawerRow label="Install Date" value={fmtDate(eq.installDate)} />
                <DrawerRow label="Unit Age" value={age > 0 ? `~${age} year${age !== 1 ? "s" : ""}` : "< 1 year"} />
              </DrawerSection>

              {warrantyDays > 0 && warrantyDays <= 90 && (
                <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/8 p-3">
                  <p className="text-xs font-medium text-[color:var(--status-warning)]">
                    Warranty expiring soon — Schedule a pre-warranty inspection to address any issues while still under coverage.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs cursor-pointer h-7" onClick={() => toast("Work order created")}>
                    <ClipboardList className="w-3 h-3" /> Create WO
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── FILES / MANUALS ── */}
          {activeTab === "files" && !editing && (
            <DrawerSection
              title={`Files & Manuals (${eq.manuals.length})`}
              action={
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] cursor-pointer" onClick={() => toast("Upload dialog opened")}>
                  <Upload className="w-3 h-3" /> Upload
                </Button>
              }
            >
              {eq.manuals.length > 0 ? (
                <div className="space-y-1.5">
                  {eq.manuals.map((m, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors cursor-pointer group">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs text-foreground flex-1">{m}</span>
                      <ExternalLink size={11} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-xs text-muted-foreground">No manuals or documents uploaded yet.</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs cursor-pointer" onClick={() => toast("Upload dialog opened")}>
                    <Upload className="w-3.5 h-3.5" /> Upload File
                  </Button>
                </div>
              )}
            </DrawerSection>
          )}

          {/* ── PHOTOS ── */}
          {activeTab === "photos" && !editing && (
            <DrawerSection
              title={`Photos (${eq.photos.length})`}
              action={
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] cursor-pointer" onClick={() => toast("Upload dialog opened")}>
                  <Upload className="w-3 h-3" /> Upload
                </Button>
              }
            >
              {eq.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {eq.photos.map((p, i) => (
                    <div key={i} className="aspect-video rounded-lg bg-muted border border-border flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center border-2 border-dashed border-border rounded-xl">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No photos uploaded yet.</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs cursor-pointer" onClick={() => toast("Upload dialog opened")}>
                    <Upload className="w-3.5 h-3.5" /> Upload Photos
                  </Button>
                </div>
              )}
            </DrawerSection>
          )}

          {/* ── FINANCIAL ── */}
          {activeTab === "financial" && !editing && (
            <>
              {/* Key financial metrics */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Replacement Value",
                    value: eq.replacementCost ? fmtCurrency(eq.replacementCost) : "Not set",
                    icon: TrendingUp,
                    color: "text-[color:var(--status-info)]",
                  },
                  {
                    label: "Total Repair Cost",
                    value: fmtCurrency(totalRepairCost),
                    icon: AlertOctagon,
                    color: totalRepairCost > 0 ? "text-[color:var(--status-warning)]" : "text-muted-foreground",
                  },
                  {
                    label: "Total Service Cost",
                    value: fmtCurrency(totalServiceCost),
                    icon: DollarSign,
                    color: "text-foreground",
                  },
                  {
                    label: "Repair-to-Value Ratio",
                    value: eq.replacementCost ? `${Math.round((totalRepairCost / eq.replacementCost) * 100)}%` : "—",
                    icon: RefreshCw,
                    color: eq.replacementCost && totalRepairCost / eq.replacementCost > 0.4 ? "text-destructive" : "text-foreground",
                  },
                ].map((m) => {
                  const Icon = m.icon
                  return (
                    <div key={m.label} className="bg-muted/30 border border-border rounded-lg p-3 flex items-start gap-3">
                      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", m.color)} />
                      <div>
                        <p className={cn("text-sm font-bold", m.color)}>{m.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Per-service cost breakdown */}
              <DrawerSection title="Service Cost Breakdown">
                {eq.serviceHistory.length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Date</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Type</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {eq.serviceHistory.map((h) => (
                          <tr key={h.id} className="bg-card">
                            <td className="px-3 py-2 text-muted-foreground">{fmtDate(h.date)}</td>
                            <td className="px-3 py-2">
                              <Badge variant="secondary" className="text-[10px]">{h.type}</Badge>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(h.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 border-t border-border">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right font-semibold text-foreground text-[11px] uppercase tracking-wide">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-foreground">{fmtCurrency(totalServiceCost)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No service cost data available.</p>
                )}
              </DrawerSection>
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
              <EditTextarea
                value={draft.notes ?? ""}
                onChange={(v) => setField("notes", v)}
                placeholder="Add notes about this equipment..."
              />
            </DrawerSection>
          )}

        </div>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
