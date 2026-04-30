"use client"

import { useState, useEffect } from "react"
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
  CheckCircle2, FileText, Printer, Pencil, X, Check,
  AlertTriangle, Package,
} from "lucide-react"

let toastCounter = 0

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
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

const ALL_STATUSES: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "Completed", "Invoiced"]
const ALL_PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

// ─── Edit controls ────────────────────────────────────────────────────────────

function EditInput({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkOrderDrawerProps {
  workOrderId: string | null
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkOrderDrawer({ workOrderId, onClose }: WorkOrderDrawerProps) {
  const { workOrders, updateWorkOrder, updateRepairLog } = useWorkOrders()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<WorkOrder>>({})
  const [draftNotes, setDraftNotes] = useState("")
  const [draftDiagnosis, setDraftDiagnosis] = useState("")

  const wo = workOrderId ? workOrders.find((w) => w.id === workOrderId) ?? null : null

  useEffect(() => {
    setEditing(false)
    setDraft({})
  }, [workOrderId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!wo) return
    setDraft({
      technicianName: wo.technicianName,
      priority: wo.priority,
      status: wo.status,
      scheduledDate: wo.scheduledDate ?? "",
      scheduledTime: wo.scheduledTime ?? "",
    })
    setDraftNotes(wo.repairLog.technicianNotes ?? "")
    setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
  }

  function saveEdit() {
    if (!wo) return
    updateWorkOrder(wo.id, draft)
    updateRepairLog(wo.id, {
      technicianNotes: draftNotes,
      diagnosis: draftDiagnosis,
    })
    setEditing(false)
    setDraft({})
    toast("Work order updated successfully")
  }

  function setField<K extends keyof WorkOrder>(field: K, value: WorkOrder[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  if (!wo) return null

  const currentStatus = (draft.status ?? wo.status) as WorkOrderStatus
  const currentPriority = (draft.priority ?? wo.priority) as WorkOrderPriority

  const timelineItems = [
    { date: fmtDate(wo.createdAt.slice(0, 10)), label: "Work order created", description: `Created by ${wo.createdBy}`, accent: "muted" as const },
    ...(wo.scheduledDate ? [{ date: fmtDate(wo.scheduledDate), label: `Scheduled${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}`, description: `Assigned to ${wo.technicianName}`, accent: "muted" as const }] : []),
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
          <Badge variant="secondary" className={cn("text-xs border", STATUS_STYLE[currentStatus])}>
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
              {wo.status !== "Completed" && wo.status !== "Invoiced" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order marked complete")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Invoice created")}>
                <FileText className="w-3.5 h-3.5" /> Create Invoice
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order PDF downloaded")}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
            </>
          )
        }
      >
        {/* Priority banner */}
        {currentPriority === "Critical" && !editing && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Critical priority — immediate attention required
          </div>
        )}

        {/* Details */}
        <DrawerSection title="Work Order Details">
          <DrawerRow label="Customer" value={wo.customerName} />
          <DrawerRow label="Equipment" value={wo.equipmentName} />
          <DrawerRow label="Location" value={wo.location} />
          <DrawerRow label="Type" value={wo.type} />
          <EditRow label="Priority" view={<span className={PRIORITY_COLOR[wo.priority]}>{wo.priority}</span>} editing={editing}>
            <EditSelect value={draft.priority ?? wo.priority} onChange={(v) => setField("priority", v as WorkOrderPriority)} options={ALL_PRIORITIES} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="secondary" className={cn("text-[10px] border", STATUS_STYLE[wo.status])}>{wo.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? wo.status} onChange={(v) => setField("status", v as WorkOrderStatus)} options={ALL_STATUSES} />
          </EditRow>
          <EditRow label="Technician" view={wo.technicianName} editing={editing}>
            <EditInput value={draft.technicianName ?? ""} onChange={(v) => setField("technicianName", v)} placeholder="Technician name" />
          </EditRow>
          <EditRow
            label="Scheduled"
            view={wo.scheduledDate ? `${fmtDate(wo.scheduledDate)}${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}` : "—"}
            editing={editing}
          >
            <div className="flex gap-2">
              <EditInput type="date" value={draft.scheduledDate ?? ""} onChange={(v) => setField("scheduledDate", v)} />
              <EditInput type="time" value={draft.scheduledTime ?? ""} onChange={(v) => setField("scheduledTime", v)} />
            </div>
          </EditRow>
          {wo.completedDate && <DrawerRow label="Completed" value={fmtDate(wo.completedDate)} />}
          {wo.invoiceNumber && <DrawerRow label="Invoice" value={<span className="text-primary font-mono">{wo.invoiceNumber}</span>} />}
        </DrawerSection>

        {/* Description */}
        <DrawerSection title="Description">
          <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
            {wo.description}
          </p>
        </DrawerSection>

        {/* Repair log / notes */}
        <DrawerSection title="Repair Log">
          {wo.repairLog.problemReported && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Problem Reported</p>
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                {wo.repairLog.problemReported}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</p>
            {editing ? (
              <EditTextarea value={draftDiagnosis} onChange={setDraftDiagnosis} placeholder="Enter diagnosis..." />
            ) : wo.repairLog.diagnosis ? (
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{wo.repairLog.diagnosis}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No diagnosis recorded.</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Technician Notes</p>
            {editing ? (
              <EditTextarea value={draftNotes} onChange={setDraftNotes} placeholder="Add technician notes..." />
            ) : wo.repairLog.technicianNotes ? (
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{wo.repairLog.technicianNotes}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No notes recorded.</p>
            )}
          </div>
        </DrawerSection>

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

        {/* Cost summary */}
        <DrawerSection title="Cost Summary">
          <DrawerRow label="Labor Hours" value={wo.repairLog.laborHours > 0 ? `${wo.repairLog.laborHours} hrs` : "—"} />
          <DrawerRow label="Labor Cost" value={wo.totalLaborCost > 0 ? fmtCurrency(wo.totalLaborCost) : "—"} />
          <DrawerRow label="Parts Cost" value={wo.totalPartsCost > 0 ? fmtCurrency(wo.totalPartsCost) : "—"} />
          <DrawerRow label="Total" value={<span className="font-bold text-foreground">{fmtCurrency(wo.totalLaborCost + wo.totalPartsCost)}</span>} />
        </DrawerSection>

        {/* Signature */}
        {wo.repairLog.signedBy && (
          <DrawerSection title="Signature">
            <DrawerRow label="Signed By" value={wo.repairLog.signedBy} />
            {wo.repairLog.signedAt && <DrawerRow label="Signed At" value={new Date(wo.repairLog.signedAt).toLocaleString()} />}
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
