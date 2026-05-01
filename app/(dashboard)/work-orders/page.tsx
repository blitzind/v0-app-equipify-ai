"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useWorkOrders } from "@/lib/work-order-store"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from "@/lib/mock-data"
import { CreateWorkOrderModal } from "@/components/work-orders/create-work-order-modal"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
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
  User,
  Clock,
  ChevronRight as Arrow,
  AlertTriangle,
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "Completed", "Invoiced"]

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":   "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Invoiced":    "bg-muted text-muted-foreground border-border",
}

const PRIORITY_STYLE: Record<WorkOrderPriority, string> = {
  "Low":      "text-muted-foreground",
  "Normal":   "text-foreground",
  "High":     "text-[color:var(--status-warning)]",
  "Critical": "text-destructive font-semibold",
}

const KANBAN_COLUMNS: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "Completed", "Invoiced"]

const KANBAN_HEADER: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/8 border-[color:var(--status-info)]/20",
  "Scheduled":   "bg-[color:var(--status-info)]/12 border-[color:var(--status-info)]/18",
  "In Progress": "bg-[color:var(--status-warning)]/8 border-[color:var(--status-warning)]/20",
  "Completed":   "bg-[color:var(--status-success)]/8 border-[color:var(--status-success)]/20",
  "Invoiced":    "bg-muted/50 border-border",
}

type ViewMode = "kanban" | "table" | "calendar"
type SortKey = "id" | "customerName" | "scheduledDate" | "priority" | "status"

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

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({ wo, onOpen }: { wo: WorkOrder; onOpen: () => void }) {
  return (
    <div onClick={onOpen} className="bg-card border border-border rounded-lg p-3.5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">{wo.id}</span>
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3 h-3 shrink-0" />
            <span>{wo.technicianName}</span>
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
                <span className="font-mono text-xs text-primary hover:underline">{wo.id}</span>
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
              <TableCell className="text-sm text-muted-foreground">{wo.technicianName}</TableCell>
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
                        <div className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded truncate border cursor-pointer hover:opacity-80 transition-opacity",
                          STATUS_STYLE[wo.status]
                        )}>
                          {wo.id} · {wo.technicianName.split(" ")[0]}
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
  const { workOrders } = useWorkOrders()

  const [view, setView] = useState<ViewMode>("kanban")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | "all">("all")
  const [techFilter, setTechFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("scheduledDate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [createOpen, setCreateOpen] = useState(false)
  useQuickAdd("new-work-order", () => setCreateOpen(true))
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Auto-open drawer from ?open= query param
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedWoId(openId)
      router.replace("/work-orders", { scroll: false })
    }
  }, [searchParams, router])

  const allTechs = useMemo(() => {
    const seen = new Set<string>()
    return workOrders
      .map((wo) => ({ id: wo.technicianId, name: wo.technicianName }))
      .filter(({ id }) => (seen.has(id) ? false : seen.add(id)))
  }, [workOrders])

  const filtered = useMemo(() => {
    let list = [...workOrders]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (wo) =>
          wo.id.toLowerCase().includes(q) ||
          wo.customerName.toLowerCase().includes(q) ||
          wo.equipmentName.toLowerCase().includes(q) ||
          wo.technicianName.toLowerCase().includes(q) ||
          wo.description.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "all") list = list.filter((wo) => wo.status === statusFilter)
    if (priorityFilter !== "all") list = list.filter((wo) => wo.priority === priorityFilter)
    if (techFilter !== "all") list = list.filter((wo) => wo.technicianId === techFilter)

    const priorityOrder: Record<WorkOrderPriority, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 }
    list.sort((a, b) => {
      let av: string | number = a[sortKey] ?? ""
      let bv: string | number = b[sortKey] ?? ""
      if (sortKey === "priority") { av = priorityOrder[a.priority]; bv = priorityOrder[b.priority] }
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
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:min-w-0 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority filter */}
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

          {/* Technician filter */}
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-36 sm:w-44">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {allTechs.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-border rounded-md overflow-hidden">
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

        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Work Order
        </Button>
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

      <CreateWorkOrderModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <WorkOrderDrawer
        workOrderId={selectedWoId}
        onClose={() => setSelectedWoId(null)}
      />

      <QuickAddParamBridge action="new-work-order" onTrigger={() => setCreateOpen(true)} />
    </div>
  )
}

export default function WorkOrdersPage() {
  return <Suspense fallback={null}><WorkOrdersPageInner /></Suspense>
}
