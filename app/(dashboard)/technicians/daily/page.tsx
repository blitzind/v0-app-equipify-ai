"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType, RepairLog } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import {
  ChevronLeft, MapPin, Clock, Wrench,
  CheckCircle2, Circle, PlayCircle, Package,
  Phone, Mail, CalendarDays, ArrowRight, Loader2,
} from "lucide-react"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// ─── Same roster roles as main technicians list (no shared module per scope) ─

const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })
}

function fmtShortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  })
}

function addDays(base: Date, n: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function mapDbStatus(status: string): WorkOrderStatus {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function mapDbPriority(priority: string): WorkOrderPriority {
  switch (priority) {
    case "low":
      return "Low"
    case "normal":
      return "Normal"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return "Normal"
  }
}

function mapDbType(type: string): WorkOrderType {
  switch (type) {
    case "repair":
      return "Repair"
    case "pm":
      return "PM"
    case "inspection":
      return "Inspection"
    case "install":
      return "Install"
    case "emergency":
      return "Emergency"
    default:
      return "Repair"
  }
}

function uiStatusToDb(status: WorkOrderStatus): string {
  switch (status) {
    case "Open":
      return "open"
    case "Scheduled":
      return "scheduled"
    case "In Progress":
      return "in_progress"
    case "Completed":
      return "completed"
    case "Invoiced":
      return "invoiced"
    default:
      return "open"
  }
}

function formatScheduledTime(isoOrTime: string | null): string {
  if (!isoOrTime) return ""
  const t = isoOrTime.trim()
  if (t.length >= 5 && t.includes(":")) return t.slice(0, 5)
  return t
}

const emptyRepairLog = (): RepairLog => ({
  problemReported: "",
  diagnosis: "",
  partsUsed: [],
  laborHours: 0,
  technicianNotes: "",
  photos: [],
  signatureDataUrl: "",
  signedBy: "",
  signedAt: "",
})

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkOrderStatus, { icon: React.ReactNode; color: string; label: string }> = {
  "Open":        { icon: <Circle className="w-4 h-4" />,         color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/30",         label: "Open" },
  "Scheduled":   { icon: <CalendarDays className="w-4 h-4" />,   color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/25",         label: "Scheduled" },
  "In Progress": { icon: <PlayCircle className="w-4 h-4" />,     color: "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30", label: "In Progress" },
  "Completed":   { icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border-[color:var(--status-success)]/30", label: "Completed" },
  "Invoiced":    { icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-muted-foreground bg-muted border-border",                                                                     label: "Invoiced" },
}

const PRIORITY_DOT: Record<string, string> = {
  "High":     "bg-destructive",
  "Normal":   "bg-[color:var(--status-warning)]",
  "Low":      "bg-[color:var(--status-success)]",
  "Critical": "bg-destructive animate-pulse",
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  wo,
  idx,
  onStatusChange,
  updating,
  onOpenWorkOrder,
}: {
  wo: WorkOrder
  idx: number
  onStatusChange: (id: string, status: WorkOrderStatus) => void
  updating: boolean
  onOpenWorkOrder: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sc = STATUS_CONFIG[wo.status]

  const nextStatus: WorkOrderStatus | null =
    wo.status === "Scheduled"   ? "In Progress" :
    wo.status === "In Progress" ? "Completed"   : null

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card overflow-hidden transition-shadow cursor-pointer",
        wo.status === "In Progress" && "ring-2 ring-primary/30 shadow-md",
        wo.status === "Completed" && "opacity-70",
      )}
      role="button"
      tabIndex={0}
      onClick={() => onOpenWorkOrder(wo.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenWorkOrder(wo.id)
        }
      }}
    >
      <div className={cn("h-1 w-full", PRIORITY_DOT[wo.priority] ?? "bg-border")} />

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
              {idx + 1}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug truncate">{wo.equipmentName}</p>
              <p className="text-xs text-muted-foreground truncate">{wo.customerName}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px] shrink-0 border", sc.color)}>
            <span className="mr-1">{sc.icon}</span>
            {sc.label}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5">
          {wo.location && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span className="leading-snug">{wo.location}</span>
            </div>
          )}
          {(wo.scheduledTime || wo.type) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
              {wo.scheduledTime && <span>{wo.scheduledTime}</span>}
              {wo.type && <span className="text-muted-foreground/60">· {wo.type}</span>}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="font-mono text-[10px] text-primary">{getWorkOrderDisplay(wo)}</span>
            <span className="text-muted-foreground/60">· {wo.priority} priority</span>
          </div>
        </div>

        {wo.location && (
          <div className="w-full" onClick={(e) => e.stopPropagation()}>
            <AppointmentActions
              address={wo.location}
              emailParams={{
                customerName:   wo.customerName,
                equipmentName:  wo.equipmentName,
                technicianName: wo.technicianName,
                scheduledDate:  wo.scheduledDate,
                scheduledTime:  wo.scheduledTime,
                address:        wo.location,
                workOrderId:    wo.id,
                ccEmails:       ["service@equipify.ai"],
              }}
            />
          </div>
        )}

        {wo.description && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {expanded ? wo.description : `${wo.description.slice(0, 80)}${wo.description.length > 80 ? "..." : ""}`}
            {wo.description.length > 80 && (
              <span className="ml-1 text-primary font-medium">{expanded ? "Less" : "More"}</span>
            )}
          </button>
        )}

        <div
          className="flex items-center gap-2 pt-1 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {nextStatus && (
            <Button
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9 cursor-pointer"
              disabled={updating}
              onClick={() => onStatusChange(wo.id, nextStatus)}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {nextStatus === "In Progress" ? "Start Job" : "Mark Complete"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium shrink-0 shadow-sm"
            onClick={() => onOpenWorkOrder(wo.id)}
          >
            <Wrench className="w-3.5 h-3.5" />
            View WO
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Day strip ────────────────────────────────────────────────────────────────

function DayStrip({
  selectedDate,
  onSelect,
}: {
  selectedDate: string
  onSelect: (d: string) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 1)
    return { date: localDateString(d), label: d.toLocaleDateString("en-US", { weekday: "short" }), num: d.getDate() }
  })

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
      {days.map(({ date, label, num }) => {
        const isToday = date === localDateString(today)
        const isSelected = date === selectedDate
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[48px] py-2 rounded-xl transition-colors cursor-pointer",
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                ? "bg-primary/10 text-primary"
                : "bg-muted/30 text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
            <span className={cn("text-lg font-bold leading-tight", isToday && !isSelected && "text-primary")}>
              {num}
            </span>
            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-current mt-0.5 opacity-70" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Technician selector ──────────────────────────────────────────────────────

function TechSelector({
  selectedId,
  onChange,
  technicians,
}: {
  selectedId: string
  onChange: (id: string) => void
  technicians: { id: string; name: string; avatar: string }[]
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
      {technicians.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer shrink-0",
            selectedId === t.id
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card border-border text-foreground hover:bg-muted"
          )}
        >
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
            selectedId === t.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
          )}>
            {t.avatar}
          </div>
          <span className="truncate max-w-[80px]">{t.name.split(" ")[0]}</span>
        </button>
      ))}
    </div>
  )
}

