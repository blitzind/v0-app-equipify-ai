"use client"

import { useState, useCallback, useEffect } from "react"
import { X, Plus, Trash2, Send, FilePen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useInvoices, useQuotes } from "@/lib/quote-invoice-store"
import { useCustomers } from "@/lib/customer-store"
import { useEquipment } from "@/lib/equipment-store"
import { useWorkOrders } from "@/lib/work-order-store"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"

// ─── Primitive field components ───────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function FieldInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
        className,
      )}
      {...props}
    />
  )
}

function FieldSelect({ children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function FieldTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none",
        className,
      )}
      {...props}
    />
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-destructive">{msg}</p>
}

// ─── Line item types ──────────────────────────────────────────────────────────

interface LineItem {
  id: string
  description: string
  qty: string
  unit: string
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", qty: "1", unit: "" }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

const PAYMENT_TERMS = [
  "Due on Receipt", "Net 7", "Net 14", "Net 30", "Net 45", "Net 60",
]

let invoiceCounter = 4500

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewInvoiceModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (id: string, status: InvoiceStatus) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewInvoiceModal({ open, onClose, onSuccess }: NewInvoiceModalProps) {
  const { addInvoice } = useInvoices()
  const { quotes } = useQuotes()
  const { customers } = useCustomers()
  const { equipment } = useEquipment()
  const { workOrders } = useWorkOrders()

  // ── Form state ──
  const [customerId, setCustomerId] = useState("")
  const [workOrderId, setWorkOrderId] = useState("")
  const [quoteId, setQuoteId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [title, setTitle] = useState("")
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()])
  const [discount, setDiscount] = useState("")
  const [tax, setTax] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("Net 30")
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [status, setStatus] = useState<InvoiceStatus>("Draft")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Reset on open ──
  useEffect(() => {
    if (open) {
      setCustomerId("")
      setWorkOrderId("")
      setQuoteId("")
      setEquipmentId("")
      setTitle("")
      setLineItems([newLineItem()])
      setDiscount("")
      setTax("")
      setDueDate("")
      setPaymentTerms("Net 30")
      setNotes("")
      setInternalNotes("")
      setStatus("Draft")
      setErrors({})
    }
  }, [open])

  // ── Auto-fill from quote ──
  useEffect(() => {
    if (!quoteId) return
    const q = quotes.find(qt => qt.id === quoteId)
    if (!q) return
    if (q.customerId) setCustomerId(q.customerId)
    if (q.equipmentId) setEquipmentId(q.equipmentId)
    if (q.workOrderId) setWorkOrderId(q.workOrderId)
    setTitle(q.description || "")
    if (q.lineItems?.length) {
      setLineItems(q.lineItems.map(li => ({
        id: crypto.randomUUID(),
        description: li.description,
        qty: String(li.qty),
        unit: String(li.unit),
      })))
    }
    if (q.notes) setNotes(q.notes)
  }, [quoteId, quotes])

