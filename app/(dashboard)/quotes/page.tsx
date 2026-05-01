"use client"

import { useState, useMemo } from "react"
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
import {
  Search, Plus, ArrowUpDown, ChevronRight,
  FileText, Clock, CheckCircle2, XCircle, Send, FilePen, Ban,
} from "lucide-react"
import { QuoteDrawer } from "@/components/drawers/quote-drawer"
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

export default function QuotesPage() {
  const { quotes } = useQuotes()
  const { toast } = useToast()
  const [newModalOpen, setNewModalOpen] = useState(false)
  useQuickAdd("new-quote", () => setNewModalOpen(true))
  const [search, setSearch]           = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all")
  const [sortKey, setSortKey]         = useState<SortKey>("createdDate")
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc")
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...quotes]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(qt =>
        qt.id.toLowerCase().includes(q) ||
        qt.customerName.toLowerCase().includes(q) ||
        qt.equipmentName.toLowerCase().includes(q)
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
  }, [search, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const pendingApproval = filtered.filter(q => q.status === "Pending Approval")
  const others          = filtered.filter(q => q.status !== "Pending Approval")

  return (
    <div className="flex flex-col gap-5">
      <QuoteStatCards quotes={quotes} />

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
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="gap-2 ml-auto shrink-0 cursor-pointer" onClick={() => setNewModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Quote</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground -mt-1">
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

      {/* Table */}
      <Card className="overflow-hidden p-0">
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
                        {qt.id}
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
                        <span className="font-mono text-xs text-muted-foreground ds-tabular">{qt.workOrderId}</span>
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

      <QuoteDrawer
        quoteId={selectedQuoteId}
        onClose={() => setSelectedQuoteId(null)}
      />

      <NewQuoteModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSuccess={(id, status) => {
          toast({
            title: status === "Sent" ? "Quote sent to customer" : "Quote saved as draft",
            description: `${id} has been ${status === "Sent" ? "sent" : "saved"}.`,
          })
        }}
      />
      <Toaster />
      <QuickAddParamBridge action="new-quote" onTrigger={() => setNewModalOpen(true)} />
    </div>
  )
}
