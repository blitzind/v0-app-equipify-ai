"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { usePurchaseOrders, type PurchaseOrder, type POStatus, type POLineItem } from "@/lib/purchase-order-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerToastStack, type ToastItem,
} from "@/components/detail-drawer"
import {
  Mail, Download, CheckCircle2, Copy, X, PackageCheck,
  Building2, Truck, CreditCard, FileText, Paperclip,
  Wrench, User, Plus, Trash2, ChevronRight, Pencil, Check,
} from "lucide-react"
import Link from "next/link"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

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

// ─── Draft state shape ────────────────────────────────────────────────────────

interface Draft {
  vendor: string
  vendorEmail: string
  shipTo: string
  billTo: string
  orderedDate: string
  eta: string
  notes: string
  lineItems: POLineItem[]
}

function toDraft(order: PurchaseOrder): Draft {
  return {
    vendor:      order.vendor,
    vendorEmail: order.vendorEmail ?? "",
    shipTo:      order.shipTo,
    billTo:      order.billTo,
    orderedDate: order.orderedDate,
    eta:         order.eta,
    notes:       order.notes,
    lineItems:   order.lineItems.map((i) => ({ ...i })),
  }
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"

// ─── PO Drawer ────────────────────────────────────────────────────────────────

interface Props {
  orderId: string | null
  onClose: () => void
}

export function PurchaseOrderDrawer({ orderId, onClose }: Props) {
  const { orders, updateOrder } = usePurchaseOrders()
  const order = orders.find((o) => o.id === orderId) ?? null

  const [toasts, setToasts]               = useState<ToastItem[]>([])
  const [editing, setEditing]             = useState(false)
  const [draft, setDraft]                 = useState<Draft | null>(null)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)

  function toast(message: string, type: "success" | "info" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function startEdit() {
    if (!order) return
    setDraft(toDraft(order))
    setEditing(true)
    setStatusMenuOpen(false)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
  }

  function saveEdit() {
    if (!order || !draft) return
    const total = draft.lineItems.reduce((s, i) => s + i.qty * i.unitCost, 0)
    updateOrder(order.id, {
      vendor:      draft.vendor,
      vendorEmail: draft.vendorEmail || undefined,
      shipTo:      draft.shipTo,
      billTo:      draft.billTo,
      orderedDate: draft.orderedDate,
      eta:         draft.eta,
      notes:       draft.notes,
      lineItems:   draft.lineItems,
      amount:      total,
    })
    setEditing(false)
    setDraft(null)
    toast("Purchase order updated successfully")
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function changeStatus(s: POStatus) {
    if (!order) return
    updateOrder(order.id, { status: s })
    setStatusMenuOpen(false)
    toast(`Status updated to "${s}"`)
  }

  function handleDuplicate() {
    toast("PO duplicated — open Drafts to review", "info")
  }

  function handleEmail() {
    toast(`Email sent to ${order?.vendorEmail ?? order?.vendor}`)
  }

  function handleDownload() {
    toast("PDF download started", "info")
  }

  function handleMarkReceived() {
    if (!order) return
    updateOrder(order.id, { status: "Received" })
    toast("Marked as Received")
  }

  function handleCancel() {
    if (!order) return
    updateOrder(order.id, { status: "Closed" })
    toast("Purchase order cancelled")
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
  const lineTotal  = (editing ? draft!.lineItems : order.lineItems).reduce((s, i) => s + i.qty * i.unitCost, 0)
  const canReceive = !editing && (order.status === "Ordered" || order.status === "Partially Received")
  const canCancel  = !editing && order.status !== "Closed" && order.status !== "Received"
  const canSend    = !editing && (order.status === "Draft" || order.status === "Approved")

  return (
    <>
      <DetailDrawer
        open={!!orderId}
        onClose={onClose}
        title={order.id}
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
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={saveEdit}>
                <Check className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleDuplicate}>
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {canSend && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleEmail}>
                  <Mail className="w-3.5 h-3.5" /> Email PO
                </Button>
              )}
              {canReceive && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleMarkReceived}>
                  <PackageCheck className="w-3.5 h-3.5" /> Mark Received
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer text-destructive hover:text-destructive" onClick={handleCancel}>
                  <X className="w-3.5 h-3.5" /> Cancel PO
                </Button>
              )}
            </>
          )
        }
      >
        {/* ── Vendor & Addresses ─────────────────────────────────────────────── */}
        <DrawerSection title="Vendor">
          <DrawerRow label="Vendor" value={
            editing ? (
              <input className={inputCls} value={draft!.vendor} onChange={(e) => setField("vendor", e.target.value)} />
            ) : (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                {order.vendor}
              </span>
            )
          } />
          <DrawerRow label="Email" value={
            editing ? (
              <input className={inputCls} type="email" value={draft!.vendorEmail} onChange={(e) => setField("vendorEmail", e.target.value)} placeholder="vendor@example.com" />
            ) : order.vendorEmail ? (
              <a href={`mailto:${order.vendorEmail}`} className="text-primary hover:underline">{order.vendorEmail}</a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          } />
          <DrawerRow label="Ship To" value={
            editing ? (
              <input className={inputCls} value={draft!.shipTo} onChange={(e) => setField("shipTo", e.target.value)} />
            ) : (
              <span className="flex items-start gap-1 text-right">
                <Truck className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                {order.shipTo}
              </span>
            )
          } />
          <DrawerRow label="Bill To" value={
            editing ? (
              <input className={inputCls} value={draft!.billTo} onChange={(e) => setField("billTo", e.target.value)} />
            ) : (
              <span className="flex items-start gap-1 text-right">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                {order.billTo}
              </span>
            )
          } />
        </DrawerSection>

        {/* ── Dates & Amounts ───────────────────────────────────────────────── */}
        <DrawerSection title="Order Details">
          <DrawerRow label="Ordered Date" value={
            editing ? (
              <input className={inputCls} type="date" value={draft!.orderedDate} onChange={(e) => setField("orderedDate", e.target.value)} />
            ) : fmtDate(order.orderedDate)
          } />
          <DrawerRow label="ETA" value={
            editing ? (
              <input className={inputCls} type="date" value={draft!.eta} onChange={(e) => setField("eta", e.target.value)} />
            ) : fmtDate(order.eta)
          } />
          <DrawerRow label="Total Amount" value={
            <span className="text-base font-bold text-foreground">{fmtCurrency(lineTotal)}</span>
          } />
        </DrawerSection>

        {/* ── Related Records ───────────────────────────────────────────────── */}
        {(order.workOrderId || order.customerName) && (
          <DrawerSection title="Related Records">
            {order.workOrderId && (
              <DrawerRow label="Work Order" value={
                <Link
                  href={`/work-orders?open=${order.workOrderId}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Wrench className="w-3 h-3" />
                  {getWorkOrderDisplay({ id: order.workOrderId })}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              } />
            )}
            {order.customerName && (
              <DrawerRow label="Customer" value={
                <Link
                  href={`/customers?open=${order.customerId}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <User className="w-3 h-3" />
                  {order.customerName}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              } />
            )}
          </DrawerSection>
        )}

        {/* ── Line Items ────────────────────────────────────────────────────── */}
        <DrawerSection title="Items">
          {editing ? (
            <div className="space-y-2">
              {draft!.lineItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={cn(inputCls, "flex-1")}
                    value={item.description}
                    onChange={(e) => setField("lineItems", draft!.lineItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    className={cn(inputCls, "w-14 text-right")}
                    value={item.qty}
                    min={1}
                    onChange={(e) => setField("lineItems", draft!.lineItems.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))}
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    className={cn(inputCls, "w-20 text-right")}
                    value={item.unitCost}
                    min={0}
                    onChange={(e) => setField("lineItems", draft!.lineItems.map((x, j) => j === i ? { ...x, unitCost: Number(e.target.value) } : x))}
                    placeholder="Unit $"
                  />
                  <button
                    onClick={() => setField("lineItems", draft!.lineItems.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setField("lineItems", [...draft!.lineItems, { description: "", qty: 1, unitCost: 0 }])}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
              {draft!.lineItems.length > 0 && (
                <div className="flex justify-end pt-1 border-t border-border mt-2">
                  <span className="text-xs font-semibold text-foreground">
                    Total: {fmtCurrency(lineTotal)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Description</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-10">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-20">Unit Cost</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-20">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.lineItems.map((item, i) => (
                    <tr key={i} className="bg-card">
                      <td className="px-3 py-2 text-foreground">{item.description}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmtCurrency(item.unitCost)}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/40 border-t border-border">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">{fmtCurrency(lineTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DrawerSection>

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        <DrawerSection title="Notes">
          {editing ? (
            <textarea
              className={cn(inputCls, "resize-none leading-relaxed")}
              rows={4}
              value={draft!.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Add notes..."
            />
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {order.notes || <span className="italic">No notes.</span>}
            </p>
          )}
        </DrawerSection>

        {/* ── Attachments ──────────────────────────────────────────────────── */}
        <DrawerSection title="Attachments">
          {order.attachments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 rounded-lg border border-dashed border-border">
              <Paperclip className="w-5 h-5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No attachments</p>
              <button className="text-xs text-primary hover:underline">Upload file</button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {order.attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{a}</span>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={removeToast} />
    </>
  )
}
