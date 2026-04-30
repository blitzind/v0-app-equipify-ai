"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { adminInvoices } from "@/lib/mock-data"
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
import {
  Search, Plus, ArrowUpDown, ChevronRight,
  Receipt, CheckCircle2, AlertTriangle, Clock, FilePen, Ban, Send,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: React.ElementType }> = {
  "Draft":   { label: "Draft",   className: "bg-muted text-muted-foreground border-border",                                               icon: FilePen },
  "Sent":    { label: "Sent",    className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",         icon: Send },
  "Unpaid":  { label: "Unpaid",  className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30", icon: Clock },
  "Paid":    { label: "Paid",    className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30", icon: CheckCircle2 },
  "Overdue": { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/30",                                  icon: AlertTriangle },
  "Void":    { label: "Void",    className: "bg-muted text-muted-foreground/60 border-border line-through",                             icon: Ban },
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(({ label, value, sub, icon: Icon, accent, bg }) => (
        <div key={label} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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

export default function InvoicesPage() {
  const [search, setSearch]           = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all")
  const [sortKey, setSortKey]         = useState<SortKey>("issueDate")
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc")

  const filtered = useMemo(() => {
    let list = [...adminInvoices]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(inv =>
        inv.id.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.equipmentName.toLowerCase().includes(q) ||
        inv.workOrderId.toLowerCase().includes(q)
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
  }, [search, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const overdue = filtered.filter(i => i.status === "Overdue")

  return (
    <div className="flex flex-col gap-5">
      <InvoiceStatCards invoices={adminInvoices} />

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
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="gap-2 ml-auto shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Invoice</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground -mt-1">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        <span className="font-medium text-foreground">{adminInvoices.length}</span> invoices
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

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
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
                  >
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2 ds-tabular">
                        {inv.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{inv.customerName}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{inv.equipmentName}</TableCell>
                    <TableCell>
                      {inv.workOrderId ? (
                        <span className="font-mono text-xs text-muted-foreground ds-tabular">{inv.workOrderId}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground ds-tabular">{fmtCurrency(inv.amount)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
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
                    <TableCell>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  )
}
