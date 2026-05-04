"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ViewToggle } from "@/components/ui/view-toggle"
import { usePurchaseOrders, POStatus } from "@/lib/purchase-order-store"
import { PurchaseOrderDrawer } from "@/components/drawers/purchase-order-drawer"
import { AddVendorModal } from "@/components/vendors/add-vendor-modal"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  Search, Plus, ArrowUpDown, ChevronRight,
  ShoppingCart, CheckCircle2, Clock, Truck, XCircle, AlertTriangle, Building2, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getWorkOrderDisplay, workOrderMatchesSearch } from "@/lib/work-orders/display"

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
type DraftLineItem = { description: string; quantity: number; unitCostCents: number; lineTotalCents: number }
type NewPoDraft = {
  vendorId?: string
  vendor: string
  vendorEmail: string
  vendorPhone: string
  vendorContactName: string
  shipTo: string
  billTo: string
  orderedDate: string
  eta: string
  notes: string
  lineItems: DraftLineItem[]
}

function emptyNewPoDraft(): NewPoDraft {
  return {
    vendorId: undefined,
    vendor: "",
    vendorEmail: "",
    vendorPhone: "",
    vendorContactName: "",
    shipTo: "",
    billTo: "",
    orderedDate: new Date().toISOString().slice(0, 10),
    eta: "",
    notes: "",
    lineItems: [{ description: "", quantity: 1, unitCostCents: 0, lineTotalCents: 0 }],
  }
}

type VendorRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  contact_name: string | null
  billing_address: string | null
  shipping_address: string | null
}

