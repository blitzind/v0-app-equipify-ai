"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { equipment, workOrders } from "@/lib/mock-data"
import type { Equipment } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { Wrench, ClipboardList, FileText, AlertTriangle, Calendar } from "lucide-react"

let toastCounter = 0

const STATUS_COLORS: Record<Equipment["status"], string> = {
  "Active": "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function daysToDue(nextDueDate: string) {
  const due = new Date(nextDueDate + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

interface EquipmentDrawerProps {
  equipmentId: string | null
  onClose: () => void
}

export function EquipmentDrawer({ equipmentId, onClose }: EquipmentDrawerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const eq = equipmentId ? equipment.find((e) => e.id === equipmentId) ?? null : null
  const eqWOs = eq ? workOrders.filter((w) => w.equipmentId === eq.id) : []

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!eq) return null

  const days = daysToDue(eq.nextDueDate)
  const daysLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`
  const daysColor = days < 0 ? "text-destructive" : days <= 7 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"

  const warrantyDays = daysToDue(eq.warrantyExpiration)
  const warrantyLabel = warrantyDays < 0 ? "Expired" : warrantyDays <= 90 ? `Expires in ${warrantyDays}d` : fmtDate(eq.warrantyExpiration)
  const warrantyColor = warrantyDays < 0 ? "text-destructive" : warrantyDays <= 90 ? "text-[color:var(--status-warning)]" : "text-foreground"

  const timelineItems = [
    ...eq.serviceHistory.slice(0, 6).map((h) => ({
      date: h.date,
      label: `${h.type} — ${h.workOrderId}`,
      description: h.description + (h.technician ? ` · ${h.technician}` : ""),
      accent: (h.status === "Completed" ? "success" : "muted") as "success" | "muted",
    })),
  ]

  return (
    <>
      <DetailDrawer
        open={!!equipmentId}
        onClose={onClose}
        title={eq.model}
        subtitle={`${eq.id} · ${eq.manufacturer}`}
        width="lg"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_COLORS[eq.status])}>
            {eq.status}
          </Badge>
        }
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Work order created")}>
              <ClipboardList className="w-3.5 h-3.5" /> Create WO
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Service log downloaded")}>
              <FileText className="w-3.5 h-3.5" /> Export Log
            </Button>
          </>
        }
      >
        {/* Service urgency banner */}
        {days <= 7 && (
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

        {/* Details */}
        <DrawerSection title="Equipment Details">
          <DrawerRow label="Serial Number" value={eq.serialNumber} />
          <DrawerRow label="Category" value={eq.category} />
          <DrawerRow label="Customer" value={eq.customerName} />
          <DrawerRow label="Location" value={eq.location} />
          <DrawerRow label="Installed" value={fmtDate(eq.installDate)} />
        </DrawerSection>

        {/* Service */}
        <DrawerSection title="Service Information">
          <DrawerRow label="Last Service" value={fmtDate(eq.lastServiceDate)} />
          <DrawerRow
            label="Next Due"
            value={<span className={cn("font-semibold", daysColor)}>{fmtDate(eq.nextDueDate)} · {daysLabel}</span>}
          />
          <DrawerRow
            label="Warranty"
            value={<span className={warrantyColor}>{warrantyLabel}</span>}
          />
        </DrawerSection>

        {/* Work Order summary */}
        <DrawerSection title={`Work Orders (${eqWOs.length})`}>
          <div className="space-y-1.5">
            {eqWOs.slice(0, 5).map((wo) => (
              <div key={wo.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{wo.id}</p>
                  <p className="text-[10px] text-muted-foreground">{wo.type} · {wo.technicianName}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{wo.status}</Badge>
              </div>
            ))}
            {eqWOs.length === 0 && (
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

        {/* Manuals / Photos */}
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
        {eq.notes && (
          <DrawerSection title="Notes">
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
              {eq.notes}
            </p>
          </DrawerSection>
        )}
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
