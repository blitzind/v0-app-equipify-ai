"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useWorkOrders } from "@/lib/work-order-store"
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  CheckCircle2, FileText, Printer, User, Wrench, MapPin, Clock,
  AlertTriangle, Package, ClipboardList,
} from "lucide-react"

let toastCounter = 0

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-violet-500/10 text-violet-600 border-violet-500/30",
  "In Progress": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":   "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Invoiced":    "bg-muted text-muted-foreground border-border",
}

const PRIORITY_COLOR: Record<WorkOrderPriority, string> = {
  Low:      "text-muted-foreground",
  Normal:   "text-foreground",
  High:     "text-[color:var(--status-warning)]",
  Critical: "text-destructive font-semibold",
}

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

interface WorkOrderDrawerProps {
  workOrderId: string | null
  onClose: () => void
}

export function WorkOrderDrawer({ workOrderId, onClose }: WorkOrderDrawerProps) {
  const { workOrders } = useWorkOrders()
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const wo = workOrderId ? workOrders.find((w) => w.id === workOrderId) ?? null : null

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!wo) return null

  const timelineItems = [
    { date: fmtDate(wo.createdAt.slice(0, 10)), label: "Work order created", description: `Created by ${wo.createdBy}`, accent: "muted" as const },
    ...(wo.scheduledDate ? [{ date: fmtDate(wo.scheduledDate), label: `Scheduled — ${wo.scheduledTime ?? ""}`, description: `Assigned to ${wo.technicianName}`, accent: "muted" as const }] : []),
    ...(wo.completedDate ? [{ date: fmtDate(wo.completedDate), label: "Completed", description: wo.repairLog.technicianNotes || "Service completed", accent: "success" as const }] : []),
    ...(wo.invoiceNumber ? [{ date: "—", label: `Invoiced — ${wo.invoiceNumber}`, accent: "success" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!workOrderId}
        onClose={onClose}
        title={wo.id}
        subtitle={`${wo.type} · ${wo.customerName}`}
        width="lg"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_STYLE[wo.status])}>
            {wo.status}
          </Badge>
        }
        actions={
          <>
            {wo.status !== "Completed" && wo.status !== "Invoiced" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Work order marked complete")}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Invoice created")}>
              <FileText className="w-3.5 h-3.5" /> Create Invoice
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Work order PDF downloaded")}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </>
        }
      >
        {/* Priority banner */}
        {wo.priority === "Critical" && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Critical priority — immediate attention required
          </div>
        )}

        {/* Summary */}
        <DrawerSection title="Work Order Details">
          <DrawerRow label="Customer" value={wo.customerName} />
          <DrawerRow label="Equipment" value={wo.equipmentName} />
          <DrawerRow label="Location" value={wo.location} />
          <DrawerRow label="Type" value={wo.type} />
          <DrawerRow
            label="Priority"
            value={<span className={PRIORITY_COLOR[wo.priority]}>{wo.priority}</span>}
          />
          <DrawerRow label="Technician" value={wo.technicianName} />
          <DrawerRow label="Scheduled" value={wo.scheduledDate ? `${fmtDate(wo.scheduledDate)}${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}` : "—"} />
          {wo.completedDate && <DrawerRow label="Completed" value={fmtDate(wo.completedDate)} />}
          {wo.invoiceNumber && <DrawerRow label="Invoice" value={<span className="text-primary font-mono">{wo.invoiceNumber}</span>} />}
        </DrawerSection>

        {/* Description */}
        <DrawerSection title="Description">
          <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
            {wo.description}
          </p>
        </DrawerSection>

        {/* Repair log */}
        {(wo.repairLog.problemReported || wo.repairLog.diagnosis) && (
          <DrawerSection title="Repair Log">
            {wo.repairLog.problemReported && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Problem Reported</p>
                <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                  {wo.repairLog.problemReported}
                </p>
              </div>
            )}
            {wo.repairLog.diagnosis && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</p>
                <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                  {wo.repairLog.diagnosis}
                </p>
              </div>
            )}
            {wo.repairLog.technicianNotes && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Technician Notes</p>
                <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                  {wo.repairLog.technicianNotes}
                </p>
              </div>
            )}
          </DrawerSection>
        )}

        {/* Parts */}
        {wo.repairLog.partsUsed.length > 0 && (
          <DrawerSection title="Parts Used">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Part</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-12">Qty</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wo.repairLog.partsUsed.map((p) => (
                    <tr key={p.id} className="bg-card">
                      <td className="px-3 py-2">
                        <p className="text-foreground font-medium">{p.name}</p>
                        <p className="text-muted-foreground text-[10px]">{p.partNumber}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{p.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(p.quantity * p.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DrawerSection>
        )}

        {/* Labor + Cost summary */}
        <DrawerSection title="Cost Summary">
          <DrawerRow label="Labor Hours" value={wo.repairLog.laborHours > 0 ? `${wo.repairLog.laborHours} hrs` : "—"} />
          <DrawerRow label="Labor Cost" value={wo.totalLaborCost > 0 ? fmtCurrency(wo.totalLaborCost) : "—"} />
          <DrawerRow label="Parts Cost" value={wo.totalPartsCost > 0 ? fmtCurrency(wo.totalPartsCost) : "—"} />
          <DrawerRow
            label="Total"
            value={
              <span className="font-bold text-foreground">
                {fmtCurrency(wo.totalLaborCost + wo.totalPartsCost)}
              </span>
            }
          />
        </DrawerSection>

        {/* Signature */}
        {wo.repairLog.signedBy && (
          <DrawerSection title="Signature">
            <DrawerRow label="Signed By" value={wo.repairLog.signedBy} />
            {wo.repairLog.signedAt && (
              <DrawerRow label="Signed At" value={new Date(wo.repairLog.signedAt).toLocaleString()} />
            )}
          </DrawerSection>
        )}

        {/* Timeline */}
        <DrawerSection title="Timeline">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
