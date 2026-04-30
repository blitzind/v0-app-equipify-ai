"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { equipment } from "@/lib/mock-data"
import type { Equipment } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  ArrowUpDown,
  ChevronRight,
  Wrench,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Download,
  Tag,
} from "lucide-react"

type SortKey = "model" | "customerName" | "nextDueDate" | "lastServiceDate" | "category"
type SortDir = "asc" | "desc"
type ViewMode = "table" | "card"

const statusColors: Record<Equipment["status"], string> = {
  "Active": "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

const allStatuses = ["Active", "Needs Service", "In Repair", "Out of Service"] as const
const allCategories = [...new Set(equipment.map((e) => e.category))].sort()

/** Format an ISO date string (YYYY-MM-DD) using UTC so server and client agree. */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  })
}

function daysToDue(nextDueDate: string) {
  // Compare UTC midnight of the due date against UTC midnight of today.
  const due   = new Date(nextDueDate + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

function DueBadge({ nextDueDate }: { nextDueDate: string }) {
  const days = daysToDue(nextDueDate)
  if (days < 0) return <span className="text-xs font-medium text-destructive">Overdue</span>
  if (days <= 7) return <span className="text-xs font-medium text-[color:var(--status-warning)]">Due in {days}d</span>
  if (days <= 30) return <span className="text-xs font-medium text-[color:var(--status-info)]">Due in {days}d</span>
  return <span className="text-xs text-muted-foreground">{fmtDate(nextDueDate)}</span>
}

function EquipmentCard({ eq, selected, onSelect }: { eq: Equipment; selected: boolean; onSelect: () => void }) {
  const days = daysToDue(eq.nextDueDate)
  const urgent = days < 0 || days <= 7

  return (
    <Card className={cn("relative hover:border-primary/40 hover:shadow-sm transition-all group", selected && "border-primary/60 ring-1 ring-primary/20")}>
      <CardContent className="p-5">
        {/* Checkbox */}
        <div className="absolute top-4 left-4">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            onClick={(e) => e.stopPropagation()}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        <div className="pl-7">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{eq.model}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{eq.id} &middot; {eq.manufacturer}</p>
            </div>
            <Badge variant="secondary" className={cn("text-xs shrink-0", statusColors[eq.status])}>
              {eq.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 col-span-2">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <Link href={`/customers/${eq.customerId}`} className="hover:text-primary transition-colors truncate" onClick={(e) => e.stopPropagation()}>
                {eq.customerName}
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{eq.category}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{eq.location}</span>
            </div>
          </div>

          <div className={cn(
            "flex items-center justify-between mt-4 pt-3 border-t border-border text-xs",
            urgent ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
          )}>
            <div className="flex items-center gap-1.5">
              {urgent && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
              <Calendar className={cn("w-3.5 h-3.5 shrink-0", urgent && "hidden")} />
              <DueBadge nextDueDate={eq.nextDueDate} />
            </div>
            <Link href={`/equipment/${eq.id}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
              View <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function EquipmentPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("nextDueDate")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let list = [...equipment]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          e.model.toLowerCase().includes(q) ||
          e.customerName.toLowerCase().includes(q) ||
          e.serialNumber.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      list = list.filter((e) => e.status === statusFilter)
    }

    if (categoryFilter !== "all") {
      list = list.filter((e) => e.category === categoryFilter)
    }

    list.sort((a, b) => {
      const av = a[sortKey] as string
      const bv = b[sortKey] as string
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    return list
  }, [search, statusFilter, categoryFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((e) => e.id)))
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-muted-foreground/50 inline" />
    return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline text-primary" />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48 max-w-sm rounded-md border border-border bg-card px-3 py-1.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {allStatuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
            aria-label="Table view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              viewMode === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
            aria-label="Card view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        <Button size="sm" className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Add Equipment
        </Button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Tag className="w-3.5 h-3.5" /> Assign Plan
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-sm text-muted-foreground -mt-2">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{equipment.length}</span> equipment
      </p>

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("model")} className="ds-btn-sort">
                    Model <SortIcon col="model" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("customerName")} className="ds-btn-sort">
                    Customer <SortIcon col="customerName" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("category")} className="ds-btn-sort">
                    Category <SortIcon col="category" />
                  </button>
                </TableHead>
                <TableHead className="ds-btn-sort pointer-events-none">Status</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("lastServiceDate")} className="ds-btn-sort">
                    Last Service <SortIcon col="lastServiceDate" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("nextDueDate")} className="ds-btn-sort">
                    Next Due <SortIcon col="nextDueDate" />
                  </button>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No equipment matches your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((eq) => (
                  <TableRow key={eq.id} className={cn("group cursor-pointer hover:bg-muted/30 transition-colors", selected.has(eq.id) && "bg-primary/5")}>
                    <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(eq.id) }}>
                      <Checkbox
                        checked={selected.has(eq.id)}
                        onCheckedChange={() => toggleSelect(eq.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/equipment/${eq.id}`} className="flex flex-col">
                        <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{eq.model}</span>
                        <span className="text-xs text-muted-foreground">{eq.id} &middot; S/N: {eq.serialNumber}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${eq.customerId}`} className="text-sm text-foreground hover:text-primary transition-colors">
                        {eq.customerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{eq.category}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs", statusColors[eq.status])}>
                        {eq.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(eq.lastServiceDate)}
                    </TableCell>
                    <TableCell>
                      <DueBadge nextDueDate={eq.nextDueDate} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/equipment/${eq.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          View <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No equipment matches your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((eq) => (
                <EquipmentCard
                  key={eq.id}
                  eq={eq}
                  selected={selected.has(eq.id)}
                  onSelect={() => toggleSelect(eq.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
