"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import { createWorkOrderFromMaintenancePlan } from "@/lib/maintenance-plans/create-work-order-from-plan"
import type { MaintenancePlan, PlanStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DetailDrawer,
  DrawerSection,
  DrawerRow,
  DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  Play,
  Pause,
  Zap,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  MoreHorizontal,
  ScrollText,
} from "lucide-react"
import { ReminderRulesPanel } from "@/components/reminders/reminder-rules-panel"
import { ContactActions } from "@/components/contact-actions"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  loadPlanAutomationEvents,
  type PlanAutomationEventRow,
} from "@/lib/maintenance-plans/automation-events"

let toastCounter = 0

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function daysToDue(dateStr: string) {
  const due = new Date(dateStr + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

function fmtDateTime(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function eventTypeLabel(t: PlanAutomationEventRow["event_type"]) {
  switch (t) {
    case "wo_created":
      return "WO created"
    case "skipped_duplicate":
      return "Skipped (duplicate)"
    case "run_error":
      return "Error"
    case "plan_paused":
      return "Paused"
    case "plan_resumed":
      return "Resumed"
    default:
      return t
  }
}

interface MaintenancePlanDrawerProps {
  planId: string | null
  onClose: () => void
}

export function MaintenancePlanDrawer({ planId, onClose }: MaintenancePlanDrawerProps) {
  const router = useRouter()
  const {
    plans,
    setStatus,
    updateRules,
    archivePlan,
    deletePlan,
    organizationId,
  } = useMaintenancePlans()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [woBusy, setWoBusy] = useState(false)
  const [autoEvents, setAutoEvents] = useState<PlanAutomationEventRow[]>([])
  const [autoEventsLoading, setAutoEventsLoading] = useState(false)

  const plan = planId ? plans.find((p) => p.id === planId) ?? null : null
  const watchedPlan = planId ? plans.find((p) => p.id === planId) : undefined

  useEffect(() => {
    if (!planId || !organizationId) {
      setAutoEvents([])
      return
    }
    let cancelled = false
    void (async () => {
      setAutoEventsLoading(true)
      const supabase = createBrowserSupabaseClient()
      const { events, error } = await loadPlanAutomationEvents(supabase, organizationId, planId)
      if (cancelled) return
      setAutoEvents(error ? [] : events)
      setAutoEventsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [planId, organizationId, watchedPlan?.status])

  function toast(message: string, type: ToastItem["type"] = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!plan) return null

  const activePlan = plan

  const days = daysToDue(activePlan.nextDueDate)
  const daysLabel =
    days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `In ${days}d`
  const daysColor =
    days < 0 ? "text-destructive" : days <= 7 ? "text-[color:var(--status-warning)]" : "text-muted-foreground"

  const enabledRules = activePlan.notificationRules.filter((r) => r.enabled)
  const totalCost = activePlan.services.reduce((a, s) => a + s.estimatedCost, 0)
  const totalHours = activePlan.services.reduce((a, s) => a + s.estimatedHours, 0)

  function handleEdit() {
    router.push(`/maintenance-plans?open=${activePlan.id}`)
    onClose()
  }

  async function handlePauseResume() {
    const next: PlanStatus = activePlan.status === "Active" ? "Paused" : "Active"
    const res = await setStatus(activePlan.id, next)
    if (res.error) {
      toast(res.error, "info")
      return
    }
    toast(next === "Paused" ? "Plan paused" : "Plan resumed")
  }

  async function handleCreateWo() {
    if (!organizationId) {
      toast("No default organization.", "info")
      return
    }
    if (!activePlan.equipmentId?.trim()) {
      toast("Attach equipment to this plan before creating a work order.", "info")
      return
    }
    setWoBusy(true)
    const { error } = await createWorkOrderFromMaintenancePlan({ organizationId, plan: activePlan })
    setWoBusy(false)
    if (error) {
      toast(error, "info")
      return
    }
    toast("Work order created")
  }

  async function handleConfirmArchive() {
    setActionBusy(true)
    const res = await archivePlan(activePlan.id)
    setActionBusy(false)
    setArchiveOpen(false)
    if (res.error) {
      toast(res.error, "info")
      return
    }
    toast("Plan archived")
    onClose()
  }

  async function handleConfirmDelete() {
    setActionBusy(true)
    const res = await deletePlan(activePlan.id)
    setActionBusy(false)
    setDeleteOpen(false)
    if (res.error) {
      toast(res.error, "info")
      return
    }
    toast("Plan deleted")
    onClose()
  }

  const statusBadgeClass =
    activePlan.status === "Active"
      ? "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
      : activePlan.status === "Expired"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30"

  return (
    <>
      <DetailDrawer
        open={!!planId}
        onClose={onClose}
        title={activePlan.name}
        subtitle={`${activePlan.customerName} · ${activePlan.equipmentName}`}
        width="xl"
        transitionMs={400}
        badge={
          <Badge variant="secondary" className={cn("text-xs border", statusBadgeClass)}>
            {activePlan.status}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1.5 w-full">
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={handleEdit}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs cursor-pointer"
              onClick={() => void handlePauseResume()}
            >
              {activePlan.status === "Active" ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Resume
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs cursor-pointer"
              onClick={() => void handleCreateWo()}
              disabled={woBusy || !organizationId || !activePlan.equipmentId?.trim()}
            >
              {woBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              Create WO
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="h-8 w-8 cursor-pointer p-0" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setArchiveOpen(true)}>
                  <Archive className="w-4 h-4" /> Archive plan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4" /> Delete plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      >
        {/* Details */}
        <DrawerSection title="Plan Details">
          <DrawerRow
            label="Customer"
            value={
              <Link
                href={`/customers?open=${activePlan.customerId}`}
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                {activePlan.customerName}
              </Link>
            }
          />
          <DrawerRow
            label="Equipment"
            value={
              activePlan.equipmentId?.trim() ? (
                <Link
                  href={`/equipment?open=${activePlan.equipmentId}`}
                  className="text-primary hover:underline cursor-pointer font-medium"
                >
                  {activePlan.equipmentName || "Equipment"}
                </Link>
              ) : (
                <span className="text-muted-foreground">Not attached yet — edit plan to add equipment.</span>
              )
            }
          />
          <DrawerRow label="Category" value={activePlan.equipmentCategory} />
          <DrawerRow label="Location" value={activePlan.location} />
          {activePlan.location && (
            <div className="py-1">
              <ContactActions address={activePlan.location} email={{ customerName: activePlan.customerName }} />
            </div>
          )}
          <DrawerRow
            label="Technician"
            value={
              <Link
                href={`/technicians?open=${activePlan.technicianId}`}
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                {activePlan.technicianName}
              </Link>
            }
          />
          <DrawerRow
            label="Interval"
            value={
              activePlan.interval === "Custom"
                ? `Every ${activePlan.customIntervalDays} days`
                : activePlan.interval
            }
          />
          <DrawerRow label="Start Date" value={fmtDate(activePlan.startDate)} />
          <DrawerRow label="Last Service" value={fmtDate(activePlan.lastServiceDate)} />
          <DrawerRow
            label="Next Due"
            value={
              <span className={cn("font-semibold", daysColor)}>
                {fmtDate(activePlan.nextDueDate)} · {daysLabel}
              </span>
            }
          />
          <DrawerRow label="Total Completed" value={`${activePlan.totalServicesCompleted} services`} />
        </DrawerSection>

        {/* Work Order settings */}
        <DrawerSection title="Work Order Settings">
          <DrawerRow label="Auto-Create WO" value={activePlan.autoCreateWorkOrder ? "Yes" : "No"} />
          <DrawerRow label="WO Type" value={activePlan.workOrderType} />
          <DrawerRow label="WO Priority" value={activePlan.workOrderPriority} />
        </DrawerSection>

        {/* Services */}
        <DrawerSection title={`Services (${activePlan.services.length})`}>
          {activePlan.services.length > 0 ? (
            <div className="space-y-1.5">
              {activePlan.services.map((svc) => (
                <div
                  key={svc.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{svc.name}</p>
                    {svc.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{svc.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {svc.estimatedHours}h · ${svc.estimatedCost.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-xs font-semibold text-foreground">
                <span>Estimated Total</span>
                <span>
                  ${totalCost.toLocaleString()} · {totalHours}h
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No services configured.</p>
          )}
        </DrawerSection>

        {/* Notification Rules — editable */}
        <DrawerSection title="Automation history">
          <div className="flex items-center gap-2 mb-2">
            <ScrollText className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
            <p className="text-[10px] text-muted-foreground leading-snug">
              PM engine runs nightly. Pauses, work orders, and skips are recorded here.
            </p>
          </div>
          {autoEventsLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading history…</p>
          ) : autoEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 rounded-xl border border-dashed border-border">
              No automation events yet.
            </p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {autoEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-border bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{fmtDateTime(ev.created_at)}</span>
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {eventTypeLabel(ev.event_type)}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground mt-1.5 leading-snug">{ev.message}</p>
                  {ev.work_order_id ? (
                    <Link
                      href={`/work-orders/${ev.work_order_id}`}
                      className="inline-flex text-xs font-medium text-primary hover:underline mt-2"
                    >
                      Open work order
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DrawerSection>

        <DrawerSection title={`Reminder Rules (${enabledRules.length} active)`}>
          <ReminderRulesPanel
            planId={activePlan.id}
            rules={activePlan.notificationRules}
            onSave={async (rules) => {
              const res = await updateRules(activePlan.id, rules)
              if (res.error) {
                toast(res.error, "info")
                return
              }
              toast("Reminder rules saved")
            }}
          />
        </DrawerSection>

        {/* Notes */}
        {activePlan.notes && (
          <DrawerSection title="Notes">
            <p className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              {activePlan.notes}
            </p>
          </DrawerSection>
        )}

      </DetailDrawer>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              It will disappear from maintenance schedules and plan lists. You can keep audit context in your database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <Button variant="default" disabled={actionBusy} onClick={() => void handleConfirmArchive()} className="gap-2">
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this maintenance plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives the plan, marks it expired, and turns off automatic work order creation. The row stays in
              your database for compliance but will no longer appear in the app&apos;s active maintenance views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={actionBusy} onClick={() => void handleConfirmDelete()} className="gap-2">
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete plan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
