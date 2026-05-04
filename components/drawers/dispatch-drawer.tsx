"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  RepairLog,
  Technician,
  TechSkill,
} from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { DetailDrawer } from "@/components/detail-drawer"
import {
  MapPin, Clock, Wrench,
  CheckCircle2, Circle, PlayCircle, Package,
  Phone, Mail, CalendarDays, ArrowRight, Loader2,
  Plus, Route, Timer, CalendarOff, PenLine,
} from "lucide-react"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScheduleJobModal } from "@/components/technicians/schedule-job-modal"
import { UnassignedJobsQueue, type UnassignedQueueRow } from "@/components/dispatch/unassigned-jobs-queue"
import {
  estimatedHoursForWoType,
  normalizeRosterSkills,
  suggestTechnicians,
  parseDragQueuedWo,
  dropTechId,
  dropDayYmd,
  type SuggestTech,
} from "@/lib/dispatch/suggest-assignee"
import { buildSchedulePatch } from "@/lib/work-orders/schedule-patch"
import {
  DISPATCH_SLOT_COUNT,
  slotIndexToTimeHhMm,
  timeToSlotIndex,
} from "@/lib/dispatch/board-utils"
import {
  queryOrganizationMembersForRoster,
  queryProfilesForRoster,
} from "@/lib/technicians/roster-queries"

const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

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

