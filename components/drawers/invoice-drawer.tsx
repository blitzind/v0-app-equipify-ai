"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useInvoices } from "@/lib/quote-invoice-store"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { CheckCircle2, Download, DollarSign, AlertTriangle, Pencil, X, Check, Plus, Trash2 } from "lucide-react"

let toastCounter = 0

const STATUS_CONFIG: Record<InvoiceStatus, { className: string }> = {
  "Draft":   { className: "bg-muted text-muted-foreground border-border" },
  "Sent":    { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Unpaid":  { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Paid":    { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Overdue": { className: "bg-destructive/10 text-destructive border-destructive/30" },
  "Void":    { className: "bg-muted text-muted-foreground/60 border-border" },
}

const ALL_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Unpaid", "Paid", "Overdue", "Void"]

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

type LineItem = { description: string; qty: number; unit: number }

// ─── Edit controls ────────────────────────────────────────────────────────────

function EditInput({ value, onChange, type = "text", placeholder, className }: { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
        className
      )}
    />
  )
}

function EditSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function EditTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
    />
  )
}

function EditRow({ label, view, editing, children }: { label: string; view: React.ReactNode; editing: boolean; children: React.ReactNode }) {
  return editing ? (
    <div className="flex items-start gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-1.5 w-28">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  ) : (
    <DrawerRow label={label} value={view} />
  )
}

// ─── Line items ───────────────────────────────────────────────────────────────

function EditableLineItems({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  function updateItem(idx: number, field: keyof LineItem, raw: string) {
    const next = items.map((item, i) => {
      if (i !== idx) return item
      return { ...item, [field]: field === "description" ? raw : parseFloat(raw) || 0 }
    })
    onChange(next)
  }

  function addItem() { onChange([...items, { description: "", qty: 1, unit: 0 }]) }
  function removeItem(idx: number) { onChange(items.filter((_, i) => i !== idx)) }

  const total = items.reduce((s, i) => s + i.qty * i.unit, 0)

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-14">Qty</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20">Unit</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, i) => (
              <tr key={i} className="bg-card">
                <td className="px-2 py-1.5">
                  <EditInput value={item.description} onChange={(v) => updateItem(i, "description", v)} placeholder="Item description" />
                </td>
                <td className="px-2 py-1.5">
                  <EditInput type="number" value={item.qty} onChange={(v) => updateItem(i, "qty", v)} className="text-right" />
                </td>
                <td className="px-2 py-1.5">
                  <EditInput type="number" value={item.unit} onChange={(v) => updateItem(i, "unit", v)} className="text-right" />
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40 border-t border-border">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
              <td className="px-2 py-2 text-right font-bold text-foreground">{fmtCurrency(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium">
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </button>
    </div>
  )
}

function ReadOnlyLineItems({ items, total }: { items: LineItem[]; total: number }) {
  function fmt$(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-10">Qty</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Unit</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={i} className="bg-card">
              <td className="px-3 py-2 text-foreground">{item.description}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmt$(item.unit)}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{fmt$(item.qty * item.unit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 border-t border-border">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
            <td className="px-3 py-2 text-right font-bold text-foreground">{fmt$(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Props / component ────────────────────────────────────────────────────────

interface InvoiceDrawerProps {
  invoiceId: string | null
  onClose: () => void
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const { invoices, updateInvoice } = useInvoices()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<AdminInvoice>>({})
  const [draftItems, setDraftItems] = useState<LineItem[]>([])

  const invoice = invoiceId ? invoices.find((i) => i.id === invoiceId) ?? null : null

  useEffect(() => {
    setEditing(false)
    setDraft({})
  }, [invoiceId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!invoice) return
    setDraft({
      status: invoice.status,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
    })
    setDraftItems(invoice.lineItems.map((li) => ({ ...li })))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftItems([])
  }

  function saveEdit() {
    if (!invoice) return
    const newTotal = draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    updateInvoice(invoice.id, {
      ...draft,
      lineItems: draftItems,
      amount: newTotal,
      ...(draft.status === "Paid" && !invoice.paidDate ? { paidDate: new Date().toISOString().slice(0, 10) } : {}),
    })
    setEditing(false)
    setDraft({})
    setDraftItems([])
    toast("Invoice updated successfully")
  }

  function setField<K extends keyof AdminInvoice>(field: K, value: AdminInvoice[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  if (!invoice) return null

  const currentStatus = (draft.status ?? invoice.status) as InvoiceStatus
  const displayTotal = editing
    ? draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    : invoice.amount

  const timelineItems = [
    { date: fmtDate(invoice.issueDate), label: "Invoice issued", accent: "muted" as const },
    { date: fmtDate(invoice.dueDate), label: "Payment due", accent: (invoice.status === "Overdue" ? "danger" : "muted") as "danger" | "muted" },
    ...(invoice.paidDate ? [{ date: fmtDate(invoice.paidDate), label: "Payment received", description: fmtCurrency(invoice.amount), accent: "success" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!invoiceId}
        onClose={onClose}
        title={invoice.id}
        subtitle={`${invoice.customerName} · ${invoice.equipmentName}`}
        width="lg"
        badge={
          <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[currentStatus].className)}>
            {currentStatus}
          </Badge>
        }
        actions={
          editing ? (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={saveEdit}>
                <Check className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {(invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Sent") && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Payment recorded successfully")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Record Payment
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Invoice PDF downloaded")}>
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </>
          )
        }
      >
        {/* Overdue banner */}
        {currentStatus === "Overdue" && !editing && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Payment overdue since {fmtDate(invoice.dueDate)}
          </div>
        )}

        <DrawerSection title="Invoice Details">
          <DrawerRow label="Customer" value={invoice.customerName} />
          <DrawerRow label="Equipment" value={invoice.equipmentName} />
          {invoice.workOrderId && <DrawerRow label="Work Order" value={<span className="text-primary font-mono">{invoice.workOrderId}</span>} />}
          <DrawerRow label="Issued" value={fmtDate(invoice.issueDate)} />
          <EditRow label="Due Date" view={
            <span className={invoice.status === "Overdue" ? "text-destructive font-semibold" : ""}>{fmtDate(invoice.dueDate)}</span>
          } editing={editing}>
            <EditInput type="date" value={draft.dueDate ?? ""} onChange={(v) => setField("dueDate", v)} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[invoice.status].className)}>{invoice.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? invoice.status} onChange={(v) => setField("status", v as InvoiceStatus)} options={ALL_STATUSES} />
          </EditRow>
          {invoice.paidDate && <DrawerRow label="Paid On" value={<span className="text-[color:var(--status-success)] font-semibold">{fmtDate(invoice.paidDate)}</span>} />}
        </DrawerSection>

        {/* Total card */}
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Total</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{fmtCurrency(displayTotal)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-primary/30" />
        </div>

        <DrawerSection title="Line Items">
          {editing ? (
            <EditableLineItems items={draftItems} onChange={setDraftItems} />
          ) : (
            <ReadOnlyLineItems items={invoice.lineItems} total={invoice.amount} />
          )}
        </DrawerSection>

        <DrawerSection title="Notes">
          {editing ? (
            <EditTextarea value={draft.notes ?? ""} onChange={(v) => setField("notes", v)} placeholder="Add notes..." />
          ) : invoice.notes ? (
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{invoice.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
          )}
        </DrawerSection>

        <DrawerSection title="Payment History">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
