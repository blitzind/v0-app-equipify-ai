"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { X, Plus, Trash2, Send, FilePen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useQuotes } from "@/lib/quote-invoice-store"
import type { QuoteStatus } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { AddEquipmentModal } from "@/components/equipment/add-equipment-modal"

// ─── Primitive field components (match add-equipment-modal style) ─────────────

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

const SERVICE_TYPES = [
  "Preventive Maintenance", "Repair", "Inspection", "Installation",
  "Emergency Service", "Consultation", "Warranty Work", "Other",
]

type CustomerOption = { id: string; company_name: string }
type EquipmentOption = {
  id: string
  name: string
  equipment_code: string | null
  serial_number: string | null
  category: string | null
}
type WorkOrderOption = { id: string; work_order_number?: number | null; title: string }

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewQuoteModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (id: string, status: QuoteStatus) => void
  prefilledCustomerId?: string | null
  prefilledEquipmentId?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewQuoteModal({
  open,
  onClose,
  onSuccess,
  prefilledCustomerId = null,
  prefilledEquipmentId = null,
}: NewQuoteModalProps) {
  const { addQuoteFromPayload } = useQuotes()
  const prevOpenRef = useRef(false)
  const { organizationId: activeOrgId, status: orgContextStatus } = useActiveOrganization()
  const organizationId = orgContextStatus === "ready" ? activeOrgId : null

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [workOrderOptions, setWorkOrderOptions] = useState<WorkOrderOption[]>([])
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false)
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)

  const [customerId, setCustomerId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [workOrderId, setWorkOrderId] = useState("")
  const [title, setTitle] = useState("")
  const [serviceType, setServiceType] = useState("")
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()])
  const [discount, setDiscount] = useState("")
  const [tax, setTax] = useState("")
  const [expiresDate, setExpiresDate] = useState("")
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [status, setStatus] = useState<QuoteStatus>("Draft")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const refreshEquipmentForCustomer = useCallback(
    async (opts?: { organizationId: string; customerId: string; selectEquipmentId?: string }) => {
      const orgId = opts?.organizationId ?? organizationId
      const custId = opts?.customerId ?? customerId
      const selectId = opts?.selectEquipmentId
      if (!orgId || !custId) return

      const supabase = createBrowserSupabaseClient()
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select("id, name, equipment_code, serial_number, category")
        .eq("organization_id", orgId)
        .eq("customer_id", custId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("name")

      if (eqError) {
        setEquipmentList([])
        return
      }
      const list = (eqRows as EquipmentOption[]) ?? []
      setEquipmentList(list)
      if (selectId && list.some((e) => e.id === selectId)) {
        setEquipmentId(selectId)
      }
    },
    [organizationId, customerId],
  )

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCustomerId(prefilledCustomerId ?? "")
      setEquipmentId("")
      setWorkOrderId("")
      setTitle("")
      setServiceType("")
      setLineItems([newLineItem()])
      setDiscount("")
      setTax("")
      setExpiresDate("")
      setNotes("")
      setInternalNotes("")
      setStatus("Draft")
      setErrors({})
      setLoadError(null)
      setSubmitting(false)
      setAddEquipmentOpen(false)
    }
    prevOpenRef.current = open
    if (!open) {
      setAddEquipmentOpen(false)
    }
  }, [open, prefilledCustomerId])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      setLoadError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) {
          setCustomers([])
        }
        return
      }

      if (orgContextStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setCustomers([])
          setLoadError(
            orgContextStatus === "ready" && !activeOrgId ? "No organization selected." : null,
          )
        }
        return
      }

      const orgId = activeOrgId

      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("company_name")

      if (custError || cancelled) {
        if (!cancelled) setLoadError(custError?.message ?? "Failed to load customers.")
        return
      }

      if (!cancelled) setCustomers((custRows as CustomerOption[]) ?? [])
    })()

    return () => {
      cancelled = true
    }
  }, [open, orgContextStatus, activeOrgId])

  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      if (!customerId) {
        setEquipmentList([])
        setWorkOrderOptions([])
        setEquipmentLoading(false)
        setWorkOrdersLoading(false)
      }
      return
    }

    let cancelled = false
    setEquipmentLoading(true)
    setWorkOrdersLoading(true)
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      const woSelectWithNum = "id, work_order_number, title"
      const woSelect = "id, title"

      const [eqRes, woResFirst] = await Promise.all([
        supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .eq("status", "active")
          .eq("is_archived", false)
          .order("name"),
        supabase
          .from("work_orders")
          .select(woSelectWithNum)
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(100),
      ])

      let woRes = woResFirst
      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(woSelect)
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(100)
      }

      if (cancelled) return

      if (!eqRes.error) {
        const list = (eqRes.data as EquipmentOption[]) ?? []
        setEquipmentList(list)
        if (prefilledEquipmentId && list.some((e) => e.id === prefilledEquipmentId)) {
          setEquipmentId(prefilledEquipmentId)
        }
      } else {
        setEquipmentList([])
      }
      setEquipmentLoading(false)

      if (!woRes.error) {
        setWorkOrderOptions((woRes.data as WorkOrderOption[]) ?? [])
      } else {
        setWorkOrderOptions([])
      }
      setWorkOrdersLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId, prefilledEquipmentId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !addEquipmentOpen) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, addEquipmentOpen])

  const subtotal = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.qty) || 0
    const unit = parseFloat(li.unit) || 0
    return sum + qty * unit
  }, 0)
  const discountAmt = discount ? subtotal * (parseFloat(discount) / 100) : 0
  const taxAmt = tax ? (subtotal - discountAmt) * (parseFloat(tax) / 100) : 0
  const total = subtotal - discountAmt + taxAmt

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)))
  }, [])
  const addLineItem = useCallback(() => setLineItems((prev) => [...prev, newLineItem()]), [])
  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id))
  }, [])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!customerId) errs.customerId = "Customer is required."
    if (!title.trim()) errs.title = "Quote title is required."
    if (!expiresDate) errs.expiresDate = "Expiration date is required."
    const hasItem = lineItems.some((li) => li.description.trim() && (parseFloat(li.unit) || 0) > 0)
    if (!hasItem) errs.lineItems = "At least one line item with a description and price is required."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(submitStatus: QuoteStatus) {
    if (!validate()) return
    if (!organizationId) {
      setErrors((e) => ({ ...e, customerId: "Select an organization first." }))
      return
    }
    setSubmitting(true)
    const lineItemsJson = lineItems
      .filter((li) => li.description.trim())
      .map((li) => ({
        description: li.description.trim(),
        qty: parseFloat(li.qty) || 1,
        unit: parseFloat(li.unit) || 0,
      }))
    const { id, error: saveError } = await addQuoteFromPayload({
      customerId,
      equipmentId: equipmentId || null,
      workOrderId: workOrderId || null,
      title: title.trim(),
      amountCents: Math.round(total * 100),
      status: submitStatus,
      expiresAt: expiresDate,
      lineItems: lineItemsJson,
      notes: notes.trim() ? notes.trim() : null,
      internalNotes: internalNotes.trim() ? internalNotes.trim() : null,
      sentAt: submitStatus === "Sent" ? new Date().toISOString() : null,
    })
    setSubmitting(false)
    if (saveError) {
      setErrors((e) => ({ ...e, _submit: saveError }))
      return
    }
    if (id) onSuccess?.(id, submitStatus)
    onClose()
  }

  function handleClose() {
    onClose()
  }

  function handleOpenAddEquipment() {
    if (!customerId) return
    setAddEquipmentOpen(true)
  }

  function handleAddEquipmentClose() {
    setAddEquipmentOpen(false)
  }

  async function handleAddEquipmentSuccess(newId?: string) {
    if (organizationId && customerId) {
      await refreshEquipmentForCustomer({
        organizationId,
        customerId,
        selectEquipmentId: newId,
      })
    }
  }

  if (!open) return null

  const quoteEquipmentCustomerName = customers.find((c) => c.id === customerId)?.company_name ?? ""

  const quotePanelVisible = open && !addEquipmentOpen

  return (
    <>
      {quotePanelVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create New Quote"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={handleClose} />

          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">Create New Quote</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a customer first, then equipment for this quote.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {(loadError || errors._submit) && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {loadError ?? errors._submit}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Customer</Label>
                  <FieldSelect
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value)
                      setEquipmentId("")
                      setWorkOrderId("")
                    }}
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </FieldSelect>
                  <FieldError msg={errors.customerId} />
                </div>
                <div>
                  <Label>Equipment</Label>
                  <FieldSelect
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    disabled={!customerId || equipmentLoading || equipmentList.length === 0}
                  >
                    <option value="">
                      {!customerId
                        ? "Select customer first"
                        : equipmentLoading
                          ? "Loading equipment…"
                          : equipmentList.length === 0
                            ? "No equipment yet"
                            : "Select equipment…"}
                    </option>
                    {equipmentList.map((e) => (
                      <option key={e.id} value={e.id}>
                        {getEquipmentDisplayPrimary(e)} — {getEquipmentSecondaryLine(e, quoteEquipmentCustomerName)}
                      </option>
                    ))}
                  </FieldSelect>
                  {customerId && !equipmentLoading && equipmentList.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 space-y-2 mt-2">
                      <p className="text-sm text-muted-foreground">No equipment found for this customer.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddEquipment}
                        className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        + Add Equipment
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Related Work Order</Label>
                  <FieldSelect
                    value={workOrderId}
                    onChange={(e) => setWorkOrderId(e.target.value)}
                    disabled={!customerId || workOrdersLoading}
                  >
                    <option value="">{workOrdersLoading ? "Loading…" : "None"}</option>
                    {workOrderOptions.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {formatWorkOrderDisplay(wo.work_order_number, wo.id)} — {wo.title}
                      </option>
                    ))}
                  </FieldSelect>
                </div>
                <div>
                  <Label>Service Type</Label>
                  <FieldSelect value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                    <option value="">Select type…</option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </FieldSelect>
                </div>
              </div>

              <div>
                <Label required>Quote Title</Label>
                <FieldInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. HVAC Repair and Refrigerant Recharge"
                />
                <FieldError msg={errors.title} />
              </div>

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
                          onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                          placeholder="Description"
                        />
                        <FieldInput
                          type="number"
                          min="1"
                          value={li.qty}
                          onChange={(e) => updateLineItem(li.id, "qty", e.target.value)}
                          className="text-center"
                        />
                        <FieldInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={li.unit}
                          onChange={(e) => updateLineItem(li.id, "unit", e.target.value)}
                          placeholder="0.00"
                          className="text-right"
                        />
                        <div className="text-right text-sm font-medium text-foreground ds-tabular">
                          {rowTotal > 0 ? (
                            fmtCurrency(rowTotal)
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
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
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
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
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={tax}
                          onChange={(e) => setTax(e.target.value)}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Expiration Date</Label>
                  <FieldInput
                    type="date"
                    value={expiresDate}
                    onChange={(e) => setExpiresDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <FieldError msg={errors.expiresDate} />
                </div>
                <div>
                  <Label>Status</Label>
                  <FieldSelect value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                  </FieldSelect>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <FieldTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Customer-facing notes…"
                />
              </div>

              <div>
                <Label>Internal Notes</Label>
                <FieldTextarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Internal team notes (not visible to customer)…"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0 bg-muted/30">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit("Draft")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                <FilePen className="w-3.5 h-3.5" />
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit("Sent")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-cta text-cta-foreground hover:bg-cta-hover active:bg-cta-active transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Send Quote
              </button>
            </div>
          </div>
        </div>
      )}

      <AddEquipmentModal
        open={addEquipmentOpen}
        onClose={handleAddEquipmentClose}
        onSuccess={(id) => handleAddEquipmentSuccess(id)}
        prefilledCustomerId={customerId || null}
        offerMaintenancePlanNext={false}
      />
    </>
  )
}
