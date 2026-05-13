"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useInvoices, type RecordArchiveVisibility } from "@/lib/quote-invoice-store"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { ViewToggle } from "@/components/ui/view-toggle"
import {
  Search, Plus, ArrowUpDown, ChevronRight,
  Receipt, CheckCircle2, AlertTriangle, Clock, FilePen, Ban, Send, Building2, Wrench,
} from "lucide-react"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { InvoiceDrawer } from "@/components/drawers/invoice-drawer"
import { getWorkOrderDisplay, workOrderMatchesSearch } from "@/lib/work-orders/display"
import { NewInvoiceModal } from "@/components/invoices/new-invoice-modal"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { PermissionGate } from "@/components/permissions/permission-gate"
import { RestrictedNotice } from "@/components/permissions/restricted-notice"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { paymentAllocationUiLabel } from "@/lib/billing/invoice-payment-allocation"
import { FinancialInvoiceReportSection } from "@/components/reporting/financial-invoice-report-section"
import { INVOICE_STATUS_BADGE_CLASSNAME } from "@/lib/invoices/invoice-status-badge-classes"

const UUID_PARAM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function invoiceDisplayId(inv: AdminInvoice) {
  return inv.invoiceNumber?.trim() || "Invoice"
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: React.ElementType }> = {
  Draft: {
    label: "Draft",
    className: INVOICE_STATUS_BADGE_CLASSNAME.Draft,
    icon: FilePen,
  },
  Sent: {
    label: "Sent",
    className: INVOICE_STATUS_BADGE_CLASSNAME.Sent,
    icon: Send,
  },
  Unpaid: {
    label: "Unpaid",
    className: INVOICE_STATUS_BADGE_CLASSNAME.Unpaid,
    icon: Clock,
  },
  Paid: {
    label: "Paid",
    className: INVOICE_STATUS_BADGE_CLASSNAME.Paid,
    icon: CheckCircle2,
  },
  Overdue: {
    label: "Overdue",
    className: INVOICE_STATUS_BADGE_CLASSNAME.Overdue,
    icon: AlertTriangle,
  },
  Void: {
    label: "Void",
    className: cn(INVOICE_STATUS_BADGE_CLASSNAME.Void, "line-through"),
    icon: Ban,
  },
}