const STATUS_CONFIG: Record<WorkOrderStatus, { icon: React.ReactNode; color: string; label: string }> = {
  "Open":        { icon: <Circle className="w-4 h-4" />,         color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/30",         label: "Open" },
  "Scheduled":   { icon: <CalendarDays className="w-4 h-4" />,   color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/25",         label: "Scheduled" },
  "In Progress": { icon: <PlayCircle className="w-4 h-4" />,     color: "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30", label: "In Progress" },
  "Completed":   { icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border-[color:var(--status-success)]/30", label: "Completed" },
  "Completed Pending Signature": {
    icon: <PenLine className="w-4 h-4" />,
    color: "text-amber-800 bg-amber-500/10 border-amber-500/30",
    label: "Completed Pending Signature",
  },
  "Invoiced":    { icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-muted-foreground bg-muted border-border",                                                                     label: "Invoiced" },
}

const PRIORITY_DOT: Record<string, string> = {
  "High":     "bg-destructive",
  "Normal":   "bg-[color:var(--status-warning)]",
  "Low":      "bg-[color:var(--status-success)]",
  "Critical": "bg-destructive animate-pulse",
}

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
                workOrderNumber: wo.workOrderNumber ?? null,
                workOrderTitle: wo.description,
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

function DroppableDayButton({
  date,
  label,
  num,
  isToday,
  isSelected,
  onSelect,
}: {
  date: string
  label: string
  num: number
  isToday: boolean
  isSelected: boolean
  onSelect: (d: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-day@@${date}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        "flex flex-col items-center justify-center min-w-[48px] py-2 rounded-xl transition-colors cursor-pointer",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isToday
            ? "bg-primary/10 text-primary"
            : "bg-muted/30 text-muted-foreground hover:bg-muted",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      <span className={cn("text-lg font-bold leading-tight", isToday && !isSelected && "text-primary")}>
        {num}
      </span>
      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-current mt-0.5 opacity-70" />}
    </button>
  )
}

function DroppableDayStrip({
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
          <DroppableDayButton
            key={date}
            date={date}
            label={label}
            num={num}
            isToday={isToday}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

function DroppableTechPill({
  t,
  selected,
  onSelect,
}: {
  t: { id: string; name: string; avatar: string; avatarUrl?: string | null }
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-tech@@${t.id}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(t.id)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer shrink-0",
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border text-foreground hover:bg-muted",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <TechnicianAvatar
        userId={t.id}
        name={t.name}
        initials={t.avatar}
        avatarUrl={t.avatarUrl}
        size="xs"
      />
      <span className="truncate max-w-[80px]">{t.name.split(" ")[0]}</span>
    </button>
  )
}

function DroppableTechSelector({
  selectedId,
  onChange,
  technicians,
}: {
  selectedId: string
  onChange: (id: string) => void
  technicians: { id: string; name: string; avatar: string; avatarUrl?: string | null }[]
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
      {technicians.map((t) => (
        <DroppableTechPill key={t.id} t={t} selected={selectedId === t.id} onSelect={onChange} />
      ))}
    </div>
  )
}

type RosterTech = {
  id: string
  name: string
  avatar: string
  avatarUrl?: string | null
  role: string
  email: string
  phone: string
  /** `organization_members.region` when available. */
  homeRegion: string | null
  skills: TechSkill[]
}

function rosterToScheduleTechnician(t: RosterTech): Technician {
  return {
    id: t.id,
    name: t.name,
    avatar: t.avatar,
    avatarUrl: t.avatarUrl,
    role: t.role,
    region: t.homeRegion ?? "—",
    email: t.email,
    phone: t.phone,
    hireDate: "",
    status: "Available",
    skills: t.skills,
    jobsThisWeek: 0,
    completionPct: 0,
    rating: 0,
    utilizationPct: 0,
    totalCompleted: 0,
    avgJobDurationHrs: 0,
    certifications: [],
    schedule: [],
    history: [],
    bio: "",
  }
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

function DailyDispatchInner({ initialTechnicianId }: { initialTechnicianId?: string | null }) {
  const router = useRouter()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { organizationId: resolvedOrgId, status: orgStatus } = useActiveOrganization()
  const organizationId = orgStatus === "ready" ? resolvedOrgId : null
  const [roster, setRoster] = useState<RosterTech[]>([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [rosterError, setRosterError] = useState<string | null>(null)

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [woLoading, setWoLoading] = useState(false)
  const [woError, setWoError] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
  const [jobsRefresh, setJobsRefresh] = useState(0)
  const [scheduleJobOpen, setScheduleJobOpen] = useState(false)
  const [blockTimeOpen, setBlockTimeOpen] = useState(false)
  const [unassignedQueue, setUnassignedQueue] = useState<UnassignedQueueRow[]>([])
  const [unassignedRaw, setUnassignedRaw] = useState<
    { id: string; typeDb: string; siteText: string }[]
  >([])
  const [unassignedLoading, setUnassignedLoading] = useState(false)
  const [unassignedRefresh, setUnassignedRefresh] = useState(0)
  const [workloadTodayByTech, setWorkloadTodayByTech] = useState<Record<string, number>>({})
  const [assignExistingWoId, setAssignExistingWoId] = useState<string | null>(null)
  const [activeDragUnassignedId, setActiveDragUnassignedId] = useState<string | null>(null)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const [selectedDate, setSelectedDate] = useState(() => localDateString(today))
  const [selectedTechId, setSelectedTechId] = useState("")

  const refreshDayJobs = useCallback(() => {
    setJobsRefresh((n) => n + 1)
  }, [])

  const dayStripDates = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => localDateString(addDays(t, i - 1)))
  }, [])

  const [workloadByDate, setWorkloadByDate] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!organizationId || !selectedTechId) {
      setWorkloadByDate({})
      return
    }

    let cancelled = false

    async function loadWorkload() {
      const supabase = createBrowserSupabaseClient()
      const start = dayStripDates[0]!
      const end = dayStripDates[dayStripDates.length - 1]!
      const { data, error } = await supabase
        .from("work_orders")
        .select("scheduled_on")
        .eq("organization_id", organizationId)
        .eq("assigned_user_id", selectedTechId)
        .eq("is_archived", false)
        .not("scheduled_on", "is", null)
        .gte("scheduled_on", start)
        .lte("scheduled_on", end)

      if (cancelled) return
      if (error) {
        setWorkloadByDate({})
        return
      }

      const counts: Record<string, number> = {}
      for (const d of dayStripDates) counts[d] = 0
      for (const row of data ?? []) {
        const d = row.scheduled_on?.slice(0, 10)
        if (d && d in counts) counts[d]++
      }
      setWorkloadByDate(counts)
    }

    void loadWorkload()
    return () => {
      cancelled = true
    }
  }, [organizationId, selectedTechId, dayStripDates, jobsRefresh])

  useEffect(() => {
    if (!organizationId) {
      setWorkloadTodayByTech({})
      return
    }
    let cancelled = false
    async function run() {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("work_orders")
        .select("assigned_user_id")
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .eq("scheduled_on", selectedDate)
        .not("assigned_user_id", "is", null)
      if (cancelled || error) {
        if (!cancelled) setWorkloadTodayByTech({})
        return
      }
      const m: Record<string, number> = {}
      for (const r of data ?? []) {
        const id = (r as { assigned_user_id: string }).assigned_user_id
        if (id) m[id] = (m[id] ?? 0) + 1
      }
      if (!cancelled) setWorkloadTodayByTech(m)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [organizationId, selectedDate, jobsRefresh, unassignedRefresh])

  useEffect(() => {
    if (!organizationId) {
      setUnassignedQueue([])
      setUnassignedRaw([])
      return
    }
    let cancelled = false

    async function loadUnassigned() {
      setUnassignedLoading(true)
      const supabase = createBrowserSupabaseClient()
      const selFull =
        "id, work_order_number, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, notes"
      const selMin =
        "id, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, notes"

      let res = await supabase
        .from("work_orders")
        .select(selFull)
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .is("assigned_user_id", null)
        .in("status", ["open", "scheduled"])
        .order("created_at", { ascending: false })

      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        res = await supabase
          .from("work_orders")
          .select(selMin)
          .eq("organization_id", organizationId)
          .eq("is_archived", false)
          .is("assigned_user_id", null)
          .in("status", ["open", "scheduled"])
          .order("created_at", { ascending: false })
      }

      if (cancelled) return

      if (res.error) {
        setUnassignedQueue([])
        setUnassignedRaw([])
        setUnassignedLoading(false)
        return
      }

      type WoMin = {
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
      }

      const rows = (res.data ?? []) as WoMin[]
      if (rows.length === 0) {
        setUnassignedQueue([])
        setUnassignedRaw([])
        setUnassignedLoading(false)
        return
      }

      const custIds = [...new Set(rows.map((r) => r.customer_id))]
      const eqIds = [...new Set(rows.map((r) => r.equipment_id))]
      const [{ data: custRows }, { data: eqRows }] = await Promise.all([
        supabase.from("customers").select("id, company_name").eq("organization_id", organizationId).in("id", custIds),
        supabase
          .from("equipment")
          .select("id, location_label, category")
          .eq("organization_id", organizationId)
          .in("id", eqIds),
      ])

      if (cancelled) return

      const custMap = new Map(
        ((custRows ?? []) as Array<{ id: string; company_name: string }>).map((c) => [c.id, c.company_name]),
      )
      const eqMap = new Map(
        (
          (eqRows ?? []) as Array<{
            id: string
            location_label: string | null
            category: string | null
          }>
        ).map((e) => [e.id, { location: e.location_label ?? "", category: e.category }]),
      )

      const uiRows: UnassignedQueueRow[] = []
      const rawSuggest: { id: string; typeDb: string; siteText: string }[] = []

      for (const r of rows) {
        const cn = custMap.get(r.customer_id) ?? "Customer"
        const eq = eqMap.get(r.equipment_id)
        const regionLine = [cn, eq?.location].filter(Boolean).join(" · ") || cn
        const sched =
          r.scheduled_on && r.scheduled_time
            ? `${fmtShortDate(r.scheduled_on.slice(0, 10))} · ${formatScheduledTime(r.scheduled_time)}`
            : r.scheduled_on
              ? fmtShortDate(r.scheduled_on.slice(0, 10))
              : "Unscheduled"

        uiRows.push({
          id: r.id,
          work_order_number: r.work_order_number,
          customerName: cn,
          jobTypeLabel: mapDbType(r.type),
          priorityLabel: mapDbPriority(r.priority),
          scheduledLabel: sched,
          regionLine,
          estHoursLabel: `Est. ${estimatedHoursForWoType(r.type)} h`,
        })
        rawSuggest.push({
          id: r.id,
          typeDb: r.type,
          siteText: `${regionLine} ${cn} ${eq?.category ?? ""}`.trim(),
        })
      }

      setUnassignedQueue(uiRows)
      setUnassignedRaw(rawSuggest)
      setUnassignedLoading(false)
    }

    void loadUnassigned()
    return () => {
      cancelled = true
    }
  }, [organizationId, unassignedRefresh])

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
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      if (orgStatus !== "ready" || !resolvedOrgId) {
        if (!cancelled) {
          setRosterError(
            orgStatus === "ready" && !resolvedOrgId ? "No organization selected." : null,
          )
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const orgId = resolvedOrgId

      const { data: members, error: mErr } = await queryOrganizationMembersForRoster(supabase, {
        organizationId: orgId,
        statusIn: ["active", "invited"],
        roleIn: ROSTER_MEMBER_ROLES,
      })

      if (mErr || cancelled) {
        if (!cancelled) {
          setRosterError(mErr?.message ?? "Failed to load team.")
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const memberList = (members ?? []) as Array<{
        user_id: string
        role: string
        job_title?: string | null
        status?: string
        region?: string | null
        skills?: string[] | null
      }>
      const userIds = [...new Set(memberList.map((m) => m.user_id))]
      const roleByUser = new Map(memberList.map((m) => [m.user_id, m.role]))
      const jobTitleByUser = new Map(
        memberList.map((m) => [m.user_id, (m.job_title ?? "").trim()]),
      )
      const regionByUser = new Map(
        memberList.map((m) => [m.user_id, (m.region ?? "").trim()]),
      )
      const skillsByUser = new Map(memberList.map((m) => [m.user_id, m.skills]))

      if (userIds.length === 0) {
        if (!cancelled) {
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const { data: profRows, error: prErr } = await queryProfilesForRoster(supabase, userIds)

      if (prErr || cancelled) {
        if (!cancelled) {
          setRosterError(prErr?.message ?? "Failed to load profiles.")
          setRoster([])
          setRosterLoading(false)
        }
        return
      }

      const list: RosterTech[] = (
        (profRows ?? []) as Array<{
          id: string
          email: string | null
          full_name: string | null
          avatar_url?: string | null
          phone?: string | null
        }>
      )
        .filter((p) => roleByUser.has(p.id))
        .map((p) => {
          const name =
            (p.full_name && p.full_name.trim()) ||
            (p.email && p.email.trim()) ||
            "Technician"
          const jt = jobTitleByUser.get(p.id)?.trim()
          const reg = regionByUser.get(p.id)?.trim()
          return {
            id: p.id,
            name,
            avatar: initialsFromName(name),
            avatarUrl: p.avatar_url?.trim() || null,
            role: jt ? jt : formatMemberRole(roleByUser.get(p.id) ?? "tech"),
            email: p.email ?? "",
            phone: p.phone?.trim() || "—",
            homeRegion: reg ? reg : null,
            skills: normalizeRosterSkills(skillsByUser.get(p.id) ?? undefined),
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
  }, [orgStatus, resolvedOrgId])

  useEffect(() => {
    if (roster.length === 0) return
    setSelectedTechId((prev) => {
      if (initialTechnicianId && roster.some((t) => t.id === initialTechnicianId)) {
        return initialTechnicianId
      }
      if (prev && roster.some((t) => t.id === prev)) return prev
      return roster[0]!.id
    })
  }, [roster, initialTechnicianId])

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

      const equipmentMap = new Map<
        string,
        {
          name: string
          location: string
          equipment_code: string | null
          serial_number: string | null
          category: string | null
        }
      >()
      if (equipmentIds.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipment")
          .select("id, name, location_label, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .in("id", equipmentIds)
        ;(
          (eqRows as Array<{
            id: string
            name: string
            location_label: string | null
            equipment_code: string | null
            serial_number: string | null
            category: string | null
          }> | null) ?? []
        ).forEach((e) => {
          equipmentMap.set(e.id, {
            name: e.name,
            location: e.location_label ?? "",
            equipment_code: e.equipment_code,
            serial_number: e.serial_number,
            category: e.category,
          })
        })
      }

      if (cancelled) return

      const rosterTech = roster.find((r) => r.id === selectedTechId)

      const mapped: WorkOrder[] = list.map((row) => {
        const eq = equipmentMap.get(row.equipment_id)
        const scheduledTime = formatScheduledTime(row.scheduled_time)
        const desc = [row.title, row.notes?.trim()].filter(Boolean).join("\n\n") || row.title
        const equipmentName = eq
          ? getEquipmentDisplayPrimary({
              id: row.equipment_id,
              name: eq.name,
              equipment_code: eq.equipment_code,
              serial_number: eq.serial_number,
              category: eq.category,
            })
          : "Equipment"

        return {
          id: row.id,
          workOrderNumber: row.work_order_number ?? undefined,
          customerId: row.customer_id,
          customerName: customerMap.get(row.customer_id) ?? "Customer",
          equipmentId: row.equipment_id,
          equipmentName,
          location: eq?.location ?? "",
          type: mapDbType(row.type),
          status: mapDbStatus(row.status),
          priority: mapDbPriority(row.priority),
          technicianId: row.assigned_user_id ?? selectedTechId,
          technicianName: technicianNameForWo,
          technicianAvatarUrl: rosterTech?.avatarUrl ?? null,
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
  }, [organizationId, selectedTechId, selectedDate, technicianNameForWo, jobsRefresh, roster])

  const dayJobs = workOrders

  const activeDayJobs = useMemo(
    () => dayJobs.filter((j) => j.status === "Open" || j.status === "Scheduled" || j.status === "In Progress"),
    [dayJobs],
  )

  const dispatchMetrics = useMemo(() => {
    const usedSlots = new Set<number>()
    for (const j of activeDayJobs) {
      if (j.scheduledTime?.trim()) {
        usedSlots.add(timeToSlotIndex(j.scheduledTime))
      }
    }
    const openSlots = Math.max(0, DISPATCH_SLOT_COUNT - usedSlots.size)
    const scheduledHours = activeDayJobs.length * 0.5
    const jobSites = new Set<string>()
    for (const j of dayJobs) {
      const loc = j.location?.trim()
      if (loc) jobSites.add(loc)
    }
    return { openSlots, scheduledHours, jobSites: [...jobSites], usedSlots }
  }, [activeDayJobs, dayJobs])

  const assignJobDefaultTime = useMemo(() => {
    for (let i = 0; i < DISPATCH_SLOT_COUNT; i++) {
      if (!dispatchMetrics.usedSlots.has(i)) {
        return slotIndexToTimeHhMm(i)
      }
    }
    return "09:00"
  }, [dispatchMetrics.usedSlots])

  const suggestionsByWoId = useMemo(() => {
    const rosterSuggest: SuggestTech[] = roster.map((t) => ({
      id: t.id,
      name: t.name,
      homeRegion: t.homeRegion,
      skills: t.skills,
    }))
    const out: Record<string, { id: string; name: string; reasons: string[] }[]> = {}
    for (const r of unassignedRaw) {
      out[r.id] = suggestTechnicians(
        { typeDb: r.typeDb, siteText: r.siteText },
        rosterSuggest,
        workloadTodayByTech,
      )
    }
    return out
  }, [unassignedRaw, roster, workloadTodayByTech])

  const persistQueuedAssign = useCallback(
    async (woId: string, techId: string, ymd: string, timeHhMm: string) => {
      if (!organizationId) return
      const supabase = createBrowserSupabaseClient()
      const { data: prev } = await supabase
        .from("work_orders")
        .select("status")
        .eq("id", woId)
        .eq("organization_id", organizationId)
        .maybeSingle()
      const st = (prev as { status?: string } | null)?.status
      if (!st) return
      const patch = buildSchedulePatch({
        scheduledOn: ymd,
        scheduledTimeHhMm: timeHhMm,
        assignedUserId: techId,
        previousStatus: st,
      })
      const { error } = await supabase
        .from("work_orders")
        .update(patch)
        .eq("id", woId)
        .eq("organization_id", organizationId)
      if (!error) {
        setUnassignedRefresh((n) => n + 1)
        setJobsRefresh((n) => n + 1)
      }
    },
    [organizationId],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragUnassignedId(null)
      const { active, over } = event
      if (!over) return
      const woId = parseDragQueuedWo(String(active.id))
      if (!woId) return
      const overId = String(over.id)
      const techHit = dropTechId(overId)
      const dayHit = dropDayYmd(overId)
      if (techHit) {
        void persistQueuedAssign(woId, techHit, selectedDate, "09:00")
      } else if (dayHit && selectedTechId) {
        void persistQueuedAssign(woId, selectedTechId, dayHit, "09:00")
      }
    },
    [persistQueuedAssign, selectedDate, selectedTechId],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragUnassignedId(parseDragQueuedWo(String(event.active.id)))
  }, [])

  const completedCount = dayJobs.filter((j) => j.status === "Completed" || j.status === "Invoiced").length
  const activeJob = dayJobs.find((j) => j.status === "In Progress")

  const techsForSelector = roster.map((t) => ({
    id: t.id,
    name: t.name,
    avatar: t.avatar,
    avatarUrl: t.avatarUrl,
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

  const dragOverlayRow = activeDragUnassignedId
    ? unassignedQueue.find((w) => w.id === activeDragUnassignedId)
    : undefined

  return (
    <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <>
      <div className="flex flex-col gap-5 w-full min-w-0">

        {rosterError && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {rosterError}
          </p>
        )}

        <section className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unassigned jobs</h3>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Drag onto a technician chip or a date below
            </span>
          </div>
          <UnassignedJobsQueue
            loading={unassignedLoading}
            rows={unassignedQueue}
            suggestionsByWoId={suggestionsByWoId}
            assigningWoId={null}
            onAssign={(woId) => {
              setAssignExistingWoId(woId)
              setScheduleJobOpen(true)
            }}
          />
        </section>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Technician</p>
          {rosterLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading team…
            </div>
          ) : techsForSelector.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members in your organization.</p>
          ) : (
            <DroppableTechSelector
              selectedId={selectedTechId}
              onChange={setSelectedTechId}
              technicians={techsForSelector}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</p>
          <DroppableDayStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        {selectedTechId && !rosterLoading && (
          <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Scheduled workload (this week strip)
            </p>
            <div className="flex items-end gap-1 overflow-x-auto scrollbar-none pb-1">
              {dayStripDates.map((date) => {
                const n = workloadByDate[date] ?? 0
                const isSelected = date === selectedDate
                return (
                  <div
                    key={date}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[48px] py-1.5 rounded-lg transition-colors",
                      isSelected ? "bg-primary/15 ring-1 ring-primary/30" : "bg-background/60",
                    )}
                  >
                    <span
                      className={cn(
                        "text-lg font-bold leading-none tabular-nums",
                        isSelected ? "text-primary" : "text-foreground",
                      )}
                    >
                      {n}
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">jobs</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedTech && !rosterLoading && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-4 flex-1 min-w-0">
                <TechnicianAvatar
                  userId={selectedTech.id}
                  name={selectedTech.name}
                  initials={selectedTech.avatar}
                  avatarUrl={selectedTech.avatarUrl}
                  size="md"
                  className="!w-12 !h-12 text-base"
                />
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
              <div className="flex flex-col justify-center shrink-0 sm:w-auto">
                <Button
                  type="button"
                  className="gap-2 w-full sm:min-w-[168px] h-10 cursor-pointer"
                  onClick={() => setScheduleJobOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Assign Job
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Timer className="h-3.5 w-3.5 shrink-0" /> Open slots
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">{dispatchMetrics.openSlots}</p>
                <p className="text-[10px] text-muted-foreground">of {DISPATCH_SLOT_COUNT} · day grid</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> Scheduled hours
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">
                  {dispatchMetrics.scheduledHours % 1 === 0
                    ? String(dispatchMetrics.scheduledHours)
                    : dispatchMetrics.scheduledHours.toFixed(1)}
                  h
                </p>
                <p className="text-[10px] text-muted-foreground">active jobs × 30 min</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Route className="h-3.5 w-3.5 shrink-0" /> Zones & regions
                </div>
                <p className="text-xs font-medium text-foreground mt-1 truncate">
                  {selectedTech.homeRegion ? `Home: ${selectedTech.homeRegion}` : "Home: —"}
                </p>
                <p
                  className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5"
                  title={dispatchMetrics.jobSites.join(" · ")}
                >
                  {dispatchMetrics.jobSites.length > 0
                    ? `${dispatchMetrics.jobSites.length} stop${dispatchMetrics.jobSites.length !== 1 ? "s" : ""}: ${dispatchMetrics.jobSites.slice(0, 2).join(" · ")}${dispatchMetrics.jobSites.length > 2 ? "…" : ""}`
                    : "No route stops today"}
                </p>
              </div>
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
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-border bg-muted/20">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No jobs for this dispatch</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {selectedTech
                ? selectedDate === todayStr
                  ? `No assignments for ${selectedTech.name} today.`
                  : `No assignments for ${selectedTech.name} on ${fmtShortDate(selectedDate)}.`
                : selectedDate === todayStr
                  ? "No assignments for the selected technician today."
                  : "No assignments for the selected technician on that day."}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm mt-5">
              <Button type="button" className="w-full gap-2 cursor-pointer" onClick={() => setScheduleJobOpen(true)}>
                <Plus className="h-4 w-4" />
                Assign Job
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 cursor-pointer"
                onClick={() => router.push("/work-orders?status=Open")}
              >
                <Wrench className="h-4 w-4" />
                Assign existing work order
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 cursor-pointer"
                onClick={() => router.push("/work-orders?action=new-work-order")}
              >
                <Plus className="h-4 w-4" />
                Create new work order
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 cursor-pointer"
                onClick={() => setBlockTimeOpen(true)}
              >
                <CalendarOff className="h-4 w-4" />
                Block time / PTO
              </Button>
            </div>
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
      </div>

      {scheduleJobOpen && selectedTech ? (
        <ScheduleJobModal
          key={`sched-${selectedTech.id}-${selectedDate}-${assignJobDefaultTime}-${assignExistingWoId ?? "new"}`}
          tech={rosterToScheduleTechnician(selectedTech)}
          initialDate={selectedDate}
          initialTimeHhMm={assignJobDefaultTime}
          existingWorkOrderId={assignExistingWoId}
          onClose={() => {
            setScheduleJobOpen(false)
            setAssignExistingWoId(null)
          }}
          onSave={() => {
            setScheduleJobOpen(false)
            setAssignExistingWoId(null)
            refreshDayJobs()
            setUnassignedRefresh((n) => n + 1)
          }}
        />
      ) : null}

      <Dialog open={blockTimeOpen} onOpenChange={setBlockTimeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block time / PTO</DialogTitle>
            <DialogDescription>
              Personal time blocks and PTO will tie into the team calendar in a future release. Use the Dispatch Board to
              review coverage, or adjust assignments from work orders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setBlockTimeOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => {
                setBlockTimeOpen(false)
                router.push("/dispatch")
              }}
            >
              Open Dispatch Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkOrderDrawer
        workOrderId={selectedWorkOrderId}
        onClose={() => setSelectedWorkOrderId(null)}
        onUpdated={() => {
          refreshDayJobs()
          setUnassignedRefresh((n) => n + 1)
        }}
      />

      <DragOverlay dropAnimation={null}>
        {dragOverlayRow ? (
          <div className="rounded-xl border border-primary/35 bg-card px-4 py-3 shadow-2xl max-w-[240px]">
            <p className="font-mono text-[10px] text-primary">
              {getWorkOrderDisplay({
                id: dragOverlayRow.id,
                workOrderNumber: dragOverlayRow.work_order_number ?? null,
              })}
            </p>
            <p className="text-xs font-semibold text-foreground truncate">{dragOverlayRow.customerName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{dragOverlayRow.jobTypeLabel}</p>
          </div>
        ) : null}
      </DragOverlay>
      </>
    </DndContext>
  )
}

export function DispatchDrawer({
  open,
  onOpenChange,
  initialTechnicianId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTechnicianId?: string | null
}) {
  return (
    <DetailDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="Daily Dispatch"
      subtitle="Jobs for one technician on the selected day."
      width="xl"
      transitionMs={400}
    >
      {open ? (
        <DailyDispatchInner initialTechnicianId={initialTechnicianId} />
      ) : null}
    </DetailDrawer>
  )
}
