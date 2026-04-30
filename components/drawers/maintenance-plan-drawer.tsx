"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import type { MaintenancePlan, PlanStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  Play, Pause, Zap, Bell, CheckCircle2, ClipboardList, Calendar, Wrench,
} from "lucide-react"

let toastCounter = 0

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function daysToDue(dateStr: string) {
  const due = new Date(dateStr + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

const CHANNEL_STYLE: Record<string, string> = {
  "Email":          "bg-blue-50 text-blue-700 border-blue-200",
  "SMS":            "bg-green-50 text-green-700 border-green-200",
  "Internal Alert": "bg-violet-50 text-violet-700 border-violet-200",
}

interface MaintenancePlanDrawerProps {
  planId: string | null
  onClose: () => void
}

export function MaintenancePlanDrawer({ planId, onClose }: MaintenancePlanDrawerProps) {
  const { plans, setStatus } = useMaintenancePlans()
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const plan = planId ? plans.find((p) => p.id === planId) ?? null : null

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!plan) return null

  const days = daysToDue(plan.nextDueDate)
  const daysLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `In ${days}d`
  const daysColor = days < 0 ? "text-destructive" : days <= 7 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"

  const enabledRules = plan.notificationRules.filter((r) => r.enabled)
  const totalCost = plan.services.reduce((a, s) => a + s.estimatedCost, 0)
  const totalHours = plan.services.reduce((a, s) => a + s.estimatedHours, 0)

  return (
    <>
      <DetailDrawer
        open={!!planId}
        onClose={onClose}
        title={plan.name}
        subtitle={`${plan.customerName} · ${plan.equipmentName}`}
        width="lg"
        badge={
          <Badge
            variant="secondary"
            className={cn(
              "text-xs border",
              plan.status === "Active"
                ? "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
                : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30"
            )}
          >
            {plan.status}
          </Badge>
        }
        actions={
          <>
            {plan.status === "Active" ? (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                setStatus(plan.id, "Paused")
                toast("Plan paused")
              }}>
                <Pause className="w-3.5 h-3.5" /> Pause Plan
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                setStatus(plan.id, "Active")
                toast("Plan activated")
              }}>
                <Play className="w-3.5 h-3.5" /> Activate Plan
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Work order created from plan")}>
              <Zap className="w-3.5 h-3.5" /> Create WO Now
            </Button>
          </>
        }
      >
        {/* Details */}
        <DrawerSection title="Plan Details">
          <DrawerRow label="Customer" value={plan.customerName} />
          <DrawerRow label="Equipment" value={plan.equipmentName} />
          <DrawerRow label="Category" value={plan.equipmentCategory} />
          <DrawerRow label="Location" value={plan.location} />
          <DrawerRow label="Technician" value={plan.technicianName} />
          <DrawerRow label="Interval" value={plan.interval === "Custom" ? `Every ${plan.customIntervalDays} days` : plan.interval} />
          <DrawerRow label="Start Date" value={fmtDate(plan.startDate)} />
          <DrawerRow label="Last Service" value={fmtDate(plan.lastServiceDate)} />
          <DrawerRow
            label="Next Due"
            value={<span className={cn("font-semibold", daysColor)}>{fmtDate(plan.nextDueDate)} · {daysLabel}</span>}
          />
          <DrawerRow label="Total Completed" value={`${plan.totalServicesCompleted} services`} />
        </DrawerSection>

        {/* Work Order settings */}
        <DrawerSection title="Work Order Settings">
          <DrawerRow label="Auto-Create WO" value={plan.autoCreateWorkOrder ? "Yes" : "No"} />
          <DrawerRow label="WO Type" value={plan.workOrderType} />
          <DrawerRow label="WO Priority" value={plan.workOrderPriority} />
        </DrawerSection>

        {/* Services */}
        <DrawerSection title={`Services (${plan.services.length})`}>
          {plan.services.length > 0 ? (
            <div className="space-y-1.5">
              {plan.services.map((svc) => (
                <div key={svc.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{svc.name}</p>
                    {svc.description && <p className="text-[10px] text-muted-foreground mt-0.5">{svc.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{svc.estimatedHours}h · ${svc.estimatedCost.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-xs font-semibold text-foreground">
                <span>Estimated Total</span>
                <span>${totalCost.toLocaleString()} · {totalHours}h</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No services configured.</p>
          )}
        </DrawerSection>

        {/* Notifications */}
        <DrawerSection title={`Notification Rules (${enabledRules.length} active)`}>
          {enabledRules.length > 0 ? (
            <div className="space-y-1.5">
              {enabledRules.slice(0, 6).map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", CHANNEL_STYLE[rule.channel] ?? "bg-muted text-muted-foreground border-border")}>
                      {rule.channel}
                    </span>
                    <span className="text-xs text-muted-foreground">{rule.triggerDays}d before</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{rule.recipients[0]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No active notification rules.</p>
          )}
        </DrawerSection>

        {/* Notes */}
        {plan.notes && (
          <DrawerSection title="Notes">
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
              {plan.notes}
            </p>
          </DrawerSection>
        )}
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
