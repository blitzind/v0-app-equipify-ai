"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  RepairLog,
} from "@/lib/mock-data"
import { CreateWorkOrderModal } from "@/components/work-orders/create-work-order-modal"
import { getWorkOrderDisplay, workOrderMatchesSearch, effectiveWorkOrderNumber } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Wrench,
  Clock,
  ChevronRight as Arrow,
  AlertTriangle,
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES: WorkOrderStatus[] = [
  "Open",
  "Scheduled",
  "In Progress",
  "Completed",
  "Completed Pending Signature",
  "Invoiced",
]

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":   "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Completed Pending Signature":
    "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30",
  "Invoiced":    "bg-muted text-muted-foreground border-border",
}

const PRIORITY_STYLE: Record<WorkOrderPriority, string> = {
  "Low":      "text-muted-foreground",
  "Normal":   "text-foreground",
  "High":     "text-[color:var(--status-warning)]",
  "Critical": "text-destructive font-semibold",
}

const KANBAN_COLUMNS: WorkOrderStatus[] = [
  "Open",
  "Scheduled",
  "In Progress",
  "Completed",
  "Completed Pending Signature",
  "Invoiced",
]

const KANBAN_HEADER: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/8 border-[color:var(--status-info)]/20",
  "Scheduled":   "bg-[color:var(--status-info)]/12 border-[color:var(--status-info)]/18",
  "In Progress": "bg-[color:var(--status-warning)]/8 border-[color:var(--status-warning)]/20",
  "Completed":   "bg-[color:var(--status-success)]/8 border-[color:var(--status-success)]/20",
  "Completed Pending Signature": "bg-amber-500/8 border-amber-500/20",
  "Invoiced":    "bg-muted/50 border-border",
}

type ViewMode = "kanban" | "table" | "calendar"
type SortKey = "id" | "customerName" | "scheduledDate" | "priority" | "status"

type DbWorkOrderRow = {
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
  completed_at: string | null
  assigned_user_id: string | null
  created_at: string
  invoice_number: string | null
  total_labor_cents: number
  total_parts_cents: number
  notes: string | null
  maintenance_plan_id: string | null
  created_by_pm_automation?: boolean | null
}

