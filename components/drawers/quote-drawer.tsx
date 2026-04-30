"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useQuotes } from "@/lib/quote-invoice-store"
import type { AdminQuote, QuoteStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { CheckCircle2, ClipboardList, Download, Send, Pencil, X, Check, FileText, Plus, Trash2 } from "lucide-react"

let toastCounter = 0

const STATUS_CONFIG: Record<QuoteStatus, { className: string }> = {
  "Draft":            { className: "bg-muted text-muted-foreground border-border" },
  "Sent":             { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Pending Approval": { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Approved":         { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Declined":         { className: "bg-destructive/10 text-destructive border-destructive/30" },
  "Expired":          { className: "bg-muted text-muted-foreground border-border" },
}

const ALL_STATUSES: QuoteStatus[] = ["Draft", "Sent", "Pending Approval", "Approved", "Declined", "Expired"]

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

// ─── Editable line items table ────────────────────────────────────────────────

function EditableLineItems({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  function updateItem(idx: number, field: keyof LineItem, raw: string) {
    const next = items.map((item, i) => {
      if (i !== idx) return item
      return { ...item, [field]: field === "description" ? raw : parseFloat(raw) || 0 }
    })
    onChange(next)
  }

  function addItem() {
    onChange([...items, { description: "", qty: 1, unit: 0 }])
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

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
                  <button
                    onClick={() => removeItem(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    aria-label="Remove line item"
                  >
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
      <button
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
      >
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </button>
    </div>
  )
}

// ─── Read-only line items ─────────────────────────────────────────────────────

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

interface QuoteDrawerProps {
  quoteId: string | null
  onClose: () => void
}

export function QuoteDrawer({ quoteId, onClose }: QuoteDrawerProps) {
  const { quotes, updateQuote } = useQuotes()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<AdminQuote>>({})
  const [draftItems, setDraftItems] = useState<LineItem[]>([])

  const quote = quoteId ? quotes.find((q) => q.id === quoteId) ?? null : null

  useEffect(() => {
    setEditing(false)
    setDraft({})
  }, [quoteId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!quote) return
    setDraft({
      status: quote.status,
      expiresDate: quote.expiresDate,
      notes: quote.notes,
    })
    setDraftItems(quote.lineItems.map((li) => ({ ...li })))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftItems([])
  }

  function saveEdit() {
    if (!quote) return
    const newTotal = draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    updateQuote(quote.id, {
      ...draft,
      lineItems: draftItems,
      amount: newTotal,
    })
    setEditing(false)
    setDraft({})
    setDraftItems([])
    toast("Quote updated successfully")
  }

  function setField<K extends keyof AdminQuote>(field: K, value: AdminQuote[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  if (!quote) return null

  const currentStatus = (draft.status ?? quote.status) as QuoteStatus

  const timelineItems = [
    { date: fmtDate(quote.createdDate), label: "Quote created", description: `Created by ${quote.createdBy}`, accent: "muted" as const },
    ...(quote.sentDate ? [{ date: fmtDate(quote.sentDate), label: "Quote sent to customer", accent: "muted" as const }] : []),
    ...(currentStatus === "Approved" ? [{ date: "—", label: "Customer approved quote", accent: "success" as const }] : []),
    ...(currentStatus === "Declined" ? [{ date: "—", label: "Customer declined quote", accent: "danger" as const }] : []),
    ...(currentStatus === "Expired" ? [{ date: fmtDate(quote.expiresDate), label: "Quote expired", accent: "danger" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!quoteId}
        onClose={onClose}
        title={quote.id}
        subtitle={`${quote.customerName} · ${quote.equipmentName}`}
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
              {(quote.status === "Draft" || quote.status === "Sent") && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Quote sent to customer")}>
                  <Send className="w-3.5 h-3.5" /> Send to Customer
                </Button>
              )}
              {quote.status === "Approved" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order created from quote")}>
                  <ClipboardList className="w-3.5 h-3.5" /> Convert to WO
                </Button>
              )}
              {quote.status === "Approved" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Invoice created from quote")}>
                  <FileText className="w-3.5 h-3.5" /> Convert to Invoice
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Quote PDF downloaded")}>
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </>
          )
        }
      >
        <DrawerSection title="Quote Details">
          <DrawerRow label="Customer" value={quote.customerName} />
          <DrawerRow label="Equipment" value={quote.equipmentName} />
          <DrawerRow label="Created By" value={quote.createdBy} />
          <DrawerRow label="Created" value={fmtDate(quote.createdDate)} />
          <EditRow label="Expires" view={
            <span className={quote.status === "Expired" ? "text-destructive font-semibold" : ""}>{fmtDate(quote.expiresDate)}</span>
          } editing={editing}>
            <EditInput type="date" value={draft.expiresDate ?? ""} onChange={(v) => setField("expiresDate", v)} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[quote.status].className)}>{quote.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? quote.status} onChange={(v) => setField("status", v as QuoteStatus)} options={ALL_STATUSES} />
          </EditRow>
          {quote.workOrderId && <DrawerRow label="Work Order" value={<span className="text-primary font-mono">{quote.workOrderId}</span>} />}
        </DrawerSection>

        <DrawerSection title="Description">
          <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
            {quote.description}
          </p>
        </DrawerSection>

        <DrawerSection title="Line Items">
          {editing ? (
            <EditableLineItems items={draftItems} onChange={setDraftItems} />
          ) : (
            <ReadOnlyLineItems items={quote.lineItems} total={quote.amount} />
          )}
        </DrawerSection>

        <DrawerSection title="Notes">
          {editing ? (
            <EditTextarea value={draft.notes ?? ""} onChange={(v) => setField("notes", v)} placeholder="Add notes..." />
          ) : quote.notes ? (
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{quote.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
          )}
        </DrawerSection>

        <DrawerSection title="Timeline">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
