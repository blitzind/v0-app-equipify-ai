"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useEquipment } from "@/lib/equipment-store"
import { useCustomers } from "@/lib/customer-store"
import type { Equipment } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { Wrench, ClipboardList, FileText, AlertTriangle, Pencil, X, Check } from "lucide-react"
import { AIRecommendationPanel, type AIRecommendation } from "@/components/ai"

let toastCounter = 0

const STATUS_COLORS: Record<Equipment["status"], string> = {
  "Active": "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

const STATUSES: Equipment["status"][] = ["Active", "Needs Service", "In Repair", "Out of Service"]

function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function daysToDue(nextDueDate: string) {
  const due = new Date(nextDueDate + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

// ─── Shared input components ──────────────────────────────────────────────────

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

// ─── Editable row ─────────────────────────────────────────────────────────────

function EditableRow({ label, value, editing, children }: { label: string; value: React.ReactNode; editing: boolean; children?: React.ReactNode }) {
  return editing ? (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-1.5 w-28">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  ) : (
    <DrawerRow label={label} value={value} />
  )
}

// ─── AI Recommendation builder ────────────────────────────────────────────────

function buildAIRecommendations(eq: Equipment): AIRecommendation[] {
  const recs: AIRecommendation[] = []
  const days = daysToDue(eq.nextDueDate)
  const warrantyDays = daysToDue(eq.warrantyExpiration)
  const repairCount = eq.serviceHistory.filter(
    (h) => h.type === "Repair" || h.type === "Emergency"
  ).length
  const age = eq.installDate
    ? new Date().getFullYear() - new Date(eq.installDate).getFullYear()
    : 0

  // Replace soon: old age + frequent repairs
  if (age >= 10 || repairCount >= 3) {
    recs.push({
      id: "replace-soon",
      title: "Consider equipment replacement soon",
      description:
        age >= 10
          ? `This unit is approximately ${age} years old. Units beyond 10 years see significantly higher failure rates and repair costs.`
          : `This equipment has had ${repairCount} repair events. Frequent breakdowns often indicate end-of-life.`,
      severity: "warning",
      meta: age >= 10 ? `~${age} years old` : `${repairCount} repairs on record`,
      actionLabel: "Create replacement quote",
      onAction: () => undefined,
    })
  }

  // Service now: overdue or due very soon
  if (days <= 0) {
    recs.push({
      id: "service-now",
      title: "Schedule preventive service immediately",
      description: `Service is ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue. Delaying further increases the risk of unplanned downtime.`,
      severity: "critical",
      meta: `${Math.abs(days)}d overdue`,
      actionLabel: "Create work order",
      onAction: () => undefined,
    })
  } else if (days <= 14) {
    recs.push({
      id: "service-soon",
      title: "Preventive service due within 2 weeks",
      description: `Next scheduled service is in ${days} day${days !== 1 ? "s" : ""}. Book now to avoid scheduling conflicts.`,
      severity: "warning",
      meta: `Due in ${days}d`,
      actionLabel: "Schedule service",
      onAction: () => undefined,
    })
  }

  // Offer PM plan: no active plan indicator (use service history gap as proxy)
  const lastService = eq.lastServiceDate
    ? daysToDue(eq.lastServiceDate)
    : -999
  const hasGap = lastService < -180 // last service was more than 6 months ago
  if (hasGap || repairCount === 0) {
    recs.push({
      id: "pm-plan",
      title: "Offer a preventive maintenance plan",
      description:
        "This customer does not appear to have a scheduled maintenance contract for this unit. A PM plan reduces emergency call-outs and increases contract revenue.",
      severity: "info",
      meta: "Revenue opportunity",
      actionLabel: "Create maintenance plan",
      onAction: () => undefined,
    })
  }

  // Warranty expiring
  if (warrantyDays > 0 && warrantyDays <= 90) {
    recs.push({
      id: "warranty-expiring",
      title: "Warranty expiring soon",
      description: `Warranty expires in ${warrantyDays} days. Recommend performing a pre-warranty inspection and addressing any latent issues before coverage ends.`,
      severity: "info",
      meta: `Expires in ${warrantyDays}d`,
      actionLabel: "Schedule inspection",
      onAction: () => undefined,
    })
  }

  // Fallback — no issues detected
  if (recs.length === 0) {
    recs.push({
      id: "no-action",
      title: "No immediate action required",
      description: "This equipment is in good standing. Continue on current service schedule.",
      severity: "info",
      meta: "All checks passed",
    })
  }

  return recs
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EquipmentDrawerProps {
  equipmentId: string | null
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EquipmentDrawer({ equipmentId, onClose }: EquipmentDrawerProps) {
  const { equipment, updateEquipment } = useEquipment()
  const { customers } = useCustomers()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Equipment>>({})

  const eq = equipmentId ? equipment.find((e) => e.id === equipmentId) ?? null : null

  // Reset edit state when drawer opens on a different item
  useEffect(() => {
    setEditing(false)
    setDraft({})
  }, [equipmentId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!eq) return
    setDraft({
      model: eq.model,
      manufacturer: eq.manufacturer,
      category: eq.category,
      serialNumber: eq.serialNumber,
      customerId: eq.customerId,
      location: eq.location,
      installDate: eq.installDate,
      warrantyExpiration: eq.warrantyExpiration,
      lastServiceDate: eq.lastServiceDate,
      nextDueDate: eq.nextDueDate,
      status: eq.status,
      notes: eq.notes,
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
  }

  function saveEdit() {
    if (!eq) return
    const selectedCustomer = draft.customerId ? customers.find((c) => c.id === draft.customerId) : null
    updateEquipment(eq.id, {
      ...draft,
      customerName: selectedCustomer ? selectedCustomer.company : eq.customerName,
    })
    setEditing(false)
    setDraft({})
    toast("Equipment updated successfully")
  }

  function setField(field: keyof Equipment, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  if (!eq) return null

  const days = daysToDue(eq.nextDueDate)
  const daysLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`
  const daysColor = days < 0 ? "text-destructive" : days <= 7 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"

  const warrantyDays = daysToDue(eq.warrantyExpiration)
  const warrantyLabel = warrantyDays < 0 ? "Expired" : warrantyDays <= 90 ? `Expires in ${warrantyDays}d` : fmtDate(eq.warrantyExpiration)
  const warrantyColor = warrantyDays < 0 ? "text-destructive" : warrantyDays <= 90 ? "text-[color:var(--status-warning)]" : "text-foreground"

  const timelineItems = eq.serviceHistory.slice(0, 6).map((h) => ({
    date: h.date,
    label: `${h.type} — ${h.workOrderId}`,
    description: h.description + (h.technician ? ` · ${h.technician}` : ""),
    accent: (h.status === "Completed" ? "success" : "muted") as "success" | "muted",
  }))

  const currentStatus = (draft.status ?? eq.status) as Equipment["status"]

  return (
    <>
      <DetailDrawer
        open={!!equipmentId}
        onClose={onClose}
        title={eq.model}
        subtitle={`${eq.id} · ${eq.manufacturer}`}
        width="lg"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_COLORS[currentStatus])}>
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
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order created")}>
                <ClipboardList className="w-3.5 h-3.5" /> Create WO
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Service log downloaded")}>
                <FileText className="w-3.5 h-3.5" /> Export Log
              </Button>
            </>
          )
        }
      >
        {/* Service urgency banner */}
        {days <= 7 && !editing && (
          <div className={cn(
            "flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium",
            days < 0
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]"
          )}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Service {days < 0 ? "overdue" : `due in ${days} day${days !== 1 ? "s" : ""}`} — {fmtDate(eq.nextDueDate)}</span>
          </div>
        )}

        {/* AI Recommendations */}
        {!editing && (
          <AIRecommendationPanel
            title="AI Recommendations"
            recommendations={buildAIRecommendations(eq)}
            initialLimit={3}
          />
        )}

        {/* Equipment Details */}
        <DrawerSection title="Equipment Details">
          <EditableRow label="Model" value={eq.model} editing={editing}>
            <EditInput value={draft.model ?? ""} onChange={(v) => setField("model", v)} />
          </EditableRow>
          <EditableRow label="Manufacturer" value={eq.manufacturer} editing={editing}>
            <EditInput value={draft.manufacturer ?? ""} onChange={(v) => setField("manufacturer", v)} />
          </EditableRow>
          <EditableRow label="Category" value={eq.category} editing={editing}>
            <EditInput value={draft.category ?? ""} onChange={(v) => setField("category", v)} />
          </EditableRow>
          <EditableRow label="Serial Number" value={eq.serialNumber} editing={editing}>
            <EditInput value={draft.serialNumber ?? ""} onChange={(v) => setField("serialNumber", v)} />
          </EditableRow>
          <EditableRow label="Customer" value={eq.customerName} editing={editing}>
            <select
              value={draft.customerId ?? ""}
              onChange={(e) => setField("customerId", e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
            >
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </EditableRow>
          <EditableRow label="Location" value={eq.location} editing={editing}>
            <EditInput value={draft.location ?? ""} onChange={(v) => setField("location", v)} />
          </EditableRow>
          <EditableRow label="Status" value={
            <Badge variant="secondary" className={cn("text-[10px] border", STATUS_COLORS[eq.status])}>{eq.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? eq.status} onChange={(v) => setField("status", v)} options={STATUSES} />
          </EditableRow>
        </DrawerSection>

        {/* Service Information */}
        <DrawerSection title="Service Information">
          <EditableRow label="Installed" value={fmtDate(eq.installDate)} editing={editing}>
            <EditInput type="date" value={draft.installDate ?? ""} onChange={(v) => setField("installDate", v)} />
          </EditableRow>
          <EditableRow label="Last Service" value={fmtDate(eq.lastServiceDate)} editing={editing}>
            <EditInput type="date" value={draft.lastServiceDate ?? ""} onChange={(v) => setField("lastServiceDate", v)} />
          </EditableRow>
          <EditableRow
            label="Next Due"
            value={<span className={cn("font-semibold", daysColor)}>{fmtDate(eq.nextDueDate)} · {daysLabel}</span>}
            editing={editing}
          >
            <EditInput type="date" value={draft.nextDueDate ?? ""} onChange={(v) => setField("nextDueDate", v)} />
          </EditableRow>
          <EditableRow
            label="Warranty"
            value={<span className={warrantyColor}>{warrantyLabel}</span>}
            editing={editing}
          >
            <EditInput type="date" value={draft.warrantyExpiration ?? ""} onChange={(v) => setField("warrantyExpiration", v)} />
          </EditableRow>
        </DrawerSection>

        {/* Work Orders */}
        <DrawerSection title={`Work Orders`}>
          <div className="space-y-1.5">
            {eq.serviceHistory.slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{h.workOrderId}</p>
                  <p className="text-[10px] text-muted-foreground">{h.type} · {h.technician}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{h.status}</Badge>
              </div>
            ))}
            {eq.serviceHistory.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No work orders for this equipment.</p>
            )}
          </div>
        </DrawerSection>

        {/* Service history */}
        <DrawerSection title="Repair History">
          {timelineItems.length > 0 ? (
            <DrawerTimeline items={timelineItems} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No service history on record.</p>
          )}
        </DrawerSection>

        {/* Documents */}
        <DrawerSection title="Documents & Photos">
          {eq.manuals.length > 0 ? (
            <div className="space-y-1.5">
              {eq.manuals.map((m, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border border-border">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">{m}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No manuals or photos uploaded.</p>
          )}
        </DrawerSection>

        {/* Notes */}
        <DrawerSection title="Notes">
          {editing ? (
            <EditTextarea
              value={draft.notes ?? ""}
              onChange={(v) => setField("notes", v)}
              placeholder="Add notes about this equipment..."
            />
          ) : (
            eq.notes ? (
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{eq.notes}</p>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
            )
          )}
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