type RosterTech = {
  id: string
  name: string
  avatar: string
  role: string
  email: string
  phone: string
}

type DbWoRow = {
  id: string
  work_order_number?: number | null
  customer_id: string
  equipment_id: string
  title: string
  status: string
  priority: string
  type: string
  scheduled_on: string | null
  scheduled_time: string | null
  notes: string | null
  assigned_user_id: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TechnicianDailySchedulePage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterTech[]>([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [rosterError, setRosterError] = useState<string | null>(null)

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [woLoading, setWoLoading] = useState(false)
  const [woError, setWoError] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
  const [jobsRefresh, setJobsRefresh] = useState(0)

  const [selectedDate, setSelectedDate] = useState(() => localDateString(today))
  const [selectedTechId, setSelectedTechId] = useState("")

  const refreshDayJobs = useCallback(() => {
    setJobsRefresh((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadRoster() {
      setRosterLoading(true)
      setRosterError(null)
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) {
          setOrganizationId(null)
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const { data: userProfile, error: pErr } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()

      if (pErr || !userProfile?.default_organization_id) {
        if (!cancelled) {
          setRosterError(pErr?.message ?? "No default organization.")
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const orgId = userProfile.default_organization_id
      if (!cancelled) setOrganizationId(orgId)

      const { data: members, error: mErr } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", [...ROSTER_MEMBER_ROLES])

      if (mErr || cancelled) {
        if (!cancelled) {
          setRosterError(mErr?.message ?? "Failed to load team.")
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const memberList = (members ?? []) as Array<{ user_id: string; role: string }>
      const userIds = [...new Set(memberList.map((m) => m.user_id))]
      const roleByUser = new Map(memberList.map((m) => [m.user_id, m.role]))

      if (userIds.length === 0) {
        if (!cancelled) {
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const { data: profRows, error: prErr } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)

      if (prErr || cancelled) {
        if (!cancelled) {
          setRosterError(prErr?.message ?? "Failed to load profiles.")
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const list: RosterTech[] = (
        (profRows ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>
      )
        .filter((p) => roleByUser.has(p.id))
        .map((p) => {
          const name =
            (p.full_name && p.full_name.trim()) ||
            (p.email && p.email.trim()) ||
            p.id.slice(0, 8)
          return {
            id: p.id,
            name,
            avatar: initialsFromName(name),
            role: formatMemberRole(roleByUser.get(p.id) ?? "tech"),
            email: p.email ?? "",
            phone: "—",
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      if (!cancelled) {
        setRoster(list)
        setRosterLoading(false)
      }
    }

    void loadRoster()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (roster.length === 0) return
    setSelectedTechId((prev) => {
      if (prev && roster.some((t) => t.id === prev)) return prev
      return roster[0]!.id
    })
  }, [roster])

  const selectedTech = roster.find((t) => t.id === selectedTechId)

  const technicianNameForWo = selectedTech?.name ?? "Technician"

  useEffect(() => {
    if (!organizationId || !selectedTechId || !selectedDate) {
      setWorkOrders([])
      return
    }

    let cancelled = false

    async function loadDayJobs() {
      setWoLoading(true)
      setWoError(null)
      const supabase = createBrowserSupabaseClient()

      const dailyWoSelectWithNum =
        "id, work_order_number, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, notes, assigned_user_id"
      const dailyWoSelect = dailyWoSelectWithNum.replace("work_order_number, ", "")

      let woRes = await supabase
        .from("work_orders")
        .select(dailyWoSelectWithNum)
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .eq("assigned_user_id", selectedTechId)
        .eq("scheduled_on", selectedDate)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(dailyWoSelect)
          .eq("organization_id", organizationId)
          .eq("is_archived", false)
          .eq("assigned_user_id", selectedTechId)
          .eq("scheduled_on", selectedDate)
      }

      const { data: rows, error: woErr } = woRes

      if (woErr || cancelled) {
        if (!cancelled) {
          setWoError(woErr?.message ?? "Failed to load jobs.")
          setWorkOrders([])
          setWoLoading(false)
        }
        return
      }

      const list = (rows ?? []) as DbWoRow[]
      const customerIds = [...new Set(list.map((r) => r.customer_id))]
      const equipmentIds = [...new Set(list.map((r) => r.equipment_id))]

      const customerMap = new Map<string, string>()
      if (customerIds.length > 0) {
        const { data: custRows } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", organizationId)
          .in("id", customerIds)
        ;((custRows as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
          customerMap.set(c.id, c.company_name)
        })
      }

      const equipmentMap = new Map<string, { name: string; location: string }>()
      if (equipmentIds.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipment")
          .select("id, name, location_label")
          .eq("organization_id", organizationId)
          .in("id", equipmentIds)
        ;(
          (eqRows as Array<{ id: string; name: string; location_label: string | null }> | null) ?? []
        ).forEach((e) => {
          equipmentMap.set(e.id, { name: e.name, location: e.location_label ?? "" })
        })
      }

      if (cancelled) return

      const mapped: WorkOrder[] = list.map((row) => {
        const eq = equipmentMap.get(row.equipment_id)
        const scheduledTime = formatScheduledTime(row.scheduled_time)
        const desc = [row.title, row.notes?.trim()].filter(Boolean).join("\n\n") || row.title

        return {
          id: row.id,
          workOrderNumber: row.work_order_number ?? undefined,
          customerId: row.customer_id,
          customerName: customerMap.get(row.customer_id) ?? "Customer",
          equipmentId: row.equipment_id,
          equipmentName: eq?.name ?? "Equipment",
          location: eq?.location ?? "",
          type: mapDbType(row.type),
          status: mapDbStatus(row.status),
          priority: mapDbPriority(row.priority),
          technicianId: row.assigned_user_id ?? selectedTechId,
          technicianName: technicianNameForWo,
          scheduledDate: row.scheduled_on ?? selectedDate,
          scheduledTime,
          completedDate: "",
          createdAt: "",
          createdBy: "",
          description: desc,
          repairLog: emptyRepairLog(),
          totalLaborCost: 0,
          totalPartsCost: 0,
          invoiceNumber: "",
        }
      })

      mapped.sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""))

      setWorkOrders(mapped)
      setWoLoading(false)
    }

    void loadDayJobs()
    return () => {
      cancelled = true
    }
  }, [organizationId, selectedTechId, selectedDate, technicianNameForWo, jobsRefresh])

  const dayJobs = workOrders

  const completedCount = dayJobs.filter((j) => j.status === "Completed" || j.status === "Invoiced").length
  const activeJob = dayJobs.find((j) => j.status === "In Progress")

  const techsForSelector = roster.map((t) => ({
    id: t.id,
    name: t.name,
    avatar: t.avatar,
  }))

  const handleStatusChange = useCallback(
    async (id: string, next: WorkOrderStatus) => {
      if (!organizationId) return
      setStatusUpdatingId(id)
      setWoError(null)
      const supabase = createBrowserSupabaseClient()
      const dbStatus = uiStatusToDb(next)

      const patch: Record<string, unknown> = { status: dbStatus }
      if (next === "Completed") {
        patch.completed_at = new Date().toISOString()
      } else if (next === "In Progress") {
        patch.completed_at = null
      }

      const { error } = await supabase
        .from("work_orders")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organizationId)

      setStatusUpdatingId(null)

      if (error) {
        setWoError(error.message)
        return
      }

      setWorkOrders((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                status: next,
                completedDate: next === "Completed" ? new Date().toISOString().slice(0, 10) : w.completedDate,
              }
            : w
        )
      )
    },
    [organizationId]
  )

  const todayStr = localDateString(today)

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            href="/technicians"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Technicians
          </Link>
          <span className="text-muted-foreground/40 text-sm">/</span>
          <span className="text-sm font-semibold text-foreground">Daily Dispatch</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Jobs for one technician on one selected day. Choose the technician and the date below.
        </p>
      </div>

      {rosterError && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {rosterError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Technician</p>
        {rosterLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading team…
          </div>
        ) : techsForSelector.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members in your organization.</p>
        ) : (
          <TechSelector
            selectedId={selectedTechId}
            onChange={setSelectedTechId}
            technicians={techsForSelector}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</p>
        <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {selectedTech && !rosterLoading && (
        <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shrink-0">
            {selectedTech.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">{selectedTech.name}</p>
            <p className="text-xs text-muted-foreground">{selectedTech.role}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {selectedTech.phone && selectedTech.phone !== "—" ? (
                <a
                  href={`tel:${selectedTech.phone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Phone className="w-3 h-3" /> {selectedTech.phone}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> —
                </span>
              )}
              {selectedTech.email ? (
                <a
                  href={`mailto:${selectedTech.email}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[200px]"
                >
                  <Mail className="w-3 h-3 shrink-0" /> {selectedTech.email}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span className="text-2xl font-bold text-foreground">{completedCount}</span>
            <span className="text-[10px] text-muted-foreground">of {dayJobs.length}</span>
            <span className="text-[10px] text-muted-foreground">done</span>
          </div>
        </div>
      )}

      {activeJob && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <PlayCircle className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">Currently In Progress</p>
            <p className="text-xs text-muted-foreground truncate">{activeJob.equipmentName} · {activeJob.customerName}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWorkOrderId(activeJob.id)}
            className="text-xs font-medium text-primary hover:underline shrink-0 cursor-pointer bg-transparent border-0 p-0"
          >
            View
          </button>
        </div>
      )}

      {woError && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {woError}
        </p>
      )}

      {dayJobs.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">{fmtDate(selectedDate)}</h2>
          <span className="text-xs text-muted-foreground">{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {woLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm">Loading jobs…</p>
        </div>
      )}

      {!woLoading && dayJobs.length === 0 && !rosterLoading && selectedTechId && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border bg-muted/20">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No jobs for this dispatch</p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedTech
              ? selectedDate === todayStr
                ? `No assignments for ${selectedTech.name} today.`
                : `No assignments for ${selectedTech.name} on ${fmtShortDate(selectedDate)}.`
              : selectedDate === todayStr
                ? "No assignments for the selected technician today."
                : "No assignments for the selected technician on that day."}
          </p>
        </div>
      )}

      {!woLoading && dayJobs.length > 0 && (
        <div className="flex flex-col gap-4">
          {dayJobs.map((wo, idx) => (
            <JobCard
              key={wo.id}
              wo={wo}
              idx={idx}
              updating={statusUpdatingId === wo.id}
              onStatusChange={handleStatusChange}
              onOpenWorkOrder={setSelectedWorkOrderId}
            />
          ))}
        </div>
      )}

      <WorkOrderDrawer
        workOrderId={selectedWorkOrderId}
        onClose={() => setSelectedWorkOrderId(null)}
        onUpdated={refreshDayJobs}
      />
    </div>
  )
}
