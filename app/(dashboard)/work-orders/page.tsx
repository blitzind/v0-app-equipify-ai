"use client"

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  Suspense,
} from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useOrgArchivePermissions } from "@/lib/use-org-archive-permissions"
import { archiveWorkOrderViaApi, bulkArchiveWorkOrdersViaApi } from "@/lib/work-orders/archive-work-order-client"
import {
  bulkArchivePartialToast,
  bulkArchiveSuccessToast,
  BULK_ARCHIVE_PARTIAL_DESCRIPTION,
} from "@/lib/work-orders/bulk-archive-messages"
import { WorkOrderArchiveDialog } from "@/components/work-orders/work-order-archive-dialog"
import { useToast } from "@/hooks/use-toast"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  RepairLog,
} from "@/lib/mock-data"
import { CreateWorkOrderModal } from "@/components/work-orders/create-work-order-modal"
import { QuickAppointmentDialog } from "@/components/dispatch/quick-appointment-dialog"
import { getWorkOrderDisplay, workOrderMatchesSearch, effectiveWorkOrderNumber } from "@/lib/work-orders/display"
import {
  missingAssignedTechnicianColumn,
  missingOperationalBillingColumns,
  missingWorkOrderNumberColumn,
} from "@/lib/work-orders/postgrest-fallback"
import {
  loadTechnicianAssignOptions,
  toScheduleAssigneePickerOptions,
} from "@/lib/work-orders/load-technician-assign-options"

const UUID_PARAM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { applyArchivedAtScope } from "@/lib/archive-scope"
import type { RecordArchiveVisibility } from "@/lib/org-quotes-invoices/repository"
import { buildWorkOrderListSelect } from "@/lib/work-orders/supabase-select"
import {
  batchHydrateAssigneeLabelsByUserId,
  WO_ASSIGNEE_FALLBACK_LABEL,
  WO_ASSIGNEE_UNASSIGNED_LABEL,
} from "@/lib/work-orders/work-order-assignee-display"
import { teamMemberSettingsListLabel } from "@/lib/team/team-member-display-label"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { AidenOperationalInsightsCard } from "@/components/aiden/aiden-operational-insights-card"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
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
  MoreHorizontal,
  Archive,
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
  equipment_id: string | null
  title: string
  status: string
  priority: string
  type: string
  scheduled_on: string | null
  scheduled_time: string | null
  completed_at: string | null
  assigned_user_id: string | null
  /** Present when `buildWorkOrderListSelect` includes assigned technician column. */
  assigned_technician_id?: string | null
  created_at: string
  invoice_number: string | null
  total_labor_cents: number
  total_parts_cents: number
  notes: string | null
  maintenance_plan_id: string | null
  created_by_pm_automation?: boolean | null
  archived_at?: string | null
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
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className="touch-manipulation bg-card border border-border rounded-xl p-4 min-h-[5.5rem] hover:border-primary/40 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer group"
    >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">{getWorkOrderDisplay(wo)}</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {wo.isArchived ? (
              <Badge variant="outline" className="text-[9px] font-semibold px-1.5 py-0 h-5 bg-muted text-muted-foreground border-border">
                Archived
              </Badge>
            ) : null}
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

const KANBAN_LANE_GAP_PX = 16 // tailwind gap-4

type KanbanViewHandle = {
  scrollLanes: (dir: "left" | "right") => void
}

const KanbanView = forwardRef<
  KanbanViewHandle,
  {
    workOrders: WorkOrder[]
    onOpen: (id: string) => void
    onLaneScrollCapabilities?: (s: { canScroll: boolean; showLeft: boolean; showRight: boolean }) => void
  }
