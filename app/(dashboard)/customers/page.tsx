"use client"

import { useState, useMemo } from "react"
import { useCustomers } from "@/lib/customer-store"
import type { Customer } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import { AddCustomerModal } from "@/components/customers/add-customer-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Card, CardContent } from "@/components/ui/card"
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  ArrowUpDown,
  Building2,
  MapPin,
  Wrench,
  ClipboardList,
  ChevronRight,
} from "lucide-react"
import { CustomerDrawer } from "@/components/drawers/customer-drawer"
import { ContactActions } from "@/components/contact-actions"

type SortKey = "company" | "equipmentCount" | "openWorkOrders" | "joinedDate"
type SortDir = "asc" | "desc"
type ViewMode = "table" | "card"

function StatusBadge({ status }: { status: Customer["status"] }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-medium",
        status === "Active"
          ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
          : "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  )
}

function CustomerCard({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  return (
    <Card onClick={onOpen} className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-semibold text-sm shrink-0">
                {customer.company.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                  {customer.company}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{customer.name}</p>
              </div>
            </div>
            <StatusBadge status={customer.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{customer.locations.length} location{customer.locations.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>{customer.equipmentCount} equipment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 shrink-0" />
              <span className={cn(customer.openWorkOrders > 0 ? "text-[color:var(--status-warning)] font-medium" : "")}>
                {customer.openWorkOrders} open WOs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>{customer.contracts.length} contract{customer.contracts.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Quick contact actions */}
          {(customer.locations[0] || customer.contacts[0]) && (
            <div className="mt-4 pt-3 border-t border-border">
              <ContactActions
                address={customer.locations[0] ? `${customer.locations[0].address}, ${customer.locations[0].city}, ${customer.locations[0].state} ${customer.locations[0].zip}` : undefined}
                email={customer.contacts[0] ? {
                  customerName: customer.company,
                  customerEmail: customer.contacts[0].email,
                } : undefined}
                phone={customer.contacts[0]?.phone}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Since {new Date(customer.joinedDate).getFullYear()}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
  )
}

export default function CustomersPage() {
  const { customers } = useCustomers()
  const [showAddModal, setShowAddModal] = useState(false)
  useQuickAdd("new-customer", () => setShowAddModal(true))
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all")
  const [sortKey, setSortKey] = useState<SortKey>("company")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...customers]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.locations.some((l) => l.city.toLowerCase().includes(q))
      )
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter)
    }

    list.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number
      let bv: string | number = b[sortKey] as string | number
      if (typeof av === "string" && typeof bv === "string") {
        av = av.toLowerCase()
        bv = bv.toLowerCase()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return list
  }, [search, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-muted-foreground/50 inline" />
    return (
      <ArrowUpDown
        className={cn(
          "w-3.5 h-3.5 ml-1 inline",
          sortDir === "asc" ? "text-primary" : "text-primary rotate-180"
        )}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-1.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-32 sm:w-36 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
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

        <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground -mt-2">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{customers.length}</span> customers
      </p>

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>
                  <button
                    onClick={() => toggleSort("company")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Company <SortIcon col="company" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locations</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("equipmentCount")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Equipment <SortIcon col="equipmentCount" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("openWorkOrders")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Open WOs <SortIcon col="openWorkOrders" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contracts</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("joinedDate")}
                    className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Joined <SortIcon col="joinedDate" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No customers match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="group cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedCustomerId(c.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-semibold text-xs shrink-0">
                          {c.company.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                            {c.company}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.locations.length}</TableCell>
                    <TableCell className="text-sm text-foreground font-medium">{c.equipmentCount}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-sm font-medium",
                        c.openWorkOrders > 0 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
                      )}>
                        {c.openWorkOrders}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.contracts.length}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="w-[160px]">
                      <div className="flex justify-end">
                        <ContactActions
                          address={c.locations[0] ? `${c.locations[0].address}, ${c.locations[0].city}, ${c.locations[0].state} ${c.locations[0].zip}` : undefined}
                          email={c.contacts[0] ? { customerName: c.company, customerEmail: c.contacts[0].email } : undefined}
                          phone={c.contacts[0]?.phone}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No customers match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <CustomerCard key={c.id} customer={c} onOpen={() => setSelectedCustomerId(c.id)} />
              ))}
            </div>
          )}
        </>
      )}

      <CustomerDrawer
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />

      <AddCustomerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <QuickAddParamBridge action="new-customer" onTrigger={() => setShowAddModal(true)} />
    </div>
  )
}