function emptyRepairLog(): RepairLog {
  return {
    problemReported: "",
    diagnosis: "",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
  }
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
    case "completed_pending_signature":
      return "Completed Pending Signature"
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

function formatScheduledTime(isoOrTime: string | null): string {
  if (!isoOrTime) return ""
  const t = isoOrTime.includes("T") ? isoOrTime.slice(11, 16) : isoOrTime.slice(0, 5)
  return t || ""
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return (
    <Badge variant="secondary" className={cn("text-xs border", STATUS_STYLE[status])}>
      {status}
    </Badge>
  )
}

function PriorityDot({ priority }: { priority: WorkOrderPriority }) {
  const colors: Record<WorkOrderPriority, string> = {
    Low: "bg-muted-foreground",
    Normal: "bg-foreground",
    High: "bg-[color:var(--status-warning)]",
    Critical: "bg-destructive",
  }
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", colors[priority])} />
}

function formatDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function initialsFromTechName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({ wo, onOpen }: { wo: WorkOrder; onOpen: () => void }) {
  return (
    <div onClick={onOpen} className="bg-card border border-border rounded-lg p-3.5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">{getWorkOrderDisplay(wo)}</span>
          <div className="flex items-center gap-1.5">
            <PriorityDot priority={wo.priority} />
            <span className={cn("text-xs", PRIORITY_STYLE[wo.priority])}>{wo.priority}</span>
          </div>
        </div>
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug mb-2">
          {wo.description}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wrench className="w-3 h-3 shrink-0" />
            <span className="truncate">{wo.customerName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <TechnicianAvatar
              userId={wo.technicianId === "unassigned" ? "—" : wo.technicianId}
              name={wo.technicianName}
              initials={initialsFromTechName(wo.technicianName)}
              avatarUrl={wo.technicianAvatarUrl}
              size="xs"
            />
            <span className="truncate">{wo.technicianName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{formatDate(wo.scheduledDate)} {wo.scheduledTime && `at ${wo.scheduledTime}`}</span>
          </div>
        </div>
        {wo.priority === "Critical" && (
          <div className="flex items-center gap-1 mt-2.5 text-xs text-destructive">
            <AlertTriangle className="w-3 h-3" />
            <span>Critical priority</span>
          </div>
        )}
      </div>
  )
}

// ─── Kanban view ──────────────────────────────────────────────────────────────

function KanbanView({ workOrders, onOpen }: { workOrders: WorkOrder[]; onOpen: (id: string) => void }) {
  const columns = KANBAN_COLUMNS.map((status) => ({
    status,
    items: workOrders.filter((wo) => wo.status === status),
  }))

  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none pb-4 h-full">
      {columns.map(({ status, items }) => (
        <div key={status} className="flex flex-col gap-3 w-72 shrink-0">
          {/* Column header */}
          <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg border", KANBAN_HEADER[status])}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{status}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5">
              {items.length}
            </span>
          </div>
          {/* Cards */}
          <div className="flex flex-col gap-2.5 min-h-24">
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-20 border border-dashed border-border rounded-lg">
                <span className="text-xs text-muted-foreground">No work orders</span>
              </div>
            ) : (
              items.map((wo) => <KanbanCard key={wo.id} wo={wo} onOpen={() => onOpen(wo.id)} />)
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Table view ───────────────────────────────────────────────────────────────

function TableView({
  workOrders,
  sortKey,
  sortDir,
  onSort,
  onOpen,
}: {
  workOrders: WorkOrder[]
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
  onOpen: (id: string) => void
}) {
  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    return (
      <button
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => onSort(col)}
      >
        {label}
        <ArrowUpDown className={cn("w-3 h-3", sortKey === col && "text-primary")} />
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-28"><SortHeader label="ID" col="id" /></TableHead>
            <TableHead><SortHeader label="Customer" col="customerName" /></TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead><SortHeader label="Priority" col="priority" /></TableHead>
            <TableHead><SortHeader label="Status" col="status" /></TableHead>
            <TableHead>Technician</TableHead>
            <TableHead><SortHeader label="Scheduled" col="scheduledDate" /></TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((wo) => (
            <TableRow key={wo.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => onOpen(wo.id)}>
              <TableCell>
                <span className="font-mono text-xs text-primary hover:underline">{getWorkOrderDisplay(wo)}</span>
              </TableCell>
              <TableCell className="font-medium text-sm">{wo.customerName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{wo.equipmentName}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{wo.type}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <PriorityDot priority={wo.priority} />
                  <span className={cn("text-xs", PRIORITY_STYLE[wo.priority])}>{wo.priority}</span>
                </div>
              </TableCell>
              <TableCell><StatusBadge status={wo.status} /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                  <TechnicianAvatar
                    userId={wo.technicianId === "unassigned" ? "—" : wo.technicianId}
                    name={wo.technicianName}
                    initials={initialsFromTechName(wo.technicianName)}
                    avatarUrl={wo.technicianAvatarUrl}
                    size="sm"
                  />
                  <span className="truncate">{wo.technicianName}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(wo.scheduledDate)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onOpen(wo.id)}>
                  <Arrow className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                </button>
              </TableCell>
            </TableRow>
          ))}
          {workOrders.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-12">
                No work orders match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({ workOrders, onOpen }: { workOrders: WorkOrder[]; onOpen: (id: string) => void }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay() // 0 = Sun
  const totalDays = lastDay.getDate()

  const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  // Build a map of date string -> work orders
  const dayMap = useMemo(() => {
    const m: Record<string, WorkOrder[]> = {}
    workOrders.forEach((wo) => {
      if (!wo.scheduledDate) return
      const key = wo.scheduledDate
      if (!m[key]) m[key] = []
      m[key].push(wo)
    })
    return m
  }, [workOrders])

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function toKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-px">
        {[["Sun","S"],["Mon","M"],["Tue","T"],["Wed","W"],["Thu","T"],["Fri","F"],["Sat","S"]].map(([full, short]) => (
          <div key={full} className="text-center text-xs font-medium text-muted-foreground py-2">
            <span className="hidden sm:inline">{full}</span>
            <span className="sm:hidden">{short}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {cells.map((day, i) => {
          const key = day ? toKey(day) : ""
          const dayOrders = day ? (dayMap[key] ?? []) : []
          return (
            <div
              key={i}
              className={cn(
                "bg-card min-h-[3.5rem] sm:min-h-24 p-1 sm:p-2 flex flex-col gap-1",
                !day && "bg-muted/30",
                day && isToday(day) && "bg-primary/5"
              )}
            >
              {day && (
                <>
                  <span className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {day}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {dayOrders.slice(0, 3).map((wo) => (
                      <button key={wo.id} onClick={() => onOpen(wo.id)} className="text-left w-full">
                        <div
                          className={cn(
                            "text-[10px] px-1 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 min-w-0",
                            STATUS_STYLE[wo.status]
                          )}
                        >
                          <TechnicianAvatar
                            userId={wo.technicianId === "unassigned" ? "—" : wo.technicianId}
                            name={wo.technicianName}
                            initials={initialsFromTechName(wo.technicianName)}
                            avatarUrl={wo.technicianAvatarUrl}
                            size="xs"
                            className="shrink-0"
                          />
                          <span className="truncate">
                            {getWorkOrderDisplay(wo)} · {wo.technicianName.split(" ")[0]}
                          </span>
                        </div>
                      </button>
                    ))}
                    {dayOrders.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1">+{dayOrders.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────��──────────────────────

function WorkOrdersPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true

    async function loadWorkOrders() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) setWorkOrders([])
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        if (active) setWorkOrders([])
        return
      }

      const orgId = activeOrgId

      let woRes = await supabase
        .from("work_orders")
        .select(WO_LIST_SELECT_WITH_NUM)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(WO_LIST_SELECT)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
      }

      const { data: rows, error: woError } = woRes

      if (woError || !rows) {
        if (active) setWorkOrders([])
        return
      }

      const list = rows as DbWorkOrderRow[]
      const customerIds = [...new Set(list.map((r) => r.customer_id))]
      const equipmentIds = [...new Set(list.map((r) => r.equipment_id))]
      const assigneeIds = [
        ...new Set(list.map((r) => r.assigned_user_id).filter((id): id is string => Boolean(id))),
      ]

      const customerMap = new Map<string, string>()
      if (customerIds.length > 0) {
        const { data: custRows } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
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
          .eq("organization_id", orgId)
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

      const profileMap = new Map<string, { label: string; avatarUrl: string | null }>()
      if (assigneeIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", assigneeIds)

        ;(
          (profRows as Array<{
            id: string
            full_name: string | null
            email: string | null
            avatar_url: string | null
          }> | null) ?? []
        ).forEach((p) => {
          const label =
            (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Technician"
          profileMap.set(p.id, {
            label,
            avatarUrl: p.avatar_url?.trim() || null,
          })
        })
      }

      const planIds = [...new Set(list.map((r) => r.maintenance_plan_id).filter((pid): pid is string => Boolean(pid)))]
      const planNameById = new Map<string, string>()
      if (planIds.length > 0) {
        const { data: planRows } = await supabase
          .from("maintenance_plans")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", planIds)

        ;((planRows as Array<{ id: string; name: string }> | null) ?? []).forEach((p) => {
          planNameById.set(p.id, p.name)
        })
      }

      const mapped: WorkOrder[] = list.map((row) => {
        const eq = equipmentMap.get(row.equipment_id)
        const techId = row.assigned_user_id ?? "unassigned"
        const tp = row.assigned_user_id ? profileMap.get(row.assigned_user_id) : undefined
        const techName = row.assigned_user_id ? (tp?.label ?? "Unknown") : "Unassigned"

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
          customerName: customerMap.get(row.customer_id) ?? "Unknown Customer",
          equipmentId: row.equipment_id,
          equipmentName,
          location: eq?.location ?? "",
          type: mapDbType(row.type),
          status: mapDbStatus(row.status),
          priority: mapDbPriority(row.priority),
          technicianId: techId,
          technicianName: techName,
          technicianAvatarUrl: tp?.avatarUrl ?? null,
          scheduledDate: row.scheduled_on ?? "",
          scheduledTime: formatScheduledTime(row.scheduled_time),
          completedDate: row.completed_at ? row.completed_at.slice(0, 10) : "",
          createdAt: row.created_at,
          createdBy: "",
          description: row.title,
          repairLog: emptyRepairLog(),
          totalLaborCost: row.total_labor_cents / 100,
          totalPartsCost: row.total_parts_cents / 100,
          invoiceNumber: row.invoice_number ?? "",
          maintenancePlanId: row.maintenance_plan_id,
          maintenancePlanName: row.maintenance_plan_id
            ? (planNameById.get(row.maintenance_plan_id) ?? null)
            : null,
          createdByPmAutomation: Boolean(row.created_by_pm_automation),
        }
      })

      if (active) setWorkOrders(mapped)
    }

    void loadWorkOrders()

    return () => {
      active = false
    }
  }, [refreshToken, orgStatus, activeOrgId])

  const [view, setView] = useState<ViewMode>("kanban")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | "all">("all")
  const [techFilter, setTechFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("scheduledDate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [createOpen, setCreateOpen] = useState(false)
  const [createModalCustomerId, setCreateModalCustomerId] = useState<string | null>(null)
  const [createModalEquipmentId, setCreateModalEquipmentId] = useState<string | null>(null)
  useQuickAdd("new-work-order", () => {
    setCreateModalCustomerId(null)
    setCreateModalEquipmentId(null)
    setCreateOpen(true)
  })
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null)
  const [drawerInitialTab, setDrawerInitialTab] = useState<string | undefined>(undefined)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Auto-open drawer from ?open= query param
  useEffect(() => {
    const openId = searchParams.get("open")
    const rawTab = searchParams.get("tab") ?? undefined
    const tab = rawTab === "certificate" ? "certificates" : rawTab
    if (openId) {
      setSelectedWoId(openId)
      setDrawerInitialTab(tab)
      router.replace("/work-orders", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    const action = searchParams.get("action")
    const cid = searchParams.get("customerId")
    const eid = searchParams.get("equipmentId")
    if (action === "new-work-order") {
      setCreateModalCustomerId(cid)
      setCreateModalEquipmentId(eid)
      setCreateOpen(true)
      router.replace("/work-orders", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    const s = searchParams.get("status")
    if (s && (ALL_STATUSES as readonly string[]).includes(s)) {
      setStatusFilter(s as WorkOrderStatus)
    }
  }, [searchParams])

  const allTechs = useMemo(() => {
    const seen = new Set<string>()
    return workOrders
      .map((wo) => ({
        id: wo.technicianId,
        name: wo.technicianName,
        avatarUrl: wo.technicianAvatarUrl,
      }))
      .filter(({ id }) => (seen.has(id) ? false : seen.add(id)))
  }, [workOrders])

  const filtered = useMemo(() => {
    let list = [...workOrders]

    if (search.trim()) {
      list = list.filter((wo) => workOrderMatchesSearch(search, wo))
    }
    if (statusFilter !== "all") list = list.filter((wo) => wo.status === statusFilter)
    if (priorityFilter !== "all") list = list.filter((wo) => wo.priority === priorityFilter)
    if (techFilter !== "all") list = list.filter((wo) => wo.technicianId === techFilter)

    const priorityOrder: Record<WorkOrderPriority, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 }
    list.sort((a, b) => {
      let av: string | number = a[sortKey] ?? ""
      let bv: string | number = b[sortKey] ?? ""
      if (sortKey === "priority") { av = priorityOrder[a.priority]; bv = priorityOrder[b.priority] }
      if (sortKey === "id") {
        const an = effectiveWorkOrderNumber(a)
        const bn = effectiveWorkOrderNumber(b)
        if (an != null && bn != null) {
          av = an
          bv = bn
        } else if (an != null) {
          av = an
          bv = -Infinity
        } else if (bn != null) {
          av = -Infinity
          bv = bn
        }
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [workOrders, search, statusFilter, priorityFilter, techFilter, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

  const counts = useMemo(() => {
    const m: Partial<Record<WorkOrderStatus, number>> = {}
    workOrders.forEach((wo) => { m[wo.status] = (m[wo.status] ?? 0) + 1 })
    return m
  }, [workOrders])

  return (
    <div className="flex flex-col gap-6">
      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={cn(
              "flex flex-col gap-0.5 p-3 rounded-lg border bg-card text-left transition-all hover:border-primary/40",
              statusFilter === s && "border-primary ring-1 ring-primary/20"
            )}
          >
            <span className="text-xl sm:text-2xl font-bold text-foreground">{counts[s] ?? 0}</span>
            <span className={cn("text-xs font-medium border rounded-full px-2 py-0.5 w-fit truncate max-w-full", STATUS_STYLE[s])}>{s}</span>
          </button>
        ))}
      </div>

      {/* Toolbar: search & filters (left) · view mode + primary action (right) */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="relative w-full min-w-[12rem] sm:max-w-sm sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search work orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as WorkOrderPriority | "all")}>
              <SelectTrigger className="w-32 sm:w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="w-36 sm:w-44">
                <SelectValue placeholder="Technician" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {allTechs.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                    <span className="flex items-center gap-2">
                      <TechnicianAvatar
                        userId={t.id === "unassigned" ? "—" : t.id}
                        name={t.name}
                        initials={initialsFromTechName(t.name)}
                        avatarUrl={t.avatarUrl}
                        size="xs"
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-end">
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            {([
              { mode: "kanban", icon: LayoutGrid, label: "Kanban" },
              { mode: "table", icon: List, label: "Table" },
              { mode: "calendar", icon: Calendar, label: "Calendar" },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs transition-colors",
                  view === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button
            onClick={() => {
              setCreateModalCustomerId(null)
              setCreateModalEquipmentId(null)
              setCreateOpen(true)
            }}
            className="gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Work Order
          </Button>
        </div>
      </div>

      {/* Results count (non-kanban) */}
      {view !== "kanban" && (
        <p className="text-xs text-muted-foreground -mt-3">
          {filtered.length} work order{filtered.length !== 1 ? "s" : ""}
          {statusFilter !== "all" ? ` — ${statusFilter}` : ""}
        </p>
      )}

      {/* Views */}
      <div className={cn("flex-1 overflow-hidden", view !== "kanban" && "overflow-y-auto")}>
        {view === "kanban" && <KanbanView workOrders={filtered} onOpen={setSelectedWoId} />}
        {view === "table" && (
          <TableView
            workOrders={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onOpen={setSelectedWoId}
          />
        )}
        {view === "calendar" && <CalendarView workOrders={filtered} onOpen={setSelectedWoId} />}
      </div>

      <CreateWorkOrderModal
        open={createOpen}
        initialCustomerId={createModalCustomerId}
        initialEquipmentId={createModalEquipmentId}
        onClose={() => {
          setCreateOpen(false)
          setCreateModalCustomerId(null)
          setCreateModalEquipmentId(null)
        }}
        onSuccess={() => setRefreshToken((v) => v + 1)}
      />

      <WorkOrderDrawer
        workOrderId={selectedWoId}
        initialTab={drawerInitialTab}
        onClose={() => {
          setSelectedWoId(null)
          setDrawerInitialTab(undefined)
        }}
        onUpdated={() => setRefreshToken((v) => v + 1)}
      />

      <QuickAddParamBridge action="new-work-order" onTrigger={() => setCreateOpen(true)} />
    </div>
  )
}

export default function WorkOrdersPage() {
  return <Suspense fallback={null}><WorkOrdersPageInner /></Suspense>
}