>(function KanbanView({ workOrders, onOpen, onLaneScrollCapabilities }, ref) {
  const columns = useMemo(
    () =>
      KANBAN_COLUMNS.map((status) => ({
        status,
        items: workOrders.filter((wo) => wo.status === status),
      })),
    [workOrders],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const [hScroll, setHScroll] = useState({ showLeft: false, showRight: false, canScroll: false })

  const updateHScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    const canScroll = maxScroll > 4
    setHScroll({
      canScroll,
      showLeft: canScroll && scrollLeft > 4,
      showRight: canScroll && scrollLeft < maxScroll - 4,
    })
  }, [])

  useEffect(() => {
    updateHScroll()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateHScroll())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateHScroll, columns])

  const laneScrollStepPx = useCallback(() => {
    const root = scrollRef.current
    if (!root) return 288 + KANBAN_LANE_GAP_PX
    const lane = root.querySelector("[data-kanban-lane]") as HTMLElement | null
    if (lane) return lane.getBoundingClientRect().width + KANBAN_LANE_GAP_PX
    return Math.min(320, root.clientWidth * 0.85)
  }, [])

  const scrollKanban = useCallback(
    (dir: "left" | "right") => {
      const el = scrollRef.current
      if (!el) return
      const step = laneScrollStepPx() * (dir === "left" ? -1 : 1)
      el.scrollBy({ left: step, behavior: "smooth" })
      window.requestAnimationFrame(updateHScroll)
      window.setTimeout(updateHScroll, 380)
    },
    [laneScrollStepPx, updateHScroll],
  )

  useImperativeHandle(
    ref,
    () => ({
      scrollLanes: (dir: "left" | "right") => scrollKanban(dir),
    }),
    [scrollKanban],
  )

  useEffect(() => {
    onLaneScrollCapabilities?.(hScroll)
  }, [hScroll, onLaneScrollCapabilities])

  return (
    <div className="relative min-w-0">
      <div
        ref={scrollRef}
        onScroll={updateHScroll}
        className="flex gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain scroll-smooth scroll-px-3 pb-4 [-webkit-overflow-scrolling:touch] scrollbar-none snap-x snap-mandatory lg:snap-none touch-pan-x px-1 sm:px-0"
      >
        {columns.map(({ status, items }) => (
          <div
            key={status}
            data-kanban-lane
            className="flex w-[min(20rem,calc(100vw-2rem))] shrink-0 snap-start flex-col gap-3 sm:w-72"
          >
            <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2", KANBAN_HEADER[status])}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{status}</span>
              </div>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="flex min-h-24 flex-col gap-2.5">
              {items.length === 0 ? (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border">
                  <span className="text-xs text-muted-foreground">No work orders</span>
                </div>
              ) : (
                items.map((wo) => <KanbanCard key={wo.id} wo={wo} onOpen={() => onOpen(wo.id)} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

// ─── Mobile list (table data, card layout — avoids wide horizontal scroll) ─────

function MobileWorkOrderRowCard({
  wo,
  onOpen,
  canArchive,
  onArchive,
}: {
  wo: WorkOrder
  onOpen: (id: string) => void
  canArchive?: boolean
  onArchive?: (wo: WorkOrder) => void
}) {
  return (
    <div className="relative w-full rounded-xl border border-border bg-card shadow-sm touch-manipulation">
      {canArchive && !wo.isArchived && onArchive ? (
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Work order actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive gap-2 cursor-pointer"
                onClick={() => onArchive(wo)}
              >
                <Archive className="w-4 h-4" />
                Archive work order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(wo.id)}
        className="w-full p-4 text-left min-h-[4.75rem] active:scale-[0.99] transition-transform flex flex-col gap-2"
      >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-primary shrink-0">{getWorkOrderDisplay(wo)}</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <StatusBadge status={wo.status} />
          {wo.isArchived ? (
            <Badge variant="outline" className="text-[9px] font-semibold px-1.5 py-0 h-5 bg-muted text-muted-foreground border-border">
              Archived
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{wo.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="truncate max-w-[55%]">{wo.customerName}</span>
        <span className="text-border">·</span>
        <span className="truncate">{wo.equipmentName}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <PriorityDot priority={wo.priority} />
          <span className={cn(PRIORITY_STYLE[wo.priority])}>{wo.priority}</span>
        </span>
        <span className="text-border">·</span>
        <span>{formatDate(wo.scheduledDate)}</span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1 min-w-0">
          <TechnicianAvatar
            userId={wo.technicianId === "unassigned" ? "—" : wo.technicianId}
            name={wo.technicianName}
            initials={initialsFromTechName(wo.technicianName)}
            avatarUrl={wo.technicianAvatarUrl}
            size="xs"
          />
          <span className="truncate">{wo.technicianName}</span>
        </span>
      </div>
      </button>
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
  canArchive,
  onArchive,
  canSelect,
  selectedIds,
  onToggleRow,
  onToggleAllVisible,
}: {
  workOrders: WorkOrder[]
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
  onOpen: (id: string) => void
  canArchive?: boolean
  onArchive?: (wo: WorkOrder) => void
  canSelect?: boolean
  selectedIds?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAllVisible?: () => void
}) {
  const selectableRows = useMemo(
    () => (canSelect ? workOrders.filter((wo) => !wo.isArchived) : []),
    [canSelect, workOrders],
  )
  const selectedCount = selectableRows.filter((wo) => selectedIds?.has(wo.id)).length
  const allVisibleSelected = selectableRows.length > 0 && selectedCount === selectableRows.length
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected

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
    <>
      <div className="hidden md:block ds-table-surface">
        <Table>
          <TableHeader>
            <TableRow className="ds-table-header-row-subtle">
              {canSelect ? (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all visible work orders"
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    disabled={selectableRows.length === 0}
                    onCheckedChange={() => onToggleAllVisible?.()}
                  />
                </TableHead>
              ) : null}
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
            {workOrders.map((wo) => {
              const rowSelectable = Boolean(canSelect && !wo.isArchived)
              const rowSelected = Boolean(selectedIds?.has(wo.id))
              return (
              <TableRow key={wo.id} className="ds-hover-list-row cursor-pointer" onClick={() => onOpen(wo.id)}>
                {canSelect ? (
                  <TableCell
                    className="w-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      aria-label={`Select work order ${getWorkOrderDisplay(wo)}`}
                      checked={rowSelected}
                      disabled={!rowSelectable}
                      onCheckedChange={() => {
                        if (rowSelectable) onToggleRow?.(wo.id)
                      }}
                    />
                  </TableCell>
                ) : null}
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
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={wo.status} />
                    {wo.isArchived ? (
                      <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                        Archived
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
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
                  <div className="flex items-center justify-end gap-1">
                    {canArchive && !wo.isArchived && onArchive ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Work order actions">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive gap-2 cursor-pointer"
                            onClick={() => onArchive(wo)}
                          >
                            <Archive className="w-4 h-4" />
                            Archive work order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                    <button type="button" onClick={() => onOpen(wo.id)} aria-label="Open work order">
                      <Arrow className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )})}
            {workOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={canSelect ? 10 : 9} className="text-center text-muted-foreground text-sm py-12">
                  No work orders match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden flex flex-col gap-2 min-w-0">
        {workOrders.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12 rounded-xl border border-dashed border-border">
            No work orders match your filters.
          </p>
        ) : (
          workOrders.map((wo) => (
            <MobileWorkOrderRowCard
              key={wo.id}
              wo={wo}
              onOpen={onOpen}
              canArchive={canArchive}
              onArchive={onArchive}
            />
          ))
        )}
      </div>
    </>
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

// ─── Main page ────────────────────────────────────────────────────────────────

function WorkOrdersPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { canArchiveRestore } = useOrgArchivePermissions()
  const { toast } = useToast()
  const { standardCreateEligibility } = useBillingAccess()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [refreshToken, setRefreshToken] = useState(0)
  const [archiveScope, setArchiveScope] = useState<RecordArchiveVisibility>("active")
  const [workOrdersLoadError, setWorkOrdersLoadError] = useState<string | null>(null)
  const assignedOnlyView = isAssignedWorkOnly(permissions)

  useEffect(() => {
    let active = true

    async function loadWorkOrders() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setWorkOrders([])
          setWorkOrdersLoadError(null)
        }
        return
      }

      if (!activeOrgId) {
        if (active) {
          setWorkOrders([])
          setWorkOrdersLoadError(null)
        }
        return
      }

      if (orgStatus !== "ready") {
        return
      }

      const orgId = activeOrgId
      const assignedScope = assignedOnlyView
        ? await loadAssignedWorkScope(supabase, { organizationId: orgId, userId: user.id })
        : null

      async function runWorkOrdersQuery(includeNum: boolean, includeTech: boolean, includeBilling: boolean) {
        let q = supabase
          .from("work_orders")
          .select(
            buildWorkOrderListSelect({
              includeWorkOrderNumber: includeNum,
              includeAssignedTechnician: includeTech,
              includeOperationalBillingColumns: includeBilling,
            }),
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
        if (assignedOnlyView) {
          const scopedIds = assignedScope?.workOrderIds ?? []
          if (scopedIds.length === 0) q = q.eq("id", "__none__")
          else q = q.in("id", scopedIds)
        }
        q = applyArchivedAtScope(q, archiveScope)
        return q
      }

      let includeNum = true
      let includeTech = true
      let includeBilling = permissions.canViewFinancials || permissions.canViewBilling
      let woRes = await runWorkOrdersQuery(includeNum, includeTech, includeBilling)

      for (;;) {
        const err = woRes.error
        if (!err) break
        if (missingWorkOrderNumberColumn(err) && includeNum) {
          includeNum = false
          woRes = await runWorkOrdersQuery(includeNum, includeTech, includeBilling)
          continue
        }
        if (missingAssignedTechnicianColumn(err) && includeTech) {
          includeTech = false
          woRes = await runWorkOrdersQuery(includeNum, includeTech, includeBilling)
          continue
        }
        if (missingOperationalBillingColumns(err) && includeBilling) {
          includeBilling = false
          woRes = await runWorkOrdersQuery(includeNum, includeTech, includeBilling)
          continue
        }
        break
      }

      const { data: rows, error: woError } = woRes

      if (woError || !rows) {
        const payload = {
          phase: "work_orders_list",
          code: woError?.code,
          message: woError?.message,
          retryPath: "work_order_number → assigned_technician_id → operational billing columns",
        }
        console.error("[work-orders] load failed", payload)
        if (process.env.NODE_ENV === "development") {
          void fetch("/api/dev/work-order-query-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {})
        }
        if (active) {
          setWorkOrders([])
          setWorkOrdersLoadError(
            woError
              ? process.env.NODE_ENV === "development"
                ? `[${woError.code ?? "error"}] ${woError.message}`
                : "Could not load work orders. Refresh the page, or apply pending Supabase migrations on local databases."
              : "Could not load work orders (empty response). Try refreshing.",
          )
        }
        return
      }

      if (active) setWorkOrdersLoadError(null)

      const list = rows as DbWorkOrderRow[]
      const customerIds = [...new Set(list.map((r) => r.customer_id))]
      const equipmentIds = [...new Set(list.map((r) => r.equipment_id).filter((id): id is string => Boolean(id)))]
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

      const hydratedByUser = await batchHydrateAssigneeLabelsByUserId(orgId, assigneeIds)

      const techOnlyIds = [
        ...new Set(
          list
            .filter((r) => Boolean(r.assigned_technician_id) && !r.assigned_user_id)
            .map((r) => r.assigned_technician_id!),
        ),
      ]
      const techOnlyMap = new Map<string, { label: string; avatarUrl: string | null }>()
      if (techOnlyIds.length > 0) {
        const { data: trows } = await supabase
          .from("technicians")
          .select("id, full_name, email, avatar_url")
          .eq("organization_id", orgId)
          .in("id", techOnlyIds)
        for (const t of (trows ?? []) as Array<{
          id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
        }>) {
          techOnlyMap.set(t.id, {
            label: teamMemberSettingsListLabel(t.full_name, t.email),
            avatarUrl: t.avatar_url?.trim() || null,
          })
        }
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
        const eq = row.equipment_id ? equipmentMap.get(row.equipment_id) : undefined
        const aid = row.assigned_user_id
        const tid = row.assigned_technician_id ?? null
        const techId = aid ?? tid ?? "unassigned"
        let techName = WO_ASSIGNEE_UNASSIGNED_LABEL
        let techAvatar: string | null = null
        if (aid) {
          const h = hydratedByUser.get(aid)
          techName = h?.label ?? WO_ASSIGNEE_FALLBACK_LABEL
          techAvatar = h?.avatarUrl ?? null
        } else if (tid) {
          const t = techOnlyMap.get(tid)
          techName = t?.label ?? WO_ASSIGNEE_FALLBACK_LABEL
          techAvatar = t?.avatarUrl ?? null
        }

        const equipmentName = eq
          ? getEquipmentDisplayPrimary({
              id: row.equipment_id ?? "",
              name: eq.name,
              equipment_code: eq.equipment_code,
              serial_number: eq.serial_number,
              category: eq.category,
            })
          : "Service visit"

        return {
          id: row.id,
          workOrderNumber: row.work_order_number ?? undefined,
          customerId: row.customer_id,
          customerName: customerMap.get(row.customer_id) ?? "Unknown Customer",
          equipmentId: row.equipment_id ?? "",
          equipmentName,
          location: eq?.location ?? "",
          type: mapDbType(row.type),
          status: mapDbStatus(row.status),
          priority: mapDbPriority(row.priority),
          technicianId: techId,
          technicianName: techName,
          technicianAvatarUrl: techAvatar,
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
          isArchived: Boolean(row.archived_at),
        }
      })

      if (active) setWorkOrders(mapped)
    }

    void loadWorkOrders()

    return () => {
      active = false
    }
  }, [refreshToken, orgStatus, activeOrgId, archiveScope, assignedOnlyView, permissions.canViewBilling, permissions.canViewFinancials])

  const [view, setView] = useState<ViewMode>("kanban")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | "all">("all")
  const [techFilter, setTechFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("scheduledDate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const kanbanRef = useRef<KanbanViewHandle>(null)
  const [kanbanLaneScroll, setKanbanLaneScroll] = useState({
    canScroll: false,
    showLeft: false,
    showRight: false,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [quickAppointmentOpen, setQuickAppointmentOpen] = useState(false)
  const [quickAppointmentTechnicians, setQuickAppointmentTechnicians] = useState<Array<{ id: string; label: string }>>([])
  const [createModalCustomerId, setCreateModalCustomerId] = useState<string | null>(null)
  const [createModalEquipmentId, setCreateModalEquipmentId] = useState<string | null>(null)
  const [createCatalogPartPrefill, setCreateCatalogPartPrefill] = useState<{
    catalogItemId: string
    description: string
    unitCostCents: number
    quantity?: number
  } | null>(null)

  function openCreateWorkOrderModal(customerId: string | null, equipmentId: string | null) {
    if (assignedOnlyView) return
    if (blockCreateIfNotEligible(standardCreateEligibility)) return
    setCreateModalCustomerId(customerId)
    setCreateModalEquipmentId(equipmentId)
    setCreateCatalogPartPrefill(null)
    setCreateOpen(true)
  }

  useQuickAdd("new-work-order", () => {
    if (assignedOnlyView) return
    setQuickAppointmentOpen(true)
  })

  useEffect(() => {
    if (!activeOrgId) {
      setQuickAppointmentTechnicians([])
      return
    }
    if (orgStatus !== "ready") {
      return
    }
    let active = true
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const opts = await loadTechnicianAssignOptions(supabase, activeOrgId)
      if (!active) return
      setQuickAppointmentTechnicians(toScheduleAssigneePickerOptions(opts))
    })()
    return () => {
      active = false
    }
  }, [orgStatus, activeOrgId])
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null)
  const [drawerInitialTab, setDrawerInitialTab] = useState<string | undefined>(undefined)
  const [archiveTarget, setArchiveTarget] = useState<WorkOrder | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [selectedWoIds, setSelectedWoIds] = useState<Set<string>>(() => new Set())
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const canArchiveFromList = canArchiveRestore && archiveScope === "active" && !assignedOnlyView
  const selectedCount = selectedWoIds.size

  const clearSelection = useCallback(() => {
    setSelectedWoIds(new Set())
  }, [])

  useEffect(() => {
    clearSelection()
  }, [search, statusFilter, priorityFilter, techFilter, archiveScope, view, clearSelection])

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedWoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  async function confirmListArchive() {
    if (!archiveTarget || !activeOrgId) return
    setArchiveBusy(true)
    const res = await archiveWorkOrderViaApi({
      organizationId: activeOrgId,
      workOrderId: archiveTarget.id,
    })
    setArchiveBusy(false)
    if (!res.ok) {
      toast({ variant: "destructive", title: res.message })
      return
    }
    if (selectedWoId === archiveTarget.id) {
      setSelectedWoId(null)
      setDrawerInitialTab(undefined)
    }
    setArchiveTarget(null)
    setRefreshToken((v) => v + 1)
    toast({ title: "Work order archived" })
  }

  async function confirmBulkArchive() {
    if (!activeOrgId || selectedWoIds.size === 0) return
    setArchiveBusy(true)
    const ids = [...selectedWoIds]
    const res = await bulkArchiveWorkOrdersViaApi({
      organizationId: activeOrgId,
      workOrderIds: ids,
    })
    setArchiveBusy(false)
    if (!res.ok) {
      toast({ variant: "destructive", title: res.message })
      return
    }
    setBulkArchiveOpen(false)
    if (res.succeededCount === 0) {
      toast({ variant: "destructive", title: "Could not archive selected work orders." })
      return
    }
    if (selectedWoId && ids.includes(selectedWoId) && !res.failedIds.includes(selectedWoId)) {
      setSelectedWoId(null)
      setDrawerInitialTab(undefined)
    }
    setRefreshToken((v) => v + 1)
    if (res.failedCount === 0) {
      clearSelection()
      toast({ title: bulkArchiveSuccessToast(res.succeededCount) })
      return
    }
    setSelectedWoIds(new Set(res.failedIds))
    toast({
      variant: "destructive",
      title: bulkArchivePartialToast(res.succeededCount, res.failedCount),
      description: BULK_ARCHIVE_PARTIAL_DESCRIPTION,
    })
  }

  // Auto-open drawer from ?workOrderId= or legacy ?open=
  useEffect(() => {
    const deepLinkId =
      searchParams.get("workOrderId")?.trim() || searchParams.get("open")?.trim() || null
    const rawTab = searchParams.get("tab") ?? undefined
    const tab = rawTab === "certificate" ? "certificates" : rawTab
    if (deepLinkId) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[work-orders] deep-link open drawer", {
          workOrderId: deepLinkId,
          fromParam: searchParams.get("workOrderId") ? "workOrderId" : "open",
        })
      }
      setSelectedWoId(deepLinkId)
      setDrawerInitialTab(tab)
      setArchiveScope("all")
      router.replace("/work-orders", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    const catId = searchParams.get("catalogItem")
    if (!catId || !UUID_PARAM.test(catId)) return
    if (orgStatus !== "ready" || !activeOrgId) return
    if (blockCreateIfNotEligible(standardCreateEligibility)) {
      router.replace("/work-orders", { scroll: false })
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(activeOrgId)}/catalog-items/${encodeURIComponent(catId)}`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as {
        item?: {
          id: string
          name: string
          part_number?: string | null
          cost?: number | null
          list_price?: number | null
        }
      }
      if (cancelled || !res.ok || !body.item) {
        router.replace("/work-orders", { scroll: false })
        return
      }
      const unit = body.item.cost ?? body.item.list_price ?? 0
      const cents = Math.max(0, Math.round(Number(unit) * 100))
      const desc =
        body.item.name.trim() +
        (body.item.part_number?.trim() ? ` (${body.item.part_number.trim()})` : "")
      setCreateCatalogPartPrefill({
        catalogItemId: body.item.id,
        description: desc,
        unitCostCents: cents,
        quantity: 1,
      })
      setCreateModalCustomerId(null)
      setCreateModalEquipmentId(null)
      setCreateOpen(true)
      router.replace("/work-orders", { scroll: false })
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, router, orgStatus, activeOrgId, standardCreateEligibility])

  useEffect(() => {
    const action = searchParams.get("action")
    const cid = searchParams.get("customerId")
    const eid = searchParams.get("equipmentId")
    if (action === "new-work-order") {
      if (assignedOnlyView) {
        router.replace("/work-orders", { scroll: false })
        return
      }
      if (blockCreateIfNotEligible(standardCreateEligibility)) {
        router.replace("/work-orders", { scroll: false })
        return
      }
      setCreateModalCustomerId(cid)
      setCreateModalEquipmentId(eid)
      setCreateOpen(true)
      router.replace("/work-orders", { scroll: false })
    }
  }, [searchParams, router, standardCreateEligibility, assignedOnlyView])

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
    if (!assignedOnlyView && techFilter !== "all") list = list.filter((wo) => wo.technicianId === techFilter)

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
  }, [workOrders, search, statusFilter, priorityFilter, techFilter, sortKey, sortDir, assignedOnlyView])

  const toggleAllVisibleSelection = useCallback(() => {
    const selectableIds = filtered.filter((wo) => !wo.isArchived).map((wo) => wo.id)
    if (selectableIds.length === 0) return
    setSelectedWoIds((prev) => {
      const allSelected = selectableIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(selectableIds)
    })
  }, [filtered])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

  const counts = useMemo(() => {
    const m: Partial<Record<WorkOrderStatus, number>> = {}
    workOrders.forEach((wo) => {
      if (wo.isArchived) return
      m[wo.status] = (m[wo.status] ?? 0) + 1
    })
    return m
  }, [workOrders])

  return (
    <div className="flex flex-col gap-6">
      {workOrdersLoadError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span className="font-medium">Work orders could not be loaded</span>
          <span className="mt-1 block leading-snug">{workOrdersLoadError}</span>
          {process.env.NODE_ENV === "development" ? (
            <span className="mt-2 block text-[11px] text-muted-foreground">
              Check the browser console and <code className="rounded bg-muted px-1">/api/dev/work-order-query-log</code>{" "}
              output when errors persist after refresh.
            </span>
          ) : null}
        </div>
      ) : null}

      {assignedOnlyView ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Technician view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing work orders assigned to you. Dispatch queues, archived records, and company-wide job lists are restricted
            to operations managers and admins.
          </p>
        </div>
      ) : null}

      {orgStatus === "ready" && activeOrgId ?
        <AidenOperationalInsightsCard organizationId={activeOrgId} moduleContext="work_orders" />
      : null}

      {/* Status KPI cards — responsive grid (no horizontal slider / arrows) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={cn(
              "flex w-full flex-col gap-0.5 rounded-lg border bg-card p-3 min-h-[52px] text-left transition-all hover:border-primary/40 touch-manipulation sm:min-h-0",
              statusFilter === s && "border-primary ring-1 ring-primary/20",
            )}
          >
            <span className="text-xl font-bold text-foreground sm:text-2xl">{counts[s] ?? 0}</span>
            <span className={cn("w-fit max-w-full truncate rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_STYLE[s])}>
              {s}
            </span>
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
              className="pl-9 min-h-11 lg:min-h-10"
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

            {!assignedOnlyView ? (
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
            ) : null}

            {!assignedOnlyView ? (
              <Select value={archiveScope} onValueChange={(v) => setArchiveScope(v as RecordArchiveVisibility)}>
                <SelectTrigger className="w-[132px]">
                  <SelectValue placeholder="Records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            {view === "kanban" && kanbanLaneScroll.canScroll ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 touch-manipulation"
                  disabled={!kanbanLaneScroll.showLeft}
                  aria-label="Scroll kanban lanes left"
                  onClick={() => kanbanRef.current?.scrollLanes("left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 touch-manipulation"
                  disabled={!kanbanLaneScroll.showRight}
                  aria-label="Scroll kanban lanes right"
                  onClick={() => kanbanRef.current?.scrollLanes("right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
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
                  "flex min-h-11 min-w-[44px] items-center justify-center gap-1.5 px-3 py-2 text-xs transition-colors sm:min-h-0 lg:min-w-0",
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

          {!assignedOnlyView ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setQuickAppointmentOpen(true)} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              New Appointment
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                openCreateWorkOrderModal(null, null)
              }}
              className="gap-2 shrink-0"
            >
              <Wrench className="w-4 h-4" />
              Full Work Order
            </Button>
          </div>
          ) : null}
        </div>
      </div>

      {/* Results count (non-kanban) */}
      {view !== "kanban" && (
        <p className="text-xs text-muted-foreground -mt-3">
          {filtered.length} work order{filtered.length !== 1 ? "s" : ""}
          {statusFilter !== "all" ? ` — ${statusFilter}` : ""}
        </p>
      )}

      {view === "table" && canArchiveFromList && selectedCount > 0 ? (
        <div className="hidden md:flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 -mt-1">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} selected
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8"
            onClick={() => setBulkArchiveOpen(true)}
          >
            Archive selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={clearSelection}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      {/* Views */}
      <div
        className={cn(
          "min-h-0 flex-1",
          view === "kanban" ? "overflow-x-visible overflow-y-visible pb-1" : "overflow-y-auto",
        )}
      >
        {view === "kanban" && (
          <KanbanView
            ref={kanbanRef}
            workOrders={filtered}
            onOpen={setSelectedWoId}
            onLaneScrollCapabilities={setKanbanLaneScroll}
          />
        )}
        {view === "table" && (
          <TableView
            workOrders={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onOpen={setSelectedWoId}
            canArchive={canArchiveFromList}
            onArchive={(wo) => setArchiveTarget(wo)}
            canSelect={canArchiveFromList}
            selectedIds={selectedWoIds}
            onToggleRow={toggleRowSelection}
            onToggleAllVisible={toggleAllVisibleSelection}
          />
        )}
        {view === "calendar" && <CalendarView workOrders={filtered} onOpen={setSelectedWoId} />}
      </div>

      <CreateWorkOrderModal
        open={createOpen}
        initialCustomerId={createModalCustomerId}
        initialEquipmentId={createModalEquipmentId}
        catalogPartPrefill={createCatalogPartPrefill}
        onClose={() => {
          setCreateOpen(false)
          setCreateModalCustomerId(null)
          setCreateModalEquipmentId(null)
          setCreateCatalogPartPrefill(null)
        }}
        onSuccess={() => setRefreshToken((v) => v + 1)}
      />

      <QuickAppointmentDialog
        open={quickAppointmentOpen}
        onClose={() => setQuickAppointmentOpen(false)}
        defaultDate={null}
        defaultTimeHhMm={null}
        defaultTechnicianId={null}
        technicians={quickAppointmentTechnicians}
        onCreated={() => setRefreshToken((v) => v + 1)}
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

      <QuickAddParamBridge action="new-work-order" onTrigger={() => setQuickAppointmentOpen(true)} />

      <WorkOrderArchiveDialog
        open={archiveTarget != null}
        onOpenChange={(open) => {
          if (!open && !archiveBusy) setArchiveTarget(null)
        }}
        mode="archive"
        busy={archiveBusy}
        onConfirm={() => void confirmListArchive()}
      />

      <WorkOrderArchiveDialog
        open={bulkArchiveOpen}
        onOpenChange={(open) => {
          if (!open && !archiveBusy) setBulkArchiveOpen(false)
        }}
        mode="bulk-archive"
        selectedCount={selectedCount}
        busy={archiveBusy}
        onConfirm={() => void confirmBulkArchive()}
      />
    </div>
  )
}

export default function WorkOrdersPage() {
  return <Suspense fallback={null}><WorkOrdersPageInner /></Suspense>
}
