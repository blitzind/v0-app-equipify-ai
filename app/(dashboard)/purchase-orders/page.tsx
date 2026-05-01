"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ViewToggle } from "@/components/ui/view-toggle"
import { usePurchaseOrders, PurchaseOrder, POStatus } from "@/lib/purchase-order-store"
import { PurchaseOrderDrawer } from "@/components/drawers/purchase-order-drawer"
import {
  Search, Plus, ArrowUpDown, ChevronRight,
  ShoppingCart, CheckCircle2, Clock, Truck, XCircle, AlertTriangle, Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<POStatus, { icon: React.ElementType; className: string }> = {
  Draft:               { icon: Clock,         className: "text-muted-foreground border-border" },
  Sent:                { icon: ShoppingCart,  className: "text-[color:var(--ds-info-text)] border-[color:var(--ds-info-subtle)]" },
  Approved:            { icon: CheckCircle2,  className: "text-[color:var(--ds-success-text)] border-[color:var(--ds-success-subtle)]" },
  Ordered:             { icon: Truck,         className: "text-[color:var(--ds-warning-text)] border-[color:var(--ds-warning-subtle)]" },
  "Partially Received":{ icon: AlertTriangle, className: "text-[color:var(--ds-warning-text)] border-[color:var(--ds-warning-subtle)]" },
  Received:            { icon: CheckCircle2,  className: "text-[color:var(--ds-success-text)] border-[color:var(--ds-success-subtle)]" },
  Closed:              { icon: XCircle,       className: "text-muted-foreground border-border" },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}
function fmtDate(s: string) {
  if (!s) return "—"
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type SortKey = "id" | "vendor" | "amount" | "orderDate" | "expectedDate" | "status"

function PurchaseOrdersPageInner() {
  const { orders } = usePurchaseOrders()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<POStatus | "All">("All")
  const [vendorFilter, setVendorFilter] = useState("All Vendors")
  const [sortKey, setSortKey] = useState<SortKey>("orderDate")
  const [sortAsc, setSortAsc] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)

  // ?open= deep-link support
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedId(openId)
      router.replace("/purchase-orders", { scroll: false })
    }
  }, [searchParams, router])

  const vendors = useMemo(() => {
    const set = new Set(orders.map(o => o.vendor))
    return ["All Vendors", ...Array.from(set).sort()]
  }, [orders])

  const filtered = useMemo(() => {
    let list = [...orders]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.vendor.toLowerCase().includes(q) ||
        o.workOrderId?.toLowerCase().includes(q) ||
        o.lineItems.some(li => li.description.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== "All") list = list.filter(o => o.status === statusFilter)
    if (vendorFilter !== "All Vendors") list = list.filter(o => o.vendor === vendorFilter)

    list.sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0
      if (sortKey === "id") { av = a.id; bv = b.id }
      else if (sortKey === "vendor") { av = a.vendor; bv = b.vendor }
      else if (sortKey === "amount") { av = a.amount; bv = b.amount }
      else if (sortKey === "orderDate") { av = a.orderedDate; bv = b.orderedDate }
      else if (sortKey === "expectedDate") { av = a.eta; bv = b.eta }
      else if (sortKey === "status") { av = a.status; bv = b.status }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return list
  }, [orders, search, statusFilter, vendorFilter, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const selectedOrder = orders.find(o => o.id === selectedId) ?? null

  // Summary stats
  const stats = useMemo(() => {
    const totalOpen = orders.filter(o => ["Sent", "Approved", "Ordered", "Partially Received"].includes(o.status))
    const totalValue = totalOpen.reduce((s, o) => s + o.amount, 0)
    const partialCount = orders.filter(o => o.status === "Partially Received").length
    const received = orders.filter(o => o.status === "Received").length
    return { openCount: totalOpen.length, totalValue, partialCount, received }
  }, [orders])

  function SortBtn({ col }: { col: SortKey }) {
    return (
      <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        <ArrowUpDown className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track vendor orders for parts, materials, and supplies</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Open Orders",       value: stats.openCount,              sub: "Sent / Approved / Ordered" },
          { label: "Open Value",        value: fmtCurrency(stats.totalValue), sub: "Across all open POs" },
          { label: "Partially Received",value: stats.partialCount,            sub: "Awaiting remaining items" },
          { label: "Received",          value: stats.received,               sub: "Fully received" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-card rounded-xl border border-border px-4 py-3 flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground ds-tabular">{value}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search orders, vendors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as POStatus | "All")}>
          <SelectTrigger className="h-9 w-36 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            {(Object.keys(STATUS_CONFIG) as POStatus[]).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="h-9 w-44 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Button size="sm" className="gap-2 cursor-pointer" onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New PO</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Card view */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
              No purchase orders match the current filters.
            </div>
          ) : filtered.map(po => {
            const cfg = STATUS_CONFIG[po.status]
            const StatusIcon = cfg.icon
            return (
              <div
                key={po.id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 group"
                onClick={() => setSelectedId(po.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2">{po.id}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5 truncate max-w-[200px]">{po.vendor}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-semibold gap-1 shrink-0", cfg.className)}>
                    <StatusIcon className="w-3 h-3" />
                    {po.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{po.lineItems.length} line item{po.lineItems.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-lg font-bold text-foreground ds-tabular">{fmtCurrency(po.amount)}</span>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">ETA</p>
                    <p className={cn("text-xs font-medium ds-tabular", "text-foreground")}>
                      {fmtDate(po.eta)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center gap-1">PO # <SortBtn col="id" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center gap-1">Vendor <SortBtn col="vendor" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Work Order</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center gap-1">Order Date <SortBtn col="orderDate" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    <span className="flex items-center gap-1">Expected <SortBtn col="expectedDate" /></span>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">Amount <SortBtn col="amount" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                      No purchase orders match the current filters.
                    </td>
                  </tr>
                ) : filtered.map(po => {
                  const cfg = STATUS_CONFIG[po.status]
                  const StatusIcon = cfg.icon
                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => setSelectedId(po.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2 whitespace-nowrap">
                        {po.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">{po.vendor}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                        {po.workOrderId || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap ds-tabular">{fmtDate(po.orderedDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap ds-tabular hidden lg:table-cell text-muted-foreground">
                        {fmtDate(po.eta)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground ds-tabular whitespace-nowrap">
                        {fmtCurrency(po.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold gap-1", cfg.className)}>
                          <StatusIcon className="w-3 h-3" />
                          {po.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Drawer */}
      <PurchaseOrderDrawer
        purchaseOrderId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

export default function PurchaseOrdersPage() {
  return <Suspense fallback={null}><PurchaseOrdersPageInner /></Suspense>
}
