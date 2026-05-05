"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useQuotes } from "@/lib/quote-invoice-store"
import { useQuickAdd, QuickAddParamBridge } from "@/lib/quick-add-context"
import type { AdminQuote, QuoteStatus } from "@/lib/mock-data"
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
  FileText, Clock, CheckCircle2, XCircle, Send, FilePen, Ban, Building2,
} from "lucide-react"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { QuoteDrawer } from "@/components/drawers/quote-drawer"
import { getWorkOrderDisplay, workOrderMatchesSearch } from "@/lib/work-orders/display"
import { NewQuoteModal } from "@/components/quotes/new-quote-modal"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function quoteDisplayId(q: AdminQuote) {
  return q.quoteNumber?.trim() || "Quote"
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteStatus, { label: string; className: string; icon: React.ElementType }> = {
  "Draft":            { label: "Draft",            className: "bg-muted text-muted-foreground border-border",                                               icon: FilePen },
  "Sent":             { label: "Sent",             className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",         icon: Send },
  "Pending Approval": { label: "Pending Approval", className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30", icon: Clock },
  "Approved":         { label: "Approved",         className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30", icon: CheckCircle2 },
  "Declined":         { label: "Declined",         className: "bg-destructive/10 text-destructive border-destructive/30",                                  icon: XCircle },
  "Expired":          { label: "Expired",          className: "bg-muted text-muted-foreground border-border",                                               icon: Ban },
}

const ALL_STATUSES: QuoteStatus[] = ["Draft", "Sent", "Pending Approval", "Approved", "Declined", "Expired"]

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function QuoteStatCards({ quotes }: { quotes: AdminQuote[] }) {
  const pending  = quotes.filter(q => q.status === "Pending Approval").length
  const approved = quotes.filter(q => q.status === "Approved").length
  const pendingValue = quotes.filter(q => q.status === "Pending Approval").reduce((s, q) => s + q.amount, 0)
  const totalValue   = quotes.filter(q => q.status === "Approved").reduce((s, q) => s + q.amount, 0)

  const stats = [
    { label: "Pending Approval", value: String(pending),           sub: `${fmtCurrency(pendingValue)} at stake`,   icon: Clock,         accent: "text-[color:var(--status-warning)]", bg: "bg-[color:var(--status-warning)]/10" },
    { label: "Approved",         value: String(approved),          sub: `${fmtCurrency(totalValue)} approved`,     icon: CheckCircle2,  accent: "text-[color:var(--status-success)]", bg: "bg-[color:var(--status-success)]/10" },
    { label: "Total Quotes",     value: String(quotes.length),     sub: "all time",                                icon: FileText,      accent: "text-primary",                       bg: "bg-primary/10" },
    { label: "Open Value",       value: fmtCurrency(pendingValue), sub: "awaiting customer decision",             icon: Send,          accent: "text-[color:var(--status-info)]",    bg: "bg-[color:var(--status-info)]/10" },
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

function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold gap-1", cfg.className)}>
      {status}
    </Badge>
  )
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

type SortKey = "id" | "customerName" | "amount" | "createdDate" | "expiresDate" | "status"

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  return (
    <ArrowUpDown className={cn(
      "w-3.5 h-3.5 ml-1 inline transition-colors",
      sortKey === col ? "text-primary" : "text-muted-foreground/40"
    )} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function QuotesPageInner() {
  const { quotes, loading, error, refreshQuotes } = useQuotes()
  const { toast } = useToast()
  const { standardCreateEligibility } = useBillingAccess()
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newQuotePrefillCustomerId, setNewQuotePrefillCustomerId] = useState<string | null>(null)
  const [newQuotePrefillEquipmentId, setNewQuotePrefillEquipmentId] = useState<string | null>(null)

  function openNewQuoteModal(prefillCustomerId: string | null, prefillEquipmentId: string | null) {
    if (blockCreateIfNotEligible(standardCreateEligibility)) return
    setNewQuotePrefillCustomerId(prefillCustomerId)
    setNewQuotePrefillEquipmentId(prefillEquipmentId)
    setNewModalOpen(true)
  }

  useQuickAdd("new-quote", () => {
    openNewQuoteModal(null, null)
  })
  const [search, setSearch]           = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all")
  const [sortKey, setSortKey]         = useState<SortKey>("createdDate")
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc")
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const searchParams = useSearchParams()
  const router = useRouter()

  // Auto-open drawer from ?open= query param
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedQuoteId(openId)
      router.replace("/quotes", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    const action = searchParams.get("action")
    const cid = searchParams.get("customerId")
    const eid = searchParams.get("equipmentId")
    if (action === "new-quote") {
      if (blockCreateIfNotEligible(standardCreateEligibility)) {
        router.replace("/quotes", { scroll: false })
        return
      }
      setNewQuotePrefillCustomerId(cid)
      setNewQuotePrefillEquipmentId(eid)
      setNewModalOpen(true)
      router.replace("/quotes", { scroll: false })
    }
  }, [searchParams, router, standardCreateEligibility])

  const filtered = useMemo(() => {
    let list = [...quotes]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (qt) =>
          qt.id.toLowerCase().includes(q) ||
          (qt.quoteNumber?.toLowerCase().includes(q) ?? false) ||
          qt.customerName.toLowerCase().includes(q) ||
          qt.equipmentName.toLowerCase().includes(q) ||
          (qt.workOrderId
            ? workOrderMatchesSearch(search, {
                id: qt.workOrderId,
                customerName: qt.customerName,
                equipmentName: qt.equipmentName,
                technicianName: "",
                description: qt.description ?? "",
              })
            : false),
      )
    }
    if (statusFilter !== "all") {
      list = list.filter(qt => qt.status === statusFilter)
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
  }, [quotes, search, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const pendingApproval = filtered.filter(q => q.status === "Pending Approval")
  const others          = filtered.filter(q => q.status !== "Pending Approval")

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void refreshQuotes()}>
            Retry
          </Button>
        </div>
      )}

      {loading && quotes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Loading quotes…
        </div>
      ) : (
        <QuoteStatCards quotes={quotes} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-sm rounded-md border border-border bg-card px-3 py-1.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search quotes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Button
            size="sm"
            className="gap-2 cursor-pointer"
            onClick={() => {
              openNewQuoteModal(null, null)
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Quote</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground -mt-1">
        {loading && quotes.length > 0 && <span className="text-muted-foreground/80 mr-2">Refreshing…</span>}
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{quotes.length}</span> quotes
      </p>

      {/* Pending approval callout */}
      {statusFilter === "all" && pendingApproval.length > 0 && (
        <div className="rounded-xl border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/5 px-4 py-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-[color:var(--status-warning)] shrink-0" />
          <p className="text-sm font-medium text-foreground">
            <span className="text-[color:var(--status-warning)] font-semibold">{pendingApproval.length} quote{pendingApproval.length !== 1 ? "s" : ""}</span>{" "}
            awaiting customer approval — total value{" "}
            <span className="font-semibold">{fmtCurrency(pendingApproval.reduce((s, q) => s + q.amount, 0))}</span>
          </p>
        </div>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">No quotes match the current filters.</div>
          ) : filtered.map(qt => {
            const cfg = STATUS_CONFIG[qt.status]
            const StatusIcon = cfg.icon
            return (
              <div
                key={qt.id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 group"
                onClick={() => setSelectedQuoteId(qt.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2">{quoteDisplayId(qt)}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5 truncate max-w-[200px]">{qt.customerName}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-semibold gap-1 shrink-0", cfg.className)}>
                    <StatusIcon className="w-3 h-3" />
                    {qt.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{qt.equipmentName}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-lg font-bold text-foreground ds-tabular">{fmtCurrency(qt.amount)}</span>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Expires</p>
                    <p className={cn("text-xs font-medium ds-tabular", qt.status === "Expired" ? "text-destructive" : "text-foreground")}>
                      {fmtDate(qt.expiresDate)}
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
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>
                  <button onClick={() => toggleSort("id")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Quote # <SortIcon col="id" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("customerName")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Customer <SortIcon col="customerName" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Equipment</TableHead>
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
                  <button onClick={() => toggleSort("createdDate")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Created <SortIcon col="createdDate" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("expiresDate")} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    Expires <SortIcon col="expiresDate" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Work Order</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-10 h-10 text-muted-foreground/20" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">No quotes found</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Try adjusting your search or filter</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(qt => (
                  <TableRow
                    key={qt.id}
                    className="group cursor-pointer transition-colors duration-100"
                    style={{ backgroundColor: "var(--card)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--primary) 3%, var(--card))")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                    onClick={() => setSelectedQuoteId(qt.id)}
                  >
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2 ds-tabular">
                        {quoteDisplayId(qt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{qt.customerName}</p>
                        <p className="text-xs text-muted-foreground">{qt.createdBy}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{qt.equipmentName}</TableCell>
                    <TableCell className="text-sm font-semibold text-foreground ds-tabular">{fmtCurrency(qt.amount)}</TableCell>
                    <TableCell><StatusBadge status={qt.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground ds-tabular">{fmtDate(qt.createdDate)}</TableCell>
                    <TableCell className={cn("text-xs ds-tabular", qt.status === "Expired" ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {fmtDate(qt.expiresDate)}
                    </TableCell>
                    <TableCell>
                      {qt.workOrderId ? (
                        <span className="font-mono text-xs text-muted-foreground ds-tabular">{getWorkOrderDisplay({ id: qt.workOrderId, workOrderNumber: qt.workOrderNumber })}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedQuoteId(qt.id)}
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

      <QuoteDrawer
        quoteId={selectedQuoteId}
        onClose={() => setSelectedQuoteId(null)}
      />

      <NewQuoteModal
        open={newModalOpen}
        prefilledCustomerId={newQuotePrefillCustomerId}
        prefilledEquipmentId={newQuotePrefillEquipmentId}
        onClose={() => {
          setNewModalOpen(false)
          setNewQuotePrefillCustomerId(null)
          setNewQuotePrefillEquipmentId(null)
        }}
        onSuccess={(_id, status) => {
          toast({
            title: status === "Sent" ? "Quote sent to customer" : "Quote saved as draft",
            description: `Your quote has been ${status === "Sent" ? "sent" : "saved"}.`,
          })
        }}
      />
      <Toaster />
      <QuickAddParamBridge action="new-quote" onTrigger={() => openNewQuoteModal(null, null)} />
    </div>
  )
}

export default function QuotesPage() {
  return <Suspense fallback={null}><QuotesPageInner /></Suspense>
}