const ALL_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Unpaid", "Paid", "Overdue", "Void"]

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function InvoiceStatCards({ invoices }: { invoices: AdminInvoice[] }) {
  const unpaid      = invoices.filter(i => i.status === "Unpaid" || i.status === "Sent")
  const overdue     = invoices.filter(i => i.status === "Overdue")
  const paid        = invoices.filter(i => i.status === "Paid")
  const unpaidValue = unpaid.reduce((s, i) => s + i.amount, 0)
  const overdueVal  = overdue.reduce((s, i) => s + i.amount, 0)
  const paidValue   = paid.reduce((s, i) => s + i.amount, 0)
  const totalValue  = invoices.filter(i => i.status !== "Void").reduce((s, i) => s + i.amount, 0)

  const stats = [
    { label: "Outstanding",   value: fmtCurrency(unpaidValue), sub: `${unpaid.length} invoice${unpaid.length !== 1 ? "s" : ""} unpaid`,  icon: Clock,         accent: "text-[color:var(--status-warning)]", bg: "bg-[color:var(--status-warning)]/10" },
    { label: "Overdue",       value: fmtCurrency(overdueVal),  sub: `${overdue.length} invoice${overdue.length !== 1 ? "s" : ""} past due`, icon: AlertTriangle, accent: "text-destructive",                   bg: "bg-destructive/10" },
    { label: "Collected",     value: fmtCurrency(paidValue),   sub: `${paid.length} invoice${paid.length !== 1 ? "s" : ""} paid`,         icon: CheckCircle2,  accent: "text-[color:var(--status-success)]", bg: "bg-[color:var(--status-success)]/10" },
    { label: "Total Invoiced", value: fmtCurrency(totalValue), sub: "all active invoices",                                                icon: Receipt,       accent: "text-primary",                       bg: "bg-primary/10" },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
      {stats.map(({ label, value, sub, icon: Icon, accent, bg }) => (
        <div key={label} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2 justify-between shadow-[0_1px_3px_rgba(0,0,0,0.06)] h-full">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("w-3.5 h-3.5", accent)} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground ds-tabular">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold", cfg.className)}>
      {status}
    </Badge>
  )
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

type SortKey = "id" | "customerName" | "amount" | "issueDate" | "dueDate" | "status"

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  return (
    <ArrowUpDown className={cn(
      "w-3.5 h-3.5 ml-1 inline transition-colors",
      sortKey === col ? "text-primary" : "text-muted-foreground/40"
    )} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function InvoicesPageInner() {
  const {
    invoices,
    loading,
    error,
    refreshInvoices,
    invoicesListVisibility,
    setInvoicesListVisibility,
  } = useInvoices()
  const { toast } = useToast()
  const { standardCreateEligibility } = useBillingAccess()
  const { organizationId: activeOrgId, status: activeOrgStatus } = useActiveOrganization()
  const { permissions: orgPermissions } = useOrgPermissions()
  const canViewFinancials = orgPermissions.canViewFinancials
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [invoicePrefillWo, setInvoicePrefillWo] = useState<string | undefined>(undefined)
  const [invoicePrefillCal, setInvoicePrefillCal] = useState<string | undefined>(undefined)
  const [catalogPrefill, setCatalogPrefill] = useState<{
    catalogItemId: string
    name: string
    description?: string | null
    unitPrice: number
    partNumber?: string | null
  } | null>(null)

  function openNewInvoiceModal(prefillWo?: string, prefillCal?: string) {
    if (blockCreateIfNotEligible(standardCreateEligibility)) return
    setInvoicePrefillWo(prefillWo)
    setInvoicePrefillCal(prefillCal)
    setNewModalOpen(true)
  }

  useQuickAdd("new-invoice", () => openNewInvoiceModal(undefined, undefined))
  const [search, setSearch]           = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all")
  const [sortKey, setSortKey]         = useState<SortKey>("issueDate")
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const searchParams = useSearchParams()
  const router = useRouter()

  // Auto-open drawer from ?open= query param (include archived rows so the drawer resolves)
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedInvoiceId(openId)
      setInvoicesListVisibility("all")
      router.replace("/invoices", { scroll: false })
    }
  }, [searchParams, router, setInvoicesListVisibility])

  useEffect(() => {
    const action = searchParams.get("action")
    if (action !== "new-invoice") return
    if (blockCreateIfNotEligible(standardCreateEligibility)) {
      router.replace("/invoices", { scroll: false })
      return
    }
    const wo = searchParams.get("workOrderId") ?? undefined
    const cal = searchParams.get("calibrationRecordId") ?? undefined
    setInvoicePrefillWo(wo)
    setInvoicePrefillCal(cal)
    setCatalogPrefill(null)
    setNewModalOpen(true)
    router.replace("/invoices", { scroll: false })
  }, [searchParams, router, standardCreateEligibility])

  useEffect(() => {
    const catId = searchParams.get("catalogItem")
    if (!catId || !UUID_PARAM.test(catId)) return
    if (activeOrgStatus !== "ready" || !activeOrgId) return
    if (blockCreateIfNotEligible(standardCreateEligibility)) {
      router.replace("/invoices", { scroll: false })
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
          description?: string | null
          list_price?: number | null
          sale_price?: number | null
          part_number?: string | null
        }
      }
      if (cancelled || !res.ok || !body.item) {
        router.replace("/invoices", { scroll: false })
        return
      }
      const unit = body.item.sale_price ?? body.item.list_price ?? 0
      setCatalogPrefill({
        catalogItemId: body.item.id,
        name: body.item.name,
        description: body.item.description ?? null,
        unitPrice: Number(unit) || 0,
        partNumber: body.item.part_number ?? null,
      })
      setInvoicePrefillWo(undefined)
      setInvoicePrefillCal(undefined)
      setNewModalOpen(true)
      router.replace("/invoices", { scroll: false })
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, router, activeOrgId, activeOrgStatus, standardCreateEligibility])

  useEffect(() => {
    const s = searchParams.get("status")
    if (s && (ALL_STATUSES as readonly string[]).includes(s)) {
      setStatusFilter(s as InvoiceStatus)
    }
  }, [searchParams])

  /** Invoicing Phase 3 — optional customer scoping (deep links from customer billing tab). */
  const customerIdFilter = useMemo(() => {
    const raw = searchParams.get("customerId") ?? ""
    return UUID_PARAM.test(raw) ? raw : ""
  }, [searchParams])

  const invoicesForStats = useMemo(() => invoices.filter((i) => !i.isArchived), [invoices])

  const filtered = useMemo(() => {
    let list = [...invoices]

    if (customerIdFilter) {
      list = list.filter((inv) => inv.customerId === customerIdFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (inv) =>
          inv.id.toLowerCase().includes(q) ||
          (inv.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.equipmentName.toLowerCase().includes(q) ||
          workOrderMatchesSearch(search, {
            id: inv.workOrderId,
            customerName: inv.customerName,
            equipmentName: inv.equipmentName,
            technicianName: "",
            description: inv.notes ?? "",
          }),
      )
    }
    if (statusFilter !== "all") {
      list = list.filter(inv => inv.status === statusFilter)
    }

    list.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number
      let bv: string | number = b[sortKey] as string | number
      if (typeof av === "string" && typeof bv === "string") {
        av = av.toLowerCase(); bv = bv.toLowerCase()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return list
  }, [invoices, search, statusFilter, sortKey, sortDir, customerIdFilter])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const overdue = filtered.filter(i => i.status === "Overdue")

  if (!canViewFinancials) {
    return (
      <div className="flex flex-col gap-5">
        <RestrictedNotice
          capability="canViewFinancials"
          title="Invoices are restricted for your role"
          body="Your role doesn't include access to invoice totals or billing history. Ask an owner, admin, or manager if you need to view or work on invoices."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void refreshInvoices()}>
            Retry
          </Button>
        </div>
      )}

      {customerIdFilter ? (
        <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing invoices for{" "}
            <span className="text-foreground font-medium">
              {filtered[0]?.customerName ?? "selected customer"}
            </span>
            {" "}only.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => router.push("/invoices")}
          >
            Clear filter
          </Button>
        </div>
      ) : null}

      <InvoiceStatCards invoices={invoicesForStats} />

      {activeOrgStatus === "ready" && activeOrgId ? (
        <FinancialInvoiceReportSection organizationId={activeOrgId} variant="standalone" />
      ) : null}

      {loading && invoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Loading invoices…
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-1.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={invoicesListVisibility}
          onValueChange={(v) => setInvoicesListVisibility(v as RecordArchiveVisibility)}
        >
          <SelectTrigger className="w-[132px]">
            <SelectValue placeholder="Records" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <PermissionGate capability="canEditInvoices">
            <Button size="sm" className="gap-2 cursor-pointer" onClick={() => openNewInvoiceModal(undefined, undefined)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Invoice</span>
              <span className="sm:hidden">New</span>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <p className="text-sm text-muted-foreground -mt-1">
        {loading && invoices.length > 0 && <span className="text-muted-foreground/80 mr-2">Refreshing…</span>}
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{invoices.length}</span> invoices
      </p>

      {/* Overdue callout */}
      {statusFilter === "all" && overdue.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm font-medium text-foreground">
            <span className="text-destructive font-semibold">{overdue.length} invoice{overdue.length !== 1 ? "s" : ""} overdue</span>{" "}
            — total{" "}
            <span className="font-semibold">{fmtCurrency(overdue.reduce((s, i) => s + i.amount, 0))}</span>
            {" "}outstanding
          </p>
        </div>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">No invoices match the current filters.</div>
          ) : filtered.map(inv => {
            const cfg = STATUS_CONFIG[inv.status]
            const StatusIcon = cfg.icon
            return (
              <div
                key={inv.id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 group"
                onClick={() => setSelectedInvoiceId(inv.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2">{invoiceDisplayId(inv)}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5 truncate max-w-[200px]">{inv.customerName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    <Badge variant="outline" className={cn("text-[10px] font-semibold gap-1 shrink-0", cfg.className)}>
                      <StatusIcon className="w-3 h-3" />
                      {inv.status}
                    </Badge>
                    {inv.isArchived ? (
                      <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                        Archived
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{inv.equipmentName}</span>
                  </div>
                  {inv.workOrderId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono">{getWorkOrderDisplay({ id: inv.workOrderId })}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-lg font-bold text-foreground ds-tabular">{fmtCurrency(inv.amount)}</span>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Due</p>
                    <p className={cn("text-xs font-medium ds-tabular", inv.status === "Overdue" ? "text-destructive font-semibold" : "text-foreground")}>
                      {fmtDate(inv.dueDate)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      {viewMode === "table" && <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="ds-table-header-row-subtle">
                <TableHead>
                  <button onClick={() => toggleSort("id")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Invoice # <SortIcon col="id" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("customerName")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Customer <SortIcon col="customerName" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Equipment</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Work Order</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("amount")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Amount <SortIcon col="amount" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("status")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("issueDate")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Issued <SortIcon col="issueDate" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("dueDate")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Due <SortIcon col="dueDate" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid On</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <Receipt className="w-10 h-10 text-muted-foreground/20" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">No invoices found</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Try adjusting your search or filter</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(inv => (
                  <TableRow
                    key={inv.id}
                    className="group cursor-pointer transition-colors duration-100"
                    style={{ backgroundColor: "var(--card)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--primary) 3%, var(--card))")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                  >
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2 ds-tabular">
                        {invoiceDisplayId(inv)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{inv.customerName}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{inv.equipmentName}</TableCell>
                    <TableCell>
                      {inv.workOrderId ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-muted-foreground ds-tabular">{getWorkOrderDisplay({ id: inv.workOrderId })}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                            <Wrench className="w-2.5 h-2.5 shrink-0" /> Service-linked
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground ds-tabular">{fmtCurrency(inv.amount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={inv.status} />
                        {inv.paymentAllocationState === "partial" || inv.paymentAllocationState === "overpaid" ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold",
                              inv.paymentAllocationState === "overpaid"
                                ? "bg-[color:var(--ds-info-bg)] text-[color:var(--ds-info-text)] border-[color:var(--ds-info-border)]"
                                : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
                            )}
                          >
                            {paymentAllocationUiLabel(inv.paymentAllocationState)}
                          </Badge>
                        ) : inv.paymentAllocationState === "paid" && inv.status !== "Paid" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
                          >
                            {paymentAllocationUiLabel(inv.paymentAllocationState)}
                          </Badge>
                        ) : null}
                        {inv.isArchived ? (
                          <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                            Archived
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground ds-tabular">{fmtDate(inv.issueDate)}</TableCell>
                    <TableCell className={cn(
                      "text-xs ds-tabular",
                      inv.status === "Overdue" ? "text-destructive font-semibold" : "text-muted-foreground"
                    )}>
                      {fmtDate(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-xs text-[color:var(--status-success)] ds-tabular">
                      {inv.paidDate ? fmtDate(inv.paidDate) : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      }

      <InvoiceDrawer
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onSelectInvoiceId={(id) => setSelectedInvoiceId(id)}
      />

      <NewInvoiceModal
        open={newModalOpen}
        onClose={() => {
          setNewModalOpen(false)
          setInvoicePrefillWo(undefined)
          setInvoicePrefillCal(undefined)
          setCatalogPrefill(null)
        }}
        initialWorkOrderId={invoicePrefillWo}
        initialCalibrationRecordId={invoicePrefillCal}
        prefilledCatalogItem={catalogPrefill}
        onSuccess={(_id, status) => {
          toast({
            title: status === "Sent" ? "Invoice sent to customer" : "Invoice saved as draft",
            description: `Your invoice has been ${status === "Sent" ? "sent" : "saved"}.`,
          })
        }}
      />
      <Toaster />
      <QuickAddParamBridge action="new-invoice" onTrigger={() => openNewInvoiceModal(undefined, undefined)} />
    </div>
  )
}

export default function InvoicesPage() {
  return <Suspense fallback={null}><InvoicesPageInner /></Suspense>
}
