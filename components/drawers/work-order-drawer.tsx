"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { loadWorkOrderDetailForOrg } from "@/lib/work-orders/detail-load"
import { serializeRepairLog } from "@/lib/work-orders/parse-repair-log"
import {
  WorkOrderDetailExperience,
  buildWorkOrderActivityItems,
} from "@/components/work-orders/work-order-detail-experience"
import { useToast } from "@/hooks/use-toast"
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { Pencil, X, Check, AlertOctagon, ExternalLink } from "lucide-react"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"

let toastCounter = 0

// ─── Status / priority maps ───────────────────────────────────────────────────

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
const ALL_TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

function uiStatusToDb(s: WorkOrderStatus): string {
  const m: Record<WorkOrderStatus, string> = {
    Open: "open",
    Scheduled: "scheduled",
    "In Progress": "in_progress",
    Completed: "completed",
    Invoiced: "invoiced",
  }
  return m[s]
}

function uiPriorityToDb(p: WorkOrderPriority): string {
  const m: Record<WorkOrderPriority, string> = {
    Low: "low",
    Normal: "normal",
    High: "high",
    Critical: "critical",
  }
  return m[p]
}

function uiTypeToDb(t: WorkOrderType): string {
  const m: Record<WorkOrderType, string> = {
    Repair: "repair",
    PM: "pm",
    Inspection: "inspection",
    Install: "install",
    Emergency: "emergency",
  }
  return m[t]
}

function normalizeTimeForDb(time: string): string | null {
  if (!time || !time.trim()) return null
  const t = time.trim()
  if (t.length === 5 && t.includes(":")) return `${t}:00`
  return t
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

// ─── Edit controls ────────────────────────────────────────────────────────────

function EditInput({
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  step,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  min?: number
  step?: number
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
    />
  )
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
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

function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
    />
  )
}

function EditRow({ label, view, editing, children }: {
  label: string; view: React.ReactNode; editing: boolean; children: React.ReactNode
}) {
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
  onUpdated?: () => void
}

type TechnicianOption = { id: string; label: string; avatarUrl?: string | null }

// ─── Component ────────────────────────────────────────────────────────────────

const DRAWER_LABOR_RATE = 95

function initialsFromTechnicianLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function WorkOrderDrawer({ workOrderId, onClose, onUpdated }: WorkOrderDrawerProps) {
  const { toast: pushToast } = useToast()
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [dbNotes, setDbNotes] = useState("")
  const [planServices, setPlanServices] = useState<unknown[] | null>(null)
  const [technicianOptions, setTechnicianOptions] = useState<TechnicianOption[]>([])
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<WorkOrder>>({})
  const [draftNotesDb, setDraftNotesDb] = useState("")
  const [draftDiagnosis, setDraftDiagnosis] = useState("")
  const [draftNotes, setDraftNotes] = useState("")
  const [draftLaborDollars, setDraftLaborDollars] = useState("")
  const [draftPartsDollars, setDraftPartsDollars] = useState("")

  const loadWorkOrder = useCallback(async () => {
    if (!workOrderId) {
      setWo(null)
      return
    }

    setLoading(true)
    const supabase = createBrowserSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setWo(null)
      setLoading(false)
      return
    }

    const orgId = orgStatus === "ready" ? activeOrgId : null
    if (!orgId) {
      setWo(null)
      setLoading(false)
      return
    }

    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "manager", "tech"])

    const userIds = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))]
    let techOpts: TechnicianOption[] = []
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds)
      techOpts =
        ((profs as Array<{
          id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
        }> | null) ?? []).map((p) => ({
          id: p.id,
          label:
            (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Team member",
          avatarUrl: p.avatar_url?.trim() || null,
        }))
      techOpts.sort((a, b) => a.label.localeCompare(b.label))
    }
    setTechnicianOptions(techOpts)

    const res = await loadWorkOrderDetailForOrg(supabase, orgId, workOrderId)
    if (!res.ok) {
      setWo(null)
      setLoading(false)
      return
    }
    setDbNotes(res.data.notes)
    setPlanServices(res.data.planServices)
    setWo(res.data.workOrder)
    setLoading(false)
  }, [workOrderId, activeOrgId, orgStatus])

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setDraftNotesDb("")
    setDraftDiagnosis("")
    setDraftNotes("")
    setDraftLaborDollars("")
    setDraftPartsDollars("")
    void loadWorkOrder()
  }, [workOrderId, loadWorkOrder])

  const displayWo = useMemo((): WorkOrder | null => {
    if (!wo) return null
    if (!editing) return wo
    return {
      ...wo,
      description: (draft.description ?? wo.description) as string,
      type: (draft.type ?? wo.type) as WorkOrder["type"],
      status: (draft.status ?? wo.status) as WorkOrderStatus,
      priority: (draft.priority ?? wo.priority) as WorkOrderPriority,
      technicianId: (draft.technicianId ?? wo.technicianId) as string,
      technicianName: (draft.technicianName ?? wo.technicianName) as string,
      technicianAvatarUrl:
        (draft.technicianAvatarUrl !== undefined ? draft.technicianAvatarUrl : wo.technicianAvatarUrl) ??
        null,
      scheduledDate: (draft.scheduledDate ?? wo.scheduledDate) as string,
      scheduledTime: (draft.scheduledTime ?? wo.scheduledTime) as string,
    }
  }, [wo, editing, draft])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!wo) return
    setDraft({
      description: wo.description,
      type: wo.type,
      technicianId: wo.technicianId,
      technicianName: wo.technicianName,
      technicianAvatarUrl: wo.technicianAvatarUrl ?? null,
      priority: wo.priority,
      status: wo.status,
      scheduledDate: wo.scheduledDate ?? "",
      scheduledTime: wo.scheduledTime ?? "",
    })
    setDraftNotesDb(dbNotes)
    setDraftNotes(wo.repairLog.technicianNotes ?? "")
    setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
    setDraftLaborDollars(String(wo.totalLaborCost ?? 0))
    setDraftPartsDollars(String(wo.totalPartsCost ?? 0))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftNotesDb(dbNotes)
    if (wo) {
      setDraftNotes(wo.repairLog.technicianNotes ?? "")
      setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
    }
  }

  async function saveEdit() {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()

    const laborCents = Math.max(0, Math.round(parseFloat(draftLaborDollars || "0") * 100))
    const partsCents = Math.max(0, Math.round(parseFloat(draftPartsDollars || "0") * 100))

    const tid = (draft.technicianId ?? wo.technicianId) === "unassigned" ? null : (draft.technicianId ?? wo.technicianId)

    const updatePayload = {
      title: (draft.description ?? wo.description).trim(),
      status: uiStatusToDb((draft.status ?? wo.status) as WorkOrderStatus),
      priority: uiPriorityToDb((draft.priority ?? wo.priority) as WorkOrderPriority),
      type: uiTypeToDb((draft.type ?? wo.type) as WorkOrderType),
      scheduled_on: (draft.scheduledDate ?? wo.scheduledDate) || null,
      scheduled_time: normalizeTimeForDb(draft.scheduledTime ?? wo.scheduledTime ?? ""),
      assigned_user_id: tid,
      notes: draftNotesDb.trim() || null,
      total_labor_cents: laborCents,
      total_parts_cents: partsCents,
      repair_log: {
        ...serializeRepairLog(wo.repairLog),
        diagnosis: draftDiagnosis,
        technicianNotes: draftNotes,
      },
    }

    const { error } = await supabase
      .from("work_orders")
      .update(updatePayload)
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }

    setEditing(false)
    setDraft({})
    toast("Work order updated successfully")
    await loadWorkOrder()
    onUpdated?.()
  }

  async function markComplete() {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }
    toast("Work order marked complete")
    await loadWorkOrder()
    onUpdated?.()
  }

  async function archiveWorkOrder() {
    if (!wo || !activeOrgId) return
    if (!window.confirm("Archive this work order?")) return
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Archive failed: ${error.message}`)
      return
    }
    toast("Work order archived")
    onUpdated?.()
    onClose()
  }

  function setField<K extends keyof WorkOrder>(field: K, value: WorkOrder[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  if (!workOrderId) return null

  if (!wo) {
    return (
      <DetailDrawer
        open={!!workOrderId}
        onClose={onClose}
        title={loading ? "Loading work order…" : "Work order not found"}
        subtitle={loading ? "Fetching details" : "It may be archived or unavailable"}
        width="lg"
        transitionMs={400}
      >
        <div className="px-5 py-6 text-sm text-muted-foreground">
          {loading ? "Loading…" : "Unable to load this work order."}
        </div>
      </DetailDrawer>
    )
  }

  const currentStatus = (draft.status ?? wo.status) as WorkOrderStatus

  const quoteHref = `/quotes?action=new-quote&customerId=${encodeURIComponent(wo.customerId)}&equipmentId=${encodeURIComponent(wo.equipmentId)}`

  return (
    <>
      <DetailDrawer
        open={!!workOrderId}
        onClose={onClose}
        title={getWorkOrderDisplay(wo)}
        subtitle={
          `${wo.customerName} · ${wo.equipmentName} · ${wo.type}` +
          (wo.maintenancePlanId ? " · Preventive maintenance" : "")
        }
        width="xl"
        transitionMs={400}
        noScroll
        badge={
          <Badge variant="secondary" className={cn("text-xs border shrink-0", STATUS_STYLE[currentStatus])}>
            {currentStatus}
          </Badge>
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
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit
              </Button>
              <Button size="sm" variant="outline" asChild className="text-xs cursor-pointer">
                <Link href={`/work-orders/${wo.id}`} className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Full profile
                </Link>
              </Button>
            </>
          )
        }
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          {editing && (
            <div className="max-h-[42vh] shrink-0 space-y-4 overflow-y-auto border-b border-border px-5 py-4">
              <DrawerSection title="Job settings">
                <EditRow label="Type" view={wo.type} editing>
                  <EditSelect
                    value={(draft.type ?? wo.type) as string}
                    onChange={(v) => setField("type", v as WorkOrderType)}
                    options={ALL_TYPES}
                  />
                </EditRow>
                <EditRow
                  label="Priority"
                  view={<span className={PRIORITY_COLOR[wo.priority]}>{wo.priority}</span>}
                  editing
                >
                  <EditSelect
                    value={draft.priority ?? wo.priority}
                    onChange={(v) => setField("priority", v as WorkOrderPriority)}
                    options={ALL_PRIORITIES}
                  />
                </EditRow>
                <EditRow
                  label="Status"
                  view={
                    <Badge variant="secondary" className={cn("text-[10px] border", STATUS_STYLE[wo.status])}>
                      {wo.status}
                    </Badge>
                  }
                  editing
                >
                  <EditSelect
                    value={draft.status ?? wo.status}
                    onChange={(v) => setField("status", v as WorkOrderStatus)}
                    options={ALL_STATUSES}
                  />
                </EditRow>
                <EditRow
                  label="Technician"
                  view={
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <TechnicianAvatar
                        userId={wo.technicianId === "unassigned" ? "—" : wo.technicianId}
                        name={wo.technicianName}
                        initials={initialsFromTechnicianLabel(wo.technicianName)}
                        avatarUrl={wo.technicianAvatarUrl}
                        size="sm"
                      />
                      {wo.technicianId !== "unassigned" ? (
                        <Link
                          href={`/technicians?open=${wo.technicianId}`}
                          className="text-primary hover:underline cursor-pointer font-medium truncate"
                        >
                          {wo.technicianName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{wo.technicianName}</span>
                      )}
                    </span>
                  }
                  editing
                >
                  <select
                    value={draft.technicianId ?? wo.technicianId ?? "unassigned"}
                    onChange={(e) => {
                      const id = e.target.value
                      if (id === "unassigned") {
                        setDraft((prev) => ({
                          ...prev,
                          technicianId: id,
                          technicianName: "Unassigned",
                          technicianAvatarUrl: null,
                        }))
                        return
                      }
                      const opt = technicianOptions.find((x) => x.id === id)
                      setDraft((prev) => ({
                        ...prev,
                        technicianId: id,
                        technicianName: opt?.label ?? "Unknown",
                        technicianAvatarUrl: opt?.avatarUrl ?? null,
                      }))
                    }}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="unassigned">Unassigned</option>
                    {technicianOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </EditRow>
                <EditRow
                  label="Scheduled"
                  view={
                    wo.scheduledDate
                      ? `${fmtDate(wo.scheduledDate)}${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}`
                      : "—"
                  }
                  editing
                >
                  <div className="flex gap-2">
                    <EditInput type="date" value={draft.scheduledDate ?? ""} onChange={(v) => setField("scheduledDate", v)} />
                    <EditInput type="time" value={draft.scheduledTime ?? ""} onChange={(v) => setField("scheduledTime", v)} />
                  </div>
                </EditRow>
                {wo.completedDate && <DrawerRow label="Completed" value={fmtDate(wo.completedDate)} />}
                {wo.invoiceNumber && (
                  <DrawerRow
                    label="Invoice"
                    value={
                      <Link
                        href={`/invoices?open=${wo.invoiceNumber}`}
                        className="text-primary font-mono hover:underline cursor-pointer"
                      >
                        {wo.invoiceNumber}
                      </Link>
                    }
                  />
                )}
              </DrawerSection>

              <DrawerSection title="Title & internal notes">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                    <EditInput
                      value={draft.description ?? wo.description}
                      onChange={(v) => setField("description", v)}
                      placeholder="Work order title"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Internal notes</p>
                    <EditTextarea
                      value={draftNotesDb}
                      onChange={setDraftNotesDb}
                      placeholder="Office / dispatcher notes…"
                      rows={4}
                    />
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection title="Stored labor & parts (totals)">
                <EditRow label="Labor cost ($)" view={fmtCurrency(wo.totalLaborCost)} editing>
                  <EditInput
                    type="number"
                    min={0}
                    step={0.01}
                    value={draftLaborDollars}
                    onChange={setDraftLaborDollars}
                    placeholder="0"
                  />
                </EditRow>
                <EditRow label="Parts cost ($)" view={fmtCurrency(wo.totalPartsCost)} editing>
                  <EditInput
                    type="number"
                    min={0}
                    step={0.01}
                    value={draftPartsDollars}
                    onChange={setDraftPartsDollars}
                    placeholder="0"
                  />
                </EditRow>
              </DrawerSection>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkOrderDetailExperience
            layout="drawer"
            workOrder={displayWo ?? wo}
            internalNotes={editing ? draftNotesDb : dbNotes}
            internalNotesEditable={false}
            planServices={planServices}
            activityItems={buildWorkOrderActivityItems(wo)}
            problemReported={wo.repairLog.problemReported}
            onProblemReportedChange={() => {}}
            diagnosis={editing ? draftDiagnosis : wo.repairLog.diagnosis}
            onDiagnosisChange={setDraftDiagnosis}
            technicianNotes={editing ? draftNotes : wo.repairLog.technicianNotes}
            onTechnicianNotesChange={setDraftNotes}
            parts={wo.repairLog.partsUsed}
            onPartsChange={() => {}}
            laborHours={wo.repairLog.laborHours}
            onLaborHoursChange={() => {}}
            laborRatePerHour={DRAWER_LABOR_RATE}
            photos={wo.repairLog.photos}
            onPhotosChange={() => {}}
            tasks={wo.repairLog.tasks ?? []}
            onTasksChange={() => {}}
            sigData={wo.repairLog.signatureDataUrl}
            signedBy={wo.repairLog.signedBy}
            signedAt={wo.repairLog.signedAt}
            onSignatureSave={() => {}}
            fieldsEditable={editing}
            problemEditable={false}
            partsPhotosEditable={false}
            signatureEditable={false}
            tasksEditable={false}
            onEditWorkOrder={startEdit}
            onAssignTechnician={() => {
              startEdit()
              pushToast({
                title: "Assign technician",
                description: "Choose a technician under Job settings, then save changes.",
              })
            }}
            onMarkComplete={() => void markComplete()}
            quoteHref={quoteHref}
            onInvoicePlaceholder={() =>
              pushToast({
                title: "Invoices",
                description: "Creating an invoice from this drawer is not connected yet.",
              })
            }
            onPrint={() => toast("Print preview is not wired yet.")}
            onArchive={() => void archiveWorkOrder()}
          />
          </div>
        </div>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
