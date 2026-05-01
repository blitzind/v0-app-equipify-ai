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
  Wrench, User, Plus, Trash2, ChevronRight,
} from "lucide-react"
import Link from "next/link"

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

// ─── PO Drawer ────────────────────────────────────────────────────────────────

interface Props {
  orderId: string | null
  onClose: () => void
}

export function PurchaseOrderDrawer({ orderId, onClose }: Props) {
  const { orders, updateOrder } = usePurchaseOrders()
  const order = orders.find((o) => o.id === orderId) ?? null

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editingItems, setEditingItems] = useState(false)
  const [draftItems, setDraftItems] = useState<POLineItem[]>([])
  const [editingNotes, setEditingNotes] = useState(false)
  const [draftNotes, setDraftNotes] = useState("")
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)

  function toast(message: string, type: "success" | "info" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
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

  function startEditItems() {
    if (!order) return
    setDraftItems(order.lineItems.map((i) => ({ ...i })))
    setEditingItems(true)
  }

  function saveItems() {
    if (!order) return
    const total = draftItems.reduce((s, i) => s + i.qty * i.unitCost, 0)
    updateOrder(order.id, { lineItems: draftItems, amount: total })
    setEditingItems(false)
    toast("Line items saved")
  }

  function startEditNotes() {
    if (!order) return
    setDraftNotes(order.notes)
    setEditingNotes(true)
  }

  function saveNotes() {
    if (!order) return
    updateOrder(order.id, { notes: draftNotes })
    setEditingNotes(false)
    toast("Notes saved")
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
  const lineTotal = order.lineItems.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const canReceive = order.status === "Ordered" || order.status === "Partially Received"
  const canCancel  = order.status !== "Closed" && order.status !== "Received"
  const canSend    = order.status === "Draft" || order.status === "Approved"

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
              onClick={() => setStatusMenuOpen((v) => !v)}
              className="flex items-center gap-1"
              aria-label="Change status"
            >
              <Badge variant="outline" className={cn("text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-opacity", statusCfg.className)}>
                {order.status}
              </Badge>
            </button>
            {statusMenuOpen && (
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
          <>
            {canSend && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleEmail}>
                <Mail className="w-3.5 h-3.5" /> Email PO
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
            {canReceive && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleMarkReceived}>
                <PackageCheck className="w-3.5 h-3.5" /> Mark Received
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleDuplicate}>
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </Button>
            {canCancel && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs cursor-pointer text-destructive hover:text-destructive" onClick={handleCancel}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            )}
          </>
        }
      >
        {/* ── Vendor & Addresses ────────────────────────────────────────────── */}
        <DrawerSection title="Vendor">
          <DrawerRow label="Vendor" value={
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              {order.vendor}
            </span>
          } />
          {order.vendorEmail && (
            <DrawerRow label="Email" value={
              <a href={`mailto:${order.vendorEmail}`} className="text-primary hover:underline">{order.vendorEmail}</a>
            } />
          )}
          <DrawerRow label="Ship To" value={
            <span className="flex items-start gap-1 text-right">
              <Truck className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              {order.shipTo}
            </span>
          } />
          <DrawerRow label="Bill To" value={
            <span className="flex items-start gap-1 text-right">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              {order.billTo}
            </span>
          } />
        </DrawerSection>

        {/* ── Dates & Amounts ───────────────────────────────────────────────── */}
        <DrawerSection title="Order Details">
          <DrawerRow label="Ordered Date" value={fmtDate(order.orderedDate)} />
          <DrawerRow label="ETA" value={fmtDate(order.eta)} />
          <DrawerRow label="Total Amount" value={
            <span className="text-base font-bold text-foreground">{fmtCurrency(order.amount)}</span>
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
                  {order.workOrderId}
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
        <DrawerSection
          title="Items"
          action={
            editingItems ? (
              <div className="flex items-center gap-1">
                <button onClick={() => setEditingItems(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2">Cancel</button>
                <button onClick={saveItems} className="text-xs text-primary hover:underline font-medium px-2">Save</button>
              </div>
            ) : (
              <button onClick={startEditItems} className="text-xs text-primary hover:underline font-medium">Edit</button>
            )
          }
        >
          {editingItems ? (
            <div className="space-y-2">
              {draftItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                    value={item.description}
                    onChange={(e) => setDraftItems((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    className="w-14 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-right text-foreground"
                    value={item.qty}
                    min={1}
                    onChange={(e) => setDraftItems((prev) => prev.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))}
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-right text-foreground"
                    value={item.unitCost}
                    min={0}
                    onChange={(e) => setDraftItems((prev) => prev.map((x, j) => j === i ? { ...x, unitCost: Number(e.target.value) } : x))}
                    placeholder="Unit $"
                  />
                  <button onClick={() => setDraftItems((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDraftItems((prev) => [...prev, { description: "", qty: 1, unitCost: 0 }])}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
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
        <DrawerSection
          title="Notes"
          action={
            editingNotes ? (
              <div className="flex items-center gap-1">
                <button onClick={() => setEditingNotes(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2">Cancel</button>
                <button onClick={saveNotes} className="text-xs text-primary hover:underline font-medium px-2">Save</button>
              </div>
            ) : (
              <button onClick={startEditNotes} className="text-xs text-primary hover:underline font-medium">Edit</button>
            )
          }
        >
          {editingNotes ? (
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground resize-none leading-relaxed"
              rows={4}
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
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
