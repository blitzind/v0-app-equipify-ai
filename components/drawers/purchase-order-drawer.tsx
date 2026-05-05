"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn, looksLikeUuid } from "@/lib/utils"
import { usePurchaseOrders, type PurchaseOrder, type POStatus, type POLineItem } from "@/lib/purchase-order-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { blockCreateIfNotEligible } from "@/lib/billing/guard-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerToastStack, type ToastItem,
} from "@/components/detail-drawer"
import {
  Mail, Download, CheckCircle2, Copy, X, PackageCheck,
  Building2, Truck, CreditCard, FileText, Paperclip,
  Wrench, User, Plus, Trash2, ChevronRight, Pencil, Check, AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { AddVendorModal } from "@/components/vendors/add-vendor-modal"

let toastCounter = 0

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<POStatus, { className: string; label: string }> = {
  "Draft":              { label: "Draft",              className: "bg-muted text-muted-foreground border-border" },
  "Sent":               { label: "Sent",               className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Approved":           { label: "Approved",           className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Ordered":            { label: "Ordered",            className: "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25" },
  "Partially Received": { label: "Partially Received", className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Received":           { label: "Received",           className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Closed":             { label: "Closed",             className: "bg-muted text-muted-foreground border-border" },
}

const ALL_STATUSES: POStatus[] = ["Draft", "Sent", "Approved", "Ordered", "Partially Received", "Received", "Closed"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function purchaseOrderDrawerTitle(o: PurchaseOrder): string {
  const poNumber = o.purchaseOrderNumber?.trim()
  if (poNumber) return poNumber
  const id = o.id.trim()
  if (looksLikeUuid(id)) return `Purchase order · ${o.vendor}`
  return "Purchase Order"
}

// ─── Draft state shape ────────────────────────────────────────────────────────

interface Draft {
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
  lineItems: POLineItem[]
}

function toDraft(order: PurchaseOrder): Draft {
  return {
    vendorId:    order.vendorId,
    vendor:      order.vendor,
    vendorEmail: order.vendorEmail ?? "",
    vendorPhone: order.vendorPhone ?? "",
    vendorContactName: order.vendorContactName ?? "",
    shipTo:      order.shipTo,
    billTo:      order.billTo,
    orderedDate: order.orderedDate,
    eta:         order.eta,
    notes:       order.notes,
    lineItems:   order.lineItems.map((i) => ({ ...i })),
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

// ─── Drawer shell (aligned with Invoice / Quote drawers) ─────────────────────

const drawerBodyClass = "-mx-5 -my-5 min-h-full bg-muted/20 px-5 py-5 space-y-5"
const sectionCardClass = "rounded-xl border border-border bg-white shadow-sm"

// ─── Edit form field density (aligned with PO create modal) ───────────────────

const editField = "h-9 w-full min-w-0 text-sm bg-white border-border text-foreground"
const editTextarea = "min-h-[100px] resize-none text-sm leading-relaxed bg-white border-border text-foreground"
const lineItemField = "h-9 w-full min-w-0 text-sm tabular-nums bg-white border-border text-foreground"
const lineItemDesc = "h-9 w-full min-w-0 text-sm bg-white border-border text-foreground"

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-foreground block mb-1.5">{children}</span>
}

// ─── PO Drawer ────────────────────────────────────────────────────────────────

interface Props {
  orderId: string | null
  onClose: () => void
}

export function PurchaseOrderDrawer({
  orderId,
  onClose,
}: Props) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { standardCreateEligibility } = useBillingAccess()
  const { orders, updateOrder, archiveOrder } = usePurchaseOrders()
  const order = orders.find((o) => o.id === orderId) ?? null

  const [toasts, setToasts]               = useState<ToastItem[]>([])
  const [editing, setEditing]             = useState(false)
  const [draft, setDraft]                 = useState<Draft | null>(null)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [vendorQuery, setVendorQuery] = useState("")
  const [vendorMenuOpen, setVendorMenuOpen] = useState(false)
  const [addVendorOpen, setAddVendorOpen] = useState(false)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  function toast(message: string, type: "success" | "info" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    if (!editing || orgStatus !== "ready" || !organizationId) return
    let cancelled = false
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
    })()
    return () => {
      cancelled = true
    }
  }, [editing, orgStatus, organizationId])

  function startEdit() {
    if (!order) return
    setDraft(toDraft(order))
    setVendorQuery(order.vendor)
    setEditing(true)
    setStatusMenuOpen(false)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
    setVendorMenuOpen(false)
  }

  async function saveEdit() {
    if (!order || !draft) return
    const total = draft.lineItems.reduce((s, i) => s + i.lineTotalCents, 0) / 100
    const { error } = await updateOrder(order.id, {
      vendorId:    draft.vendorId,
      vendor:      draft.vendor,
      vendorEmail: draft.vendorEmail || undefined,
      vendorPhone: draft.vendorPhone || undefined,
      vendorContactName: draft.vendorContactName || undefined,
      shipTo:      draft.shipTo,
      billTo:      draft.billTo,
      orderedDate: draft.orderedDate,
      eta:         draft.eta,
      notes:       draft.notes,
      lineItems:   draft.lineItems,
      amount:      total,
    })
    if (error) {
      toast(`Could not update purchase order: ${error}`, "info")
      return
    }
    setEditing(false)
    setDraft(null)
    toast("Purchase order updated successfully")
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function selectVendor(v: VendorRow) {
    if (!draft) return
    setDraft({
      ...draft,
      vendorId: v.id,
      vendor: v.name,
      vendorEmail: v.email ?? "",
      vendorPhone: v.phone ?? "",
      vendorContactName: v.contact_name ?? "",
      billTo: v.billing_address ?? draft.billTo,
      shipTo: v.shipping_address ?? draft.shipTo,
    })
    setVendorQuery(v.name)
    setVendorMenuOpen(false)
  }

  async function changeStatus(s: POStatus) {
    if (!order) return
    const { error } = await updateOrder(order.id, { status: s })
    if (error) {
      toast(`Could not update status: ${error}`, "info")
      return
    }
    setStatusMenuOpen(false)
    toast(`Status updated to "${s}"`)
  }

  async function handleEmail() {
    if (!order) return
    const { error } = await updateOrder(order.id, { status: "Sent" })
    if (error) {
      toast(`Could not update status: ${error}`, "info")
      return
    }
    toast(
      `Marked as Sent. Email delivery is not configured yet — your vendor was not emailed automatically.`,
      "info",
    )
  }

  async function handleMarkReceived() {
    if (!order) return
    const { error } = await updateOrder(order.id, { status: "Received" })
    if (error) {
      toast(`Could not mark received: ${error}`, "info")
      return
    }
    toast("Marked as Received")
  }

  async function handleArchiveConfirmed() {
    if (!order) return
    const { error } = await archiveOrder(order.id)
    if (error) {
      toast(`Could not archive purchase order: ${error}`, "info")
      return
    }
    setConfirmArchiveOpen(false)
    toast("Purchase order archived")
    onClose()
  }

  async function handleDeleteConfirmed() {
    if (!order) return
    // Safe behavior: use soft-delete semantics for delete action.
    const { error } = await archiveOrder(order.id)
    if (error) {
      toast(`Could not delete purchase order: ${error}`, "info")
      return
    }
    setConfirmDeleteOpen(false)
    toast("Purchase order deleted")
    onClose()
  }

  if (!order) {
    return (
      <DetailDrawer open={!!orderId} onClose={onClose} title="Purchase Order" width="lg">
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Order not found.
        </div>
      </DetailDrawer>
    )
  }

  const statusCfg = STATUS_CONFIG[order.status]
  const lineTotalCents  = (editing ? draft!.lineItems : order.lineItems).reduce((s, i) => s + i.lineTotalCents, 0)
  const canReceive = !editing && (order.status === "Ordered" || order.status === "Partially Received")
  const canCancel  = !editing && order.status !== "Closed" && order.status !== "Received"
  const canSend    = !editing && (order.status === "Draft" || order.status === "Approved")

  return (
    <>
      <DetailDrawer
        open={!!orderId}
        onClose={onClose}
        title={purchaseOrderDrawerTitle(order)}
        subtitle={`${order.vendor} — ${fmtDate(order.orderedDate)}`}
        width="lg"
        badge={
          <div className="relative">
            <button
              onClick={() => !editing && setStatusMenuOpen((v) => !v)}
              className={cn("flex items-center gap-1", editing && "pointer-events-none opacity-60")}
              aria-label="Change status"
            >
              <Badge variant="outline" className={cn("text-[10px] font-semibold", !editing && "cursor-pointer hover:opacity-80 transition-opacity", statusCfg.className)}>
                {order.status}
              </Badge>
            </button>
            {statusMenuOpen && !editing && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden min-w-[168px]">
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2",
                      order.status === s && "font-semibold text-primary"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_CONFIG[s].className.split(" ").find(c => c.startsWith("bg-")))} />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
        actions={
          editing ? (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={() => void saveEdit()}>
                <Check className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-not-allowed opacity-60" disabled title="Coming soon">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-not-allowed opacity-60" disabled title="Coming soon">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {canSend && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={() => void handleEmail()}>
                  <Mail className="w-3.5 h-3.5" /> Email PO
                </Button>
              )}
              {canReceive && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={() => void handleMarkReceived()}>
                  <PackageCheck className="w-3.5 h-3.5" /> Mark Received
                </Button>
              )}
              {canCancel && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setConfirmArchiveOpen(true)}
                  >
                    <X className="w-3.5 h-3.5" /> Archive PO
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete PO
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        <div className={drawerBodyClass}>
        {editing && draft ? (
          <>
            <DrawerSection title="Vendor Information">
              <div className={cn(sectionCardClass, "p-4 space-y-4")}>
                <div className="relative w-full">
                  <FieldLabel>Vendor Name</FieldLabel>
                  <Input
                    className={editField}
                    value={vendorQuery}
                    onFocus={() => setVendorMenuOpen(true)}
                    onChange={(e) => {
                      setVendorQuery(e.target.value)
                      setVendorMenuOpen(true)
                      setField("vendorId", undefined)
                      setField("vendor", e.target.value)
                    }}
                    placeholder="Search or enter vendor"
                  />
                  {vendorMenuOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
                      {vendors
                        .filter((v) => v.name.toLowerCase().includes(vendorQuery.toLowerCase()))
                        .map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => selectVendor(v)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/60 text-sm"
                          >
                            <div className="font-medium text-foreground">{v.name}</div>
                            {v.email && <div className="text-xs text-muted-foreground">{v.email}</div>}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (blockCreateIfNotEligible(standardCreateEligibility)) return
                          setVendorMenuOpen(false)
                          setAddVendorOpen(true)
                        }}
                        className="w-full text-left px-3 py-2.5 border-t border-border text-sm text-primary hover:bg-muted/60"
                      >
                        + Add New Vendor
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Vendor Email</FieldLabel>
                    <Input
                      className={editField}
                      type="email"
                      value={draft.vendorEmail}
                      onChange={(e) => setField("vendorEmail", e.target.value)}
                      placeholder="vendor@example.com"
                    />
                  </div>
                  <div>
                    <FieldLabel>Contact Name</FieldLabel>
                    <Input
                      className={editField}
                      value={draft.vendorContactName}
                      onChange={(e) => setField("vendorContactName", e.target.value)}
                      placeholder="Contact name"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Phone Number</FieldLabel>
                  <Input
                    className={editField}
                    value={draft.vendorPhone}
                    onChange={(e) => setField("vendorPhone", e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <FieldLabel>Shipping Address</FieldLabel>
                  <Input
                    className={editField}
                    value={draft.shipTo}
                    onChange={(e) => setField("shipTo", e.target.value)}
                    placeholder="Shipping address"
                  />
                </div>
                <div>
                  <FieldLabel>Billing Address</FieldLabel>
                  <Input
                    className={editField}
                    value={draft.billTo}
                    onChange={(e) => setField("billTo", e.target.value)}
                    placeholder="Billing address"
                  />
                </div>
              </div>
            </DrawerSection>

            <DrawerSection title="Order Details">
              <div className={cn(sectionCardClass, "p-4 space-y-4")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Order Date</FieldLabel>
                    <Input
                      className={editField}
                      type="date"
                      value={draft.orderedDate}
                      onChange={(e) => setField("orderedDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel>Expected Delivery Date</FieldLabel>
                    <Input className={editField} type="date" value={draft.eta} onChange={(e) => setField("eta", e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order total</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">{fmtCurrency(lineTotalCents / 100)}</span>
                </div>
              </div>
            </DrawerSection>

            {(order.workOrderId || order.customerName) && (
              <DrawerSection title="Related Records">
                <div className={cn(sectionCardClass, "p-4 space-y-3")}>
                  {order.workOrderId && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-28 shrink-0">Work Order</span>
                      <Link
                        href={`/work-orders?open=${order.workOrderId}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        {getWorkOrderDisplay({ id: order.workOrderId })}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                  {order.customerName && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-28 shrink-0">Customer</span>
                      <Link
                        href={`/customers?open=${order.customerId}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <User className="w-3.5 h-3.5" />
                        {order.customerName}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </DrawerSection>
            )}

            <DrawerSection title="Line Items">
              <div className={cn(sectionCardClass, "p-4 space-y-4")}>
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="min-w-[560px] space-y-3">
                    <div className="grid grid-cols-[minmax(10rem,1fr)_90px_120px_120px_36px] gap-3 items-end pb-2 border-b border-border">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Quantity</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Unit Cost</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Line Total</span>
                      <span className="sr-only">Remove</span>
                    </div>
                    {draft.lineItems.map((item, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[minmax(10rem,1fr)_90px_120px_120px_36px] gap-3 items-center"
                      >
                        <Input
                          className={lineItemDesc}
                          value={item.description}
                          onChange={(e) =>
                            setField(
                              "lineItems",
                              draft.lineItems.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                            )
                          }
                          placeholder="Description"
                        />
                        <Input
                          type="number"
                          className={cn(lineItemField, "text-right")}
                          value={item.quantity}
                          min={1}
                          onChange={(e) =>
                            setField(
                              "lineItems",
                              draft.lineItems.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      quantity: Number(e.target.value),
                                      lineTotalCents: Math.round(Number(e.target.value) * x.unitCostCents),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          className={cn(lineItemField, "text-right")}
                          value={(item.unitCostCents / 100).toFixed(2)}
                          min={0}
                          onChange={(e) =>
                            setField(
                              "lineItems",
                              draft.lineItems.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      unitCostCents: Math.round(Number(e.target.value) * 100),
                                      lineTotalCents: Math.round(x.quantity * Math.round(Number(e.target.value) * 100)),
                                    }
                                  : x,
                              ),
                            )
                          }
                          placeholder="0.00"
                        />
                        <div className="text-right text-sm font-semibold text-foreground tabular-nums py-2">
                          {fmtCurrency(item.lineTotalCents / 100)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setField("lineItems", draft.lineItems.filter((_, j) => j !== i))}
                          className="flex justify-center text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                          aria-label="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setField("lineItems", [
                      ...draft.lineItems,
                      { description: "", quantity: 1, unitCostCents: 0, lineTotalCents: 0 },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                >
                  <Plus className="w-4 h-4" /> Add line item
                </button>
                {draft.lineItems.length > 0 && (
                  <div className="flex justify-end pt-3 border-t border-border">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subtotal</p>
                      <p className="text-base font-bold text-foreground tabular-nums">{fmtCurrency(lineTotalCents / 100)}</p>
                    </div>
                  </div>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="Notes">
              <div className={cn(sectionCardClass, "p-4")}>
                <Textarea
                  className={editTextarea}
                  rows={4}
                  value={draft.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Add notes..."
                />
              </div>
            </DrawerSection>

            <DrawerSection title="Attachments">
              {order.attachments.length === 0 ? (
                <div className={cn(sectionCardClass, "border-dashed px-4 py-8 flex flex-col items-center gap-2")}>
                  <Paperclip className="w-5 h-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground text-center">No attachments</p>
                  <button type="button" disabled className="text-xs text-muted-foreground cursor-not-allowed" title="Coming soon">
                    Upload file
                  </button>
                </div>
              ) : (
                <div className={cn(sectionCardClass, "divide-y divide-border overflow-hidden p-0")}>
                  {order.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-card">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground flex-1 truncate">{a}</span>
                      <button
                        type="button"
                        disabled
                        className="text-muted-foreground/50 cursor-not-allowed p-1"
                        title="Coming soon"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>
          </>
        ) : (
          <>
            <DrawerSection title="Vendor Information">
              <div className={cn(sectionCardClass, "p-4 space-y-0")}>
              <DrawerRow
                label="Vendor Name"
                value={
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {order.vendor}
                  </span>
                }
              />
              <DrawerRow
                label="Vendor Email"
                value={
                  order.vendorEmail ? (
                    <a href={`mailto:${order.vendorEmail}`} className="text-primary hover:underline">
                      {order.vendorEmail}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <DrawerRow
                label="Contact Name"
                value={order.vendorContactName || <span className="text-muted-foreground">—</span>}
              />
              <DrawerRow label="Phone Number" value={order.vendorPhone || <span className="text-muted-foreground">—</span>} />
              <DrawerRow
                label="Shipping Address"
                value={
                  <span className="flex items-start gap-1 text-right">
                    <Truck className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    {order.shipTo}
                  </span>
                }
              />
              <DrawerRow
                label="Billing Address"
                value={
                  <span className="flex items-start gap-1 text-right">
                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    {order.billTo}
                  </span>
                }
              />
              </div>
            </DrawerSection>

            <DrawerSection title="Order Details">
              <div className={cn(sectionCardClass, "p-4 space-y-0")}>
              <DrawerRow label="Order Date" value={fmtDate(order.orderedDate)} />
              <DrawerRow label="Expected Delivery Date" value={fmtDate(order.eta)} />
              <DrawerRow
                label="Total Amount"
                value={<span className="text-base font-bold text-foreground">{fmtCurrency(lineTotalCents / 100)}</span>}
              />
              </div>
            </DrawerSection>

            {(order.workOrderId || order.customerId) && (
              <DrawerSection title="Related Records">
                <div className={cn(sectionCardClass, "p-4 space-y-0")}>
                {order.workOrderId && (
                  <DrawerRow
                    label="Work Order"
                    value={
                      <Link
                        href={`/work-orders?open=${order.workOrderId}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Wrench className="w-3 h-3" />
                        {getWorkOrderDisplay({ id: order.workOrderId })}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    }
                  />
                )}
                {order.customerId && (
                  <DrawerRow
                    label="Customer"
                    value={
                      <Link
                        href={`/customers?open=${order.customerId}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <User className="w-3 h-3" />
                        {order.customerName?.trim() || "Customer"}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    }
                  />
                )}
                </div>
              </DrawerSection>
            )}

            <DrawerSection title="Line Items">
              <div className={cn(sectionCardClass, "overflow-hidden p-0")}>
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                        Description
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-10">
                        Quantity
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-20">
                        Unit Cost
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-20">
                        Line Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.lineItems.map((item, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2 text-foreground">{item.description}</td>
                        <td className="px-3 py-2 text-right text-foreground tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmtCurrency(item.unitCostCents / 100)}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(item.lineTotalCents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">
                        Subtotal
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">{fmtCurrency(lineTotalCents / 100)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </DrawerSection>

            <DrawerSection title="Notes">
              <div className={cn(sectionCardClass, "p-4")}>
                {order.notes ? (
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap p-3 rounded-lg border border-border bg-white">
                    {order.notes}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="Attachments">
              {order.attachments.length === 0 ? (
                <div className={cn(sectionCardClass, "border-dashed flex flex-col items-center gap-2 py-8")}>
                  <Paperclip className="w-5 h-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No attachments</p>
                  <button type="button" disabled className="text-xs text-muted-foreground cursor-not-allowed" title="Coming soon">
                    Upload file
                  </button>
                </div>
              ) : (
                <div className={cn(sectionCardClass, "divide-y divide-border overflow-hidden p-0")}>
                  {order.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-white">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground flex-1 truncate">{a}</span>
                      <button
                        type="button"
                        disabled
                        className="text-muted-foreground/50 cursor-not-allowed"
                        title="Coming soon"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>
          </>
        )}
        </div>
      </DetailDrawer>

      <AddVendorModal
        open={addVendorOpen}
        onClose={() => setAddVendorOpen(false)}
        initialName={vendorQuery}
        stackAboveDrawer
        onSaved={(v) => {
          const vendor = v as VendorRow
          setVendors((prev) => [...prev, vendor].sort((a, b) => a.name.localeCompare(b.name)))
          selectVendor(vendor)
        }}
      />

      {confirmArchiveOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmArchiveOpen(false)} />
          <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[color:var(--status-warning)]" />
              <h3 className="text-sm font-semibold text-foreground">Archive Purchase Order?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This will hide the purchase order from the active list. You can restore it later from archive views.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setConfirmArchiveOpen(false)}>Cancel</Button>
              <Button size="sm" variant="default" onClick={() => void handleArchiveConfirmed()}>Archive</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteOpen(false)} />
          <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">Delete Purchase Order?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Delete uses safe soft-delete behavior. This will not remove related vendor, customer, equipment, or work-order records.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={() => void handleDeleteConfirmed()}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      <DrawerToastStack toasts={toasts} onRemove={removeToast} />
    </>
  )
}