  // ── ESC key close ──
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // ── Totals ──
  const subtotal = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.qty) || 0
    const unit = parseFloat(li.unit) || 0
    return sum + qty * unit
  }, 0)
  const discountAmt = discount ? subtotal * (parseFloat(discount) / 100) : 0
  const taxAmt = tax ? (subtotal - discountAmt) * (parseFloat(tax) / 100) : 0
  const total = subtotal - discountAmt + taxAmt

  // ── Line item handlers ──
  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li))
  }, [])
  const addLineItem = useCallback(() => setLineItems(prev => [...prev, newLineItem()]), [])
  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }, [])

  // ── Validation ──
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!customerId) errs.customerId = "Customer is required."
    if (!title.trim()) errs.title = "Invoice title is required."
    if (!dueDate) errs.dueDate = "Due date is required."
    const hasItem = lineItems.some(li => li.description.trim() && (parseFloat(li.unit) || 0) > 0)
    if (!hasItem) errs.lineItems = "At least one line item with a description and price is required."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ──
  function handleSubmit(submitStatus: InvoiceStatus) {
    if (!validate()) return

    const customer = customers.find(c => c.id === customerId)
    const eq = equipment.find(e => e.id === equipmentId)
    const now = new Date().toISOString().split("T")[0]
    invoiceCounter++
    const id = `INV-${invoiceCounter}`

    const invoice: AdminInvoice = {
      id,
      customerId,
      customerName: customer?.name ?? "",
      workOrderId,
      equipmentId,
      equipmentName: eq?.model ?? "",
      issueDate: now,
      dueDate,
      paidDate: "",
      amount: total,
      status: submitStatus,
      createdBy: "Admin",
      lineItems: lineItems
        .filter(li => li.description.trim())
        .map(li => ({
          description: li.description,
          qty: parseFloat(li.qty) || 1,
          unit: parseFloat(li.unit) || 0,
        })),
      notes,
    }

    addInvoice(invoice)
    onSuccess?.(id, submitStatus)
    onClose()
  }

  if (!open) return null

  const filteredEquipment = customerId ? equipment.filter(e => e.customerId === customerId) : equipment
  const filteredWorkOrders = customerId ? workOrders.filter(wo => wo.customerId === customerId) : workOrders
  const filteredQuotes = customerId ? quotes.filter(q => q.customerId === customerId) : quotes

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create New Invoice"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Create New Invoice</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below to create an invoice.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Customer + Equipment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Customer</Label>
              <FieldSelect
                value={customerId}
                onChange={e => {
                  setCustomerId(e.target.value)
                  setEquipmentId("")
                  setWorkOrderId("")
                  setQuoteId("")
                }}
              >
                <option value="">Select customer…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </FieldSelect>
              <FieldError msg={errors.customerId} />
            </div>
            <div>
              <Label>Equipment</Label>
              <FieldSelect
                value={equipmentId}
                onChange={e => setEquipmentId(e.target.value)}
                disabled={filteredEquipment.length === 0}
              >
                <option value="">Select equipment…</option>
                {filteredEquipment.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </FieldSelect>
            </div>
          </div>

          {/* Work Order + Related Quote */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Related Work Order</Label>
              <FieldSelect value={workOrderId} onChange={e => setWorkOrderId(e.target.value)}>
                <option value="">None</option>
                {filteredWorkOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>{getWorkOrderDisplay(wo)} — {wo.title}</option>
                ))}
              </FieldSelect>
            </div>
            <div>
              <Label>Related Quote</Label>
              <FieldSelect value={quoteId} onChange={e => setQuoteId(e.target.value)}>
                <option value="">None</option>
                {filteredQuotes.map(q => (
                  <option key={q.id} value={q.id}>{q.id} — {q.description}</option>
                ))}
              </FieldSelect>
              {quoteId && (
                <p className="mt-1 text-[10px] text-[color:var(--status-info)]">Line items auto-filled from selected quote.</p>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label required>Invoice Title</Label>
            <FieldInput
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. HVAC Repair — April 2026"
            />
            <FieldError msg={errors.title} />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label required>Line Items</Label>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_60px_90px_80px_32px] gap-2 mb-1.5 px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Qty</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Unit Price</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Total</span>
              <span />
            </div>

            <div className="space-y-2">
              {lineItems.map((li) => {
                const rowTotal = (parseFloat(li.qty) || 0) * (parseFloat(li.unit) || 0)
                return (
                  <div key={li.id} className="grid grid-cols-[1fr_60px_90px_80px_32px] gap-2 items-center">
                    <FieldInput
                      value={li.description}
                      onChange={e => updateLineItem(li.id, "description", e.target.value)}
                      placeholder="Description"
                    />
                    <FieldInput
                      type="number"
                      min="1"
                      value={li.qty}
                      onChange={e => updateLineItem(li.id, "qty", e.target.value)}
                      className="text-center"
                    />
                    <FieldInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unit}
                      onChange={e => updateLineItem(li.id, "unit", e.target.value)}
                      placeholder="0.00"
                      className="text-right"
                    />
                    <div className="text-right text-sm font-medium text-foreground ds-tabular">
                      {rowTotal > 0 ? fmtCurrency(rowTotal) : <span className="text-muted-foreground/40">—</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(li.id)}
                      disabled={lineItems.length === 1}
                      className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
            <FieldError msg={errors.lineItems} />

            {/* Totals */}
            <div className="mt-3 border-t border-border pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="ds-tabular">{fmtCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Discount</span>
                  <div className="relative w-20">
                    <FieldInput
                      type="number" min="0" max="100" step="0.1"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="0"
                      className="pr-5 text-right text-xs py-1"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground ds-tabular">
                  {discountAmt > 0 ? `- ${fmtCurrency(discountAmt)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tax</span>
                  <div className="relative w-20">
                    <FieldInput
                      type="number" min="0" max="100" step="0.1"
                      value={tax}
                      onChange={e => setTax(e.target.value)}
                      placeholder="0"
                      className="pr-5 text-right text-xs py-1"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground ds-tabular">
                  {taxAmt > 0 ? `+ ${fmtCurrency(taxAmt)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-2 mt-1">
                <span>Total</span>
                <span className="ds-tabular">{fmtCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Due Date + Payment Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Due Date</Label>
              <FieldInput
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <FieldError msg={errors.dueDate} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <FieldSelect value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </FieldSelect>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <FieldSelect value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)}>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
              </FieldSelect>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <FieldTextarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Customer-facing notes…"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <Label>Internal Notes</Label>
            <FieldTextarea
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              placeholder="Internal team notes (not visible to customer)…"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0 bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <FilePen className="w-3.5 h-3.5" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("Sent")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Send Invoice
          </button>
        </div>

      </div>
    </div>
  )
}