function PurchaseOrdersPageInner() {
  const { orders, loading, error, addOrder } = usePurchaseOrders()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<POStatus | "All">("All")
  const [vendorFilter, setVendorFilter] = useState("All Vendors")
  const [sortKey, setSortKey] = useState<SortKey>("orderDate")
  const [sortAsc, setSortAsc] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newDraft, setNewDraft] = useState<NewPoDraft>(emptyNewPoDraft())
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(false)
  const [vendorQuery, setVendorQuery] = useState("")
  const [vendorMenuOpen, setVendorMenuOpen] = useState(false)
  const [addVendorOpen, setAddVendorOpen] = useState(false)

  function computeLineTotalCents(quantity: number, unitCostCents: number): number {
    return Math.round(quantity * unitCostCents)
  }

  function fmtCurrencyFromCents(cents: number): string {
    return fmtCurrency((Number.isFinite(cents) ? cents : 0) / 100)
  }

  // ?open= deep-link support
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedId(openId)
      router.replace("/purchase-orders", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (!createOpen || orgStatus !== "ready" || !organizationId) return
    let cancelled = false
    setVendorsLoading(true)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("org_vendors")
        .select("id, name, email, phone, contact_name, billing_address, shipping_address")
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .order("name")
      if (cancelled) return
      setVendors((data ?? []) as VendorRow[])
      setVendorsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [createOpen, orgStatus, organizationId])

  const uniqueVendors = useMemo(() => {
    const set = new Set(orders.map(o => o.vendor))
    return ["All Vendors", ...Array.from(set).sort()]
  }, [orders])

  const filtered = useMemo(() => {
    let list = [...orders]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.purchaseOrderNumber.toLowerCase().includes(q) ||
        o.vendor.toLowerCase().includes(q) ||
        o.workOrderId?.toLowerCase().includes(q) ||
        o.lineItems.some(li => li.description.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== "All") list = list.filter(o => o.status === statusFilter)
    if (vendorFilter !== "All Vendors") list = list.filter(o => o.vendor === vendorFilter)

    list.sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0
      if (sortKey === "id") { av = a.purchaseOrderNumber; bv = b.purchaseOrderNumber }
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

  function handleStartCreatePo() {
    setNewDraft(emptyNewPoDraft())
    setVendorQuery("")
    setVendorMenuOpen(false)
    setCreateOpen(true)
  }

  function selectVendor(vendor: VendorRow) {
    setNewDraft((d) => ({
      ...d,
      vendorId: vendor.id,
      vendor: vendor.name,
      vendorEmail: vendor.email ?? "",
      vendorPhone: vendor.phone ?? "",
      vendorContactName: vendor.contact_name ?? "",
      billTo: vendor.billing_address ?? d.billTo,
      shipTo: vendor.shipping_address ?? d.shipTo,
    }))
    setVendorQuery(vendor.name)
    setVendorMenuOpen(false)
  }

  async function handleCreatePo() {
    setCreatingNew(true)
    const { id, error: createError } = await addOrder({
      vendorId: newDraft.vendorId,
      vendor: newDraft.vendor.trim() || "New Vendor",
      vendorEmail: newDraft.vendorEmail,
      vendorPhone: newDraft.vendorPhone,
      vendorContactName: newDraft.vendorContactName,
      shipTo: newDraft.shipTo,
      billTo: newDraft.billTo,
      status: "Draft",
      orderedDate: newDraft.orderedDate,
      eta: newDraft.eta,
      notes: newDraft.notes,
      lineItems: newDraft.lineItems,
    })
    setCreatingNew(false)
    if (createError) return
    setCreateOpen(false)
    if (id) setSelectedId(id)
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading purchase orders...
        </div>
      )}

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
            {uniqueVendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Button size="sm" className="gap-2 cursor-pointer" onClick={handleStartCreatePo}>
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
                    <p className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2">{po.purchaseOrderNumber || "PO"}</p>
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
                        {po.purchaseOrderNumber || "PO"}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">{po.vendor}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                        {po.workOrderId ? getWorkOrderDisplay({ id: po.workOrderId }) : "—"}
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
        orderId={selectedId}
        onClose={() => {
          setSelectedId(null)
        }}
      />

      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !creatingNew && setCreateOpen(false)} />
          <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Create Purchase Order</h3>
              <button
                type="button"
                onClick={() => !creatingNew && setCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Information</p>
                <div className="relative">
                  <label className="text-xs font-medium text-foreground block mb-1">Vendor Name</label>
                  <Input
                    placeholder={vendorsLoading ? "Loading vendors..." : "Search vendor..."}
                    value={vendorQuery}
                    onFocus={() => setVendorMenuOpen(true)}
                    onChange={(e) => {
                      setVendorQuery(e.target.value)
                      setVendorMenuOpen(true)
                      setNewDraft((d) => ({ ...d, vendorId: undefined, vendor: e.target.value }))
                    }}
                  />
                  {vendorMenuOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-56 overflow-y-auto">
                      {vendors
                        .filter((v) => v.name.toLowerCase().includes(vendorQuery.toLowerCase()))
                        .map((vendor) => (
                          <button
                            key={vendor.id}
                            type="button"
                            onClick={() => selectVendor(vendor)}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60 text-sm"
                          >
                            <div className="font-medium">{vendor.name}</div>
                            {vendor.email && <div className="text-xs text-muted-foreground">{vendor.email}</div>}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => {
                          setVendorMenuOpen(false)
                          setAddVendorOpen(true)
                        }}
                        className="w-full text-left px-3 py-2 border-t border-border text-sm text-primary hover:bg-muted/60"
                      >
                        + Add New Vendor
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Select an existing vendor or add a new one</p>
              </div>

              <div className="rounded-lg border border-border bg-muted/15 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Vendor Email</label>
                    <Input type="email" value={newDraft.vendorEmail} onChange={(e) => setNewDraft((d) => ({ ...d, vendorEmail: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Vendor Phone</label>
                    <Input value={newDraft.vendorPhone} onChange={(e) => setNewDraft((d) => ({ ...d, vendorPhone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Contact Name</label>
                    <Input value={newDraft.vendorContactName} onChange={(e) => setNewDraft((d) => ({ ...d, vendorContactName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Billing Address</label>
                    <Input value={newDraft.billTo} onChange={(e) => setNewDraft((d) => ({ ...d, billTo: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-foreground block mb-1">Shipping Address</label>
                    <Input value={newDraft.shipTo} onChange={(e) => setNewDraft((d) => ({ ...d, shipTo: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Order Date</label>
                    <Input type="date" value={newDraft.orderedDate} onChange={(e) => setNewDraft((d) => ({ ...d, orderedDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Expected Delivery Date</label>
                    <Input type="date" value={newDraft.eta} onChange={(e) => setNewDraft((d) => ({ ...d, eta: e.target.value }))} />
                    <p className="text-[11px] text-muted-foreground mt-1">Estimated arrival date from vendor</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
                <div className="grid grid-cols-[1fr_90px_120px_120px_32px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
                  <span>Description</span>
                  <span className="text-right">Quantity</span>
                  <span className="text-right">Unit Cost</span>
                  <span className="text-right">Line Total</span>
                  <span />
                </div>
                {newDraft.lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_90px_120px_120px_32px] gap-2 items-center">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        setNewDraft((d) => ({
                          ...d,
                          lineItems: d.lineItems.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) =>
                        setNewDraft((d) => ({
                          ...d,
                          lineItems: d.lineItems.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  quantity: Number(e.target.value) || 0,
                                  lineTotalCents: computeLineTotalCents(
                                    Number(e.target.value) || 0,
                                    x.unitCostCents,
                                  ),
                                }
                              : x,
                          ),
                        }))
                      }
                      className="text-right"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={(item.unitCostCents / 100).toFixed(2)}
                      onChange={(e) =>
                        setNewDraft((d) => ({
                          ...d,
                          lineItems: d.lineItems.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  unitCostCents: Math.round((Number(e.target.value) || 0) * 100),
                                  lineTotalCents: computeLineTotalCents(
                                    x.quantity,
                                    Math.round((Number(e.target.value) || 0) * 100),
                                  ),
                                }
                              : x,
                          ),
                        }))
                      }
                      className="text-right"
                    />
                    <div className="text-sm text-right font-medium text-foreground">
                      {fmtCurrencyFromCents(item.lineTotalCents)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNewDraft((d) => ({
                          ...d,
                          lineItems: d.lineItems.filter((_, i) => i !== idx),
                        }))
                      }
                      className="inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setNewDraft((d) => ({
                      ...d,
                      lineItems: [
                        ...d.lineItems,
                        { description: "", quantity: 1, unitCostCents: 0, lineTotalCents: 0 },
                      ],
                    }))
                  }
                  className="text-xs text-primary hover:underline"
                >
                  + Add line item
                </button>
                <div className="flex justify-end border-t border-border pt-2 mt-1">
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subtotal</p>
                    <p className="text-sm font-bold text-foreground">
                      {fmtCurrencyFromCents(
                        newDraft.lineItems.reduce((sum, li) => sum + li.lineTotalCents, 0),
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
                <textarea
                  rows={4}
                  value={newDraft.notes}
                  onChange={(e) => setNewDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Add notes..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(false)} disabled={creatingNew}>Cancel</Button>
              <Button size="sm" onClick={() => void handleCreatePo()} disabled={creatingNew}>
                {creatingNew ? "Creating..." : "Create PO"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddVendorModal
        open={addVendorOpen}
        onClose={() => setAddVendorOpen(false)}
        initialName={vendorQuery}
        onSaved={(vendor) => {
          const row = vendor as VendorRow
          setVendors((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
          selectVendor(row)
        }}
      />
    </div>
  )
}

export default function PurchaseOrdersPage() {
  return <Suspense fallback={null}><PurchaseOrdersPageInner /></Suspense>
}
