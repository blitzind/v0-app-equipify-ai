"use client"

import { useState, useMemo } from "react"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import { useWorkOrders } from "@/lib/work-order-store"
import { cn } from "@/lib/utils"
import { customers, equipment, technicians } from "@/lib/mock-data"
import type {
  MaintenancePlan,
  PlanInterval,
  PlanStatus,
  NotificationChannel,
  NotificationTriggerDays,
  WorkOrderType,
  WorkOrderPriority,
  NotificationRule,
} from "@/lib/mock-data"
import type { WorkOrder } from "@/lib/mock-data"
import {
  Search,
  Plus,
  ChevronRight,
  X,
  Bell,
  BellOff,
  Zap,
  Wrench,
  Calendar,
  Settings2,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Mail,
  MessageSquare,
  MonitorCheck,
  Clock,
  Edit3,
  Save,
  BadgeCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PlanStatus, { label: string; className: string; Icon: React.ElementType }> = {
  Active:  { label: "Active",  className: "ds-badge-success",  Icon: CheckCircle2 },
  Paused:  { label: "Paused",  className: "ds-badge-warning",  Icon: PauseCircle },
  Expired: { label: "Expired", className: "ds-badge-danger",   Icon: AlertTriangle },
}

const INTERVAL_LABELS: Record<PlanInterval, string> = {
  Annual:       "Annual",
  "Semi-Annual": "Semi-Annual",
  Quarterly:    "Quarterly",
  Monthly:      "Monthly",
  Custom:       "Custom",
}

const CHANNEL_CONFIG: Record<NotificationChannel, { Icon: React.ElementType; color: string }> = {
  "Email":          { Icon: Mail,          color: "ds-icon-info" },
  "SMS":            { Icon: MessageSquare, color: "ds-icon-success" },
  "Internal Alert": { Icon: MonitorCheck,  color: "ds-icon-accent" },
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyClass(days: number): string {
  if (days < 0)   return "ds-text-danger font-semibold"
  if (days <= 7)  return "ds-text-danger font-medium"
  if (days <= 14) return "ds-text-warning font-medium"
  if (days <= 30) return "ds-text-warning"
  return "text-muted-foreground"
}

function formatDays(days: number): string {
  if (days < 0)  return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `Due in ${days}d`
}

function nextWoId(count: number): string {
  return `WO-${2050 + count}`
}

// ─── Create Plan Modal ────────────────────────────────────────────────────────

function CreatePlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createPlan } = useMaintenancePlans()
  const [form, setForm] = useState({
    name: "",
    customerId: "",
    equipmentId: "",
    technicianId: "",
    interval: "Quarterly" as PlanInterval,
    customIntervalDays: 90,
    startDate: new Date().toISOString().split("T")[0],
    lastServiceDate: new Date().toISOString().split("T")[0],
    workOrderType: "PM" as WorkOrderType,
    workOrderPriority: "Normal" as WorkOrderPriority,
    autoCreateWorkOrder: true,
    notes: "",
    emailEnabled: true,
    smsEnabled: false,
    internalEnabled: true,
  })

  const custEquipment = equipment.filter((e) => e.customerId === form.customerId)
  const selectedCustomer = customers.find((c) => c.id === form.customerId)
  const selectedEquipment = equipment.find((e) => e.id === form.equipmentId)
  const selectedTech = technicians.find((t) => t.id === form.technicianId)

  function computeNext(last: string, interval: PlanInterval, custom: number): string {
    const d = new Date(last)
    switch (interval) {
      case "Annual":       d.setFullYear(d.getFullYear() + 1); break
      case "Semi-Annual":  d.setMonth(d.getMonth() + 6); break
      case "Quarterly":    d.setMonth(d.getMonth() + 3); break
      case "Monthly":      d.setMonth(d.getMonth() + 1); break
      case "Custom":       d.setDate(d.getDate() + (custom || 90)); break
    }
    return d.toISOString().split("T")[0]
  }

  function buildRules(): NotificationRule[] {
    const days: NotificationTriggerDays[] = [30, 14, 7, 1]
    const rules: NotificationRule[] = []
    const emails = selectedCustomer?.contacts.map((c) => c.email) ?? []
    const phones = selectedCustomer?.contacts.map((c) => c.phone).filter(Boolean) ?? []

    days.forEach((d) => {
      if (form.emailEnabled)    rules.push({ id: `r-email-${d}`,    channel: "Email",          triggerDays: d, enabled: true,      recipients: emails })
      if (form.smsEnabled)      rules.push({ id: `r-sms-${d}`,      channel: "SMS",            triggerDays: d, enabled: d <= 7,    recipients: phones })
      if (form.internalEnabled) rules.push({ id: `r-internal-${d}`, channel: "Internal Alert", triggerDays: d, enabled: d <= 14,  recipients: ["admin@equipify.ai"] })
    })
    return rules
  }

  function handleSubmit() {
    if (!form.name || !form.customerId || !form.equipmentId || !form.technicianId) return
    const nextDue = computeNext(form.lastServiceDate, form.interval, form.customIntervalDays)
    const newPlan: MaintenancePlan = {
      id: `MP-${String(Date.now()).slice(-4)}`,
      name: form.name,
      customerId: form.customerId,
      customerName: selectedCustomer?.company ?? "",
      equipmentId: form.equipmentId,
      equipmentName: selectedEquipment ? `${selectedEquipment.model}` : "",
      equipmentCategory: selectedEquipment?.category ?? "",
      location: selectedEquipment?.location ?? "",
      technicianId: form.technicianId,
      technicianName: selectedTech?.name ?? "",
      interval: form.interval,
      customIntervalDays: form.customIntervalDays,
      status: "Active",
      startDate: form.startDate,
      lastServiceDate: form.lastServiceDate,
      nextDueDate: nextDue,
      services: [],
      notificationRules: buildRules(),
      autoCreateWorkOrder: form.autoCreateWorkOrder,
      workOrderType: form.workOrderType,
      workOrderPriority: form.workOrderPriority,
      notes: form.notes,
      createdAt: new Date().toISOString(),
      totalServicesCompleted: 0,
    }
    createPlan(newPlan)
    onClose()
  }

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Maintenance Plan</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Plan Name *</label>
            <input className="input-base" placeholder="e.g. Quarterly Compressor PM" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          {/* Customer */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Customer *</label>
            <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.filter((c) => c.status === "Active").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Equipment */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Equipment *</label>
            <Select value={form.equipmentId} onValueChange={(v) => set("equipmentId", v)} disabled={!form.customerId}>
              <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
              <SelectContent>
                {custEquipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.model} — {e.location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Technician */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Assigned Technician *</label>
            <Select value={form.technicianId} onValueChange={(v) => set("technicianId", v)}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Interval */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">Service Interval *</label>
              <Select value={form.interval} onValueChange={(v) => set("interval", v as PlanInterval)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(INTERVAL_LABELS) as PlanInterval[]).map((k) => (
                    <SelectItem key={k} value={k}>{INTERVAL_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.interval === "Custom" && (
              <div className="flex flex-col gap-1.5 w-32">
                <label className="text-sm font-medium text-foreground">Every (days)</label>
                <input type="number" min={1} className="input-base" value={form.customIntervalDays} onChange={(e) => set("customIntervalDays", +e.target.value)} />
              </div>
            )}
          </div>
          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">Plan Start Date</label>
              <input type="date" className="input-base" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">Last Service Date</label>
              <input type="date" className="input-base" value={form.lastServiceDate} onChange={(e) => set("lastServiceDate", e.target.value)} />
            </div>
          </div>
          {/* Next due preview */}
          <p className="text-xs text-muted-foreground -mt-1">
            Next due: <span className="font-medium text-foreground">{computeNext(form.lastServiceDate, form.interval, form.customIntervalDays)}</span>
          </p>

          <Separator />

          {/* Auto work order */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Create Work Order</p>
              <p className="text-xs text-muted-foreground">Create a WO automatically when due date arrives</p>
            </div>
            <Switch checked={form.autoCreateWorkOrder} onCheckedChange={(v) => set("autoCreateWorkOrder", v)} />
          </div>
          {form.autoCreateWorkOrder && (
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">WO Type</label>
                <Select value={form.workOrderType} onValueChange={(v) => set("workOrderType", v as WorkOrderType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["PM", "Inspection", "Repair", "Install"] as WorkOrderType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">Priority</label>
                <Select value={form.workOrderPriority} onValueChange={(v) => set("workOrderPriority", v as WorkOrderPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Low", "Normal", "High", "Critical"] as WorkOrderPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Separator />

          {/* Notification channels */}
          <p className="text-sm font-semibold">Notification Channels</p>
          <p className="text-xs text-muted-foreground -mt-2">Alerts fire at 30, 14, 7, and 1 day before due date.</p>
          {[
            { key: "emailEnabled",    label: "Email",          sub: "Send to customer contacts",       Icon: Mail },
            { key: "smsEnabled",      label: "SMS",            sub: "Send to customer phone numbers",  Icon: MessageSquare },
            { key: "internalEnabled", label: "Internal Alert", sub: "Alert Equipify.ai admin users",   Icon: MonitorCheck },
          ].map(({ key, label, sub, Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
              <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={(v) => set(key, v)} />
            </div>
          ))}

          <Separator />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea rows={2} className="input-base resize-none" placeholder="Special instructions, access notes..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={!form.name || !form.customerId || !form.equipmentId || !form.technicianId}>
              Create Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Plan Detail Sheet ────────────────────────�������───────────────────────────────

function PlanDetailSheet({ plan, onClose }: { plan: MaintenancePlan; onClose: () => void }) {
  const { updatePlan, setStatus, updateRules, fireNotifications, notificationLog } = useMaintenancePlans()
  const { createWorkOrder, workOrders } = useWorkOrders()
  const [editNotes, setEditNotes] = useState(plan.notes)
  const [saving, setSaving] = useState(false)
  const [fired, setFired] = useState(false)
  const [woCreated, setWoCreated] = useState(false)

  const planLogs = useMemo(
    () => notificationLog.filter((l) => l.planId === plan.id).slice(0, 20),
    [notificationLog, plan.id]
  )

  const days = daysUntil(plan.nextDueDate)

  function handleSaveNotes() {
    setSaving(true)
    updatePlan(plan.id, { notes: editNotes })
    setTimeout(() => setSaving(false), 600)
  }

  function handleToggleRule(ruleId: string) {
    const updated = plan.notificationRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    )
    updateRules(plan.id, updated)
  }

  function handleFireAll() {
    fireNotifications(plan.id)
    setFired(true)
    setTimeout(() => setFired(false), 2000)
  }

  function handleAutoCreateWo() {
    const existingIds = workOrders.map((w) => parseInt(w.id.replace("WO-", "")))
    const maxId = Math.max(...existingIds, 2041)
    const newId = `WO-${maxId + 1}`
    const wo: WorkOrder = {
      id: newId,
      customerId: plan.customerId,
      customerName: plan.customerName,
      equipmentId: plan.equipmentId,
      equipmentName: plan.equipmentName,
      location: plan.location,
      type: plan.workOrderType,
      status: "Open",
      priority: plan.workOrderPriority,
      technicianId: plan.technicianId,
      technicianName: plan.technicianName,
      scheduledDate: plan.nextDueDate,
      scheduledTime: "08:00",
      completedDate: "",
      createdAt: new Date().toISOString(),
      createdBy: "Maintenance Engine",
      description: `Auto-created from plan "${plan.name}". Services: ${plan.services.map((s) => s.name).join(", ") || "See plan details"}.`,
      repairLog: {
        problemReported: `Scheduled ${plan.interval} service per maintenance plan ${plan.id}.`,
        diagnosis: "",
        partsUsed: [],
        laborHours: 0,
        technicianNotes: "",
        photos: [],
        signatureDataUrl: "",
        signedBy: "",
        signedAt: "",
      },
      totalLaborCost: 0,
      totalPartsCost: 0,
      invoiceNumber: "",
    }
    createWorkOrder(wo)
    setWoCreated(true)
    setTimeout(() => setWoCreated(false), 2500)
  }

  const groupedRules = useMemo(() => {
    const map: Record<NotificationTriggerDays, NotificationRule[]> = { 30: [], 14: [], 7: [], 1: [] }
    plan.notificationRules.forEach((r) => {
      map[r.triggerDays] = [...(map[r.triggerDays] || []), r]
    })
    return map
  }, [plan.notificationRules])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-2xl bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div className="flex flex-col gap-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{plan.id}</span>
              <StatusBadge status={plan.status} />
              {plan.autoCreateWorkOrder && (
                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                  <Zap className="w-3 h-3" /> Auto-WO
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground leading-tight">{plan.name}</h2>
            <p className="text-sm text-muted-foreground">{plan.customerName} — {plan.equipmentName}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border shrink-0">
          {[
            { label: "Interval",    value: plan.interval === "Custom" ? `Every ${plan.customIntervalDays}d` : plan.interval },
            { label: "Technician",  value: plan.technicianName },
            { label: "Last Service", value: plan.lastServiceDate },
            { label: "Next Due",    value: <span className={urgencyClass(days)}>{plan.nextDueDate} <span className="text-xs">({formatDays(days)})</span></span> },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
              <span className="text-sm font-medium text-foreground leading-snug">{value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="services" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="rounded-none border-b border-border bg-transparent px-6 justify-start gap-1 h-auto py-0 shrink-0">
            {[
              { value: "services",      label: "Services" },
              { value: "notifications", label: "Notifications" },
              { value: "log",           label: "Notification Log" },
              { value: "settings",      label: "Settings" },
            ].map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Services */}
            <TabsContent value="services" className="p-6 mt-0 flex flex-col gap-4">
              {plan.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services defined for this plan.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {plan.services.map((svc, i) => (
                    <div key={svc.id} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-background hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{svc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-xs text-muted-foreground">{svc.estimatedHours}h est.</span>
                        <span className="text-xs font-medium text-foreground">${svc.estimatedCost}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-4 pt-1 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Total est. hours: <span className="font-medium text-foreground">{plan.services.reduce((a, s) => a + s.estimatedHours, 0).toFixed(1)}h</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Total est. cost: <span className="font-medium text-foreground">${plan.services.reduce((a, s) => a + s.estimatedCost, 0).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Notes</label>
                  <Button variant="ghost" size="sm" onClick={handleSaveNotes} className="text-xs h-7 gap-1 text-primary hover:text-primary">
                    <Save className="w-3 h-3" /> {saving ? "Saved" : "Save"}
                  </Button>
                </div>
                <textarea rows={3} className="input-base resize-none text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </TabsContent>

            {/* Notification Rules */}
            <TabsContent value="notifications" className="p-6 mt-0 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Notification Rules</p>
                  <p className="text-xs text-muted-foreground">Rules fire at 30, 14, 7, and 1 day before the due date.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleFireAll} className="gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  {fired ? "Fired!" : "Simulate All"}
                </Button>
              </div>
              {([30, 14, 7, 1] as NotificationTriggerDays[]).map((trigDays) => {
                const rules = groupedRules[trigDays]
                if (!rules.length) return null
                return (
                  <div key={trigDays}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{trigDays} Day{trigDays !== 1 ? "s" : ""} Before Due</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {rules.map((rule) => {
                        const cfg = CHANNEL_CONFIG[rule.channel]
                        return (
                          <div key={rule.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors", rule.enabled ? "border-border bg-background" : "border-dashed border-border/60 bg-muted/30 opacity-60")}>
                            <cfg.Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{rule.channel}</p>
                              <p className="text-xs text-muted-foreground truncate">{rule.recipients.join(", ")}</p>
                            </div>
                            <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule.id)} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </TabsContent>

            {/* Notification Log */}
            <TabsContent value="log" className="p-6 mt-0 flex flex-col gap-3">
              {planLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications sent yet for this plan.</p>
              ) : (
                planLogs.map((log) => {
                  const cfg = CHANNEL_CONFIG[log.channel]
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                      <cfg.Icon className={cn("w-4 h-4 shrink-0 mt-0.5", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{log.channel}</span>
                          <span className="text-xs text-muted-foreground">→ {log.triggerDays}d warning</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full", log.status === "Sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{log.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{log.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{log.recipient}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{new Date(log.sentAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings" className="p-6 mt-0 flex flex-col gap-6">
              <div>
                <p className="text-sm font-semibold mb-3">Plan Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(["Active", "Paused", "Expired"] as PlanStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(plan.id, s)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                        plan.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-Create Work Orders</p>
                  <p className="text-xs text-muted-foreground">Automatically open a WO when this plan comes due</p>
                </div>
                <Switch
                  checked={plan.autoCreateWorkOrder}
                  onCheckedChange={(v) => updatePlan(plan.id, { autoCreateWorkOrder: v })}
                />
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2">Manual Work Order Creation</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Creates a work order right now using this plan&apos;s template — type <strong>{plan.workOrderType}</strong>, priority <strong>{plan.workOrderPriority}</strong>.
                </p>
                <Button onClick={handleAutoCreateWo} variant="outline" className="gap-2">
                  <Wrench className="w-4 h-4" />
                  {woCreated ? "Work Order Created!" : "Create Work Order Now"}
                </Button>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-1">Plan Info</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Plan ID</span>          <span className="font-mono text-foreground">{plan.id}</span>
                  <span className="text-muted-foreground">Created</span>          <span className="text-foreground">{new Date(plan.createdAt).toLocaleDateString()}</span>
                  <span className="text-muted-foreground">Services Completed</span> <span className="text-foreground">{plan.totalServicesCompleted}</span>
                  <span className="text-muted-foreground">Location</span>         <span className="text-foreground">{plan.location}</span>
                  <span className="text-muted-foreground">WO Type</span>          <span className="text-foreground">{plan.workOrderType}</span>
                  <span className="text-muted-foreground">WO Priority</span>      <span className="text-foreground">{plan.workOrderPriority}</span>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PlanStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.className)}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onClick }: { plan: MaintenancePlan; onClick: () => void }) {
  const days = daysUntil(plan.nextDueDate)
  const activeRules = plan.notificationRules.filter((r) => r.enabled).length

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{plan.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{plan.customerName} — {plan.equipmentName}</p>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Interval</span>
          <span className="text-xs font-medium text-foreground">{plan.interval === "Custom" ? `${plan.customIntervalDays}d` : plan.interval}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Technician</span>
          <span className="text-xs font-medium text-foreground truncate">{plan.technicianName}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Services</span>
          <span className="text-xs font-medium text-foreground">{plan.services.length} items</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={cn("text-xs", urgencyClass(days))}>{formatDays(days)}</span>
        </div>
        <div className="flex items-center gap-2">
          {plan.autoCreateWorkOrder && <Zap className="w-3.5 h-3.5 text-blue-500" aria-label="Auto work order" />}
          <div className="flex items-center gap-1">
            <Bell className={cn("w-3.5 h-3.5", activeRules > 0 ? "text-amber-500" : "text-muted-foreground/40")} />
            <span className="text-xs text-muted-foreground">{activeRules}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenancePlansPage() {
  const { plans } = useMaintenancePlans()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "All">("All")
  const [intervalFilter, setIntervalFilter] = useState<PlanInterval | "All">("All")
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [view, setView] = useState<"cards" | "table">("cards")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return plans.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false
      if (intervalFilter !== "All" && p.interval !== intervalFilter) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.customerName.toLowerCase().includes(q) && !p.equipmentName.toLowerCase().includes(q)) return false
      return true
    })
  }, [plans, search, statusFilter, intervalFilter])

  const stats = useMemo(() => {
    const active   = plans.filter((p) => p.status === "Active").length
    const due7     = plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) <= 7).length
    const due30    = plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) <= 30).length
    const autoWo   = plans.filter((p) => p.autoCreateWorkOrder).length
    return { active, due7, due30, autoWo }
  }, [plans])

  return (
    <div className="flex flex-col gap-6">
      {/* CTA row */}
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Active Plans",       value: stats.active,  sub: "currently running",          color: "text-emerald-600" },
          { label: "Due This Week",      value: stats.due7,    sub: "within 7 days",               color: "text-red-500" },
          { label: "Due This Month",     value: stats.due30,   sub: "within 30 days",              color: "text-amber-600" },
          { label: "Auto Work Orders",   value: stats.autoWo,  sub: "plans with auto-create on",  color: "text-blue-500" },
        ].map(({ label, value, sub, color }) => (
          <Card key={label} className="border border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 h-9 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
            placeholder="Search plans, customers, equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PlanStatus | "All")}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            {(["Active", "Paused", "Expired"] as PlanStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={intervalFilter} onValueChange={(v) => setIntervalFilter(v as PlanInterval | "All")}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Intervals</SelectItem>
            {(["Annual", "Semi-Annual", "Quarterly", "Monthly", "Custom"] as PlanInterval[]).map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border border-border rounded-md p-0.5 ml-auto">
          {([
            { key: "cards", label: "Cards" },
            { key: "table", label: "Table" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn("px-3 py-1.5 text-xs rounded font-medium transition-colors", view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onClick={() => setSelectedPlan(plan)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">No plans match the current filters.</div>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Plan Name", "Customer", "Equipment", "Interval", "Technician", "Next Due", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((plan) => {
                const days = daysUntil(plan.nextDueDate)
                return (
                  <tr key={plan.id} className="bg-card hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedPlan(plan)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{plan.name}</span>
                        {plan.autoCreateWorkOrder && <Zap className="w-3 h-3 text-blue-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{plan.equipmentName}</td>
                    <td className="px-4 py-3">{plan.interval === "Custom" ? `${plan.customIntervalDays}d` : plan.interval}</td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.technicianName}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", urgencyClass(days))}>{plan.nextDueDate}</span>
                      <span className={cn("block text-xs", urgencyClass(days))}>{formatDays(days)}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No plans match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreatePlanModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {selectedPlan && (
        <PlanDetailSheet
          plan={plans.find((p) => p.id === selectedPlan.id) ?? selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  )
}
