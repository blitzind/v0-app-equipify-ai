"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import {
  loadWorkOrderDetailForOrg,
  type WorkOrderDocumentItem,
  type WorkOrderPhotoGalleryItem,
} from "@/lib/work-orders/detail-load"
import { loadTechnicianAssignOptions } from "@/lib/work-orders/load-technician-assign-options"
import { AssignTechnicianDialog } from "@/components/work-orders/assign-technician-dialog"
import { repairLogJsonForPersist } from "@/lib/work-orders/parse-repair-log"
import {
  deleteWorkOrderAttachment,
  persistWorkOrderCustomerSignature,
  replaceWorkOrderLineItems,
  replaceWorkOrderTasks,
  uploadWorkOrderAttachment,
} from "@/lib/work-orders/work-order-tab-data"
import {
  assignTemplateToWorkOrder,
  createCalibrationRecord,
  isCalibrationRecordComplete,
  listCalibrationTemplates,
  loadLatestCalibrationRecord,
  type CalibrationTemplate,
} from "@/lib/calibration-certificates"
import {
  buildCertificatePrefillContext,
  certificateFieldMapsEqual,
  seedCertificateValuesForWorkOrder,
} from "@/lib/calibration-templates/prefill-from-work-order"
import {
  buildCertificatePdfHtml,
  downloadCertificateHtmlFile,
  printCertificatePdfHtml,
} from "@/lib/certificates/certificate-pdf-html"
import { certificateGateForCompletion, customerSignatureCaptured } from "@/lib/work-orders/work-order-completion"
import { CertificateTabContent } from "@/components/work-orders/certificate-tab-content"
import { cloneParts, partsEqual } from "@/lib/work-orders/parts-snapshot"
import { cloneTasks, tasksEqual, type TaskDraft } from "@/lib/work-orders/tasks-snapshot"
import {
  WorkOrderDetailExperience,
  buildWorkOrderActivityItems,
} from "@/components/work-orders/work-order-detail-experience"
import { useToast } from "@/hooks/use-toast"
import type { Part, RepairLog, WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { Pencil, X, Check, AlertOctagon, ExternalLink, FileDown, PenLine, Receipt } from "lucide-react"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"

let toastCounter = 0

// ─── Status / priority maps ───────────────────────────────────────────────────

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":   "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Completed Pending Signature":
    "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30",
  "Invoiced":    "bg-muted text-muted-foreground border-border",
}

const PRIORITY_COLOR: Record<WorkOrderPriority, string> = {
  Low:      "text-muted-foreground",
  Normal:   "text-foreground",
  High:     "text-[color:var(--status-warning)]",
  Critical: "text-destructive font-semibold",
}

const ALL_STATUSES: WorkOrderStatus[] = [
  "Open",
  "Scheduled",
  "In Progress",
  "Completed",
  "Completed Pending Signature",
  "Invoiced",
]
const ALL_PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]
const ALL_TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

function uiStatusToDb(s: WorkOrderStatus): string {
  const m: Record<WorkOrderStatus, string> = {
    Open: "open",
    Scheduled: "scheduled",
    "In Progress": "in_progress",
    Completed: "completed",
    "Completed Pending Signature": "completed_pending_signature",
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
      className="w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card"
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
      className="w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer dark:bg-card"
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
      className="w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none dark:bg-card"
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
  /** Opens this tab when the drawer loads (e.g. `certificate` from invoice deep link). */
  initialTab?: string
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

export function WorkOrderDrawer({ workOrderId, onClose, onUpdated, initialTab }: WorkOrderDrawerProps) {
  const { toast: pushToast } = useToast()
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [dbNotes, setDbNotes] = useState("")
  const [photoGallery, setPhotoGallery] = useState<WorkOrderPhotoGalleryItem[]>([])
  const [documentAttachments, setDocumentAttachments] = useState<WorkOrderDocumentItem[]>([])
  const [usesPartsLineItems, setUsesPartsLineItems] = useState(false)
  const [usesTasksTable, setUsesTasksTable] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<number | null>(null)
  const [attachmentUploadLabel, setAttachmentUploadLabel] = useState("")
  const [tabParts, setTabParts] = useState<Part[]>([])
  const [savedParts, setSavedParts] = useState<Part[]>([])
  const [tabTasks, setTabTasks] = useState<TaskDraft[]>([])
  const [savedTasks, setSavedTasks] = useState<TaskDraft[]>([])
  const [drawerTab, setDrawerTab] = useState("overview")
  const [partsSaving, setPartsSaving] = useState(false)
  const [tasksSaving, setTasksSaving] = useState(false)
  const [tabLaborHours, setTabLaborHours] = useState(0)
  const [savedLaborHours, setSavedLaborHours] = useState(0)
  const [laborSaving, setLaborSaving] = useState(false)
  const [planServices, setPlanServices] = useState<unknown[] | null>(null)
  const [technicianAssignOptions, setTechnicianAssignOptions] = useState<
    Awaited<ReturnType<typeof loadTechnicianAssignOptions>>
  >([])
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignSavingKey, setAssignSavingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [billingDecisionOpen, setBillingDecisionOpen] = useState(false)
  const [billingSaving, setBillingSaving] = useState(false)
  const [warrantyVendorOptions, setWarrantyVendorOptions] = useState<Array<{ id: string; name: string }>>([])
  const [billingVendorId, setBillingVendorId] = useState<string>("")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<WorkOrder>>({})
  /** Notes tab + global save: diagnosis & technician in repair_log; internal = work_orders.notes */
  const [notesDiagnosis, setNotesDiagnosis] = useState("")
  const [notesTechnician, setNotesTechnician] = useState("")
  const [notesInternal, setNotesInternal] = useState("")
  const [notesSaving, setNotesSaving] = useState(false)
  const [problemReportedDraft, setProblemReportedDraft] = useState("")
  const [problemSaving, setProblemSaving] = useState(false)
  const [draftLaborDollars, setDraftLaborDollars] = useState("")
  const [draftPartsDollars, setDraftPartsDollars] = useState("")
  const [certificateTemplates, setCertificateTemplates] = useState<CalibrationTemplate[]>([])
  const [certificateTemplateId, setCertificateTemplateId] = useState("")
  const [certificateValues, setCertificateValues] = useState<Record<string, unknown>>({})
  const [certificateSavedAt, setCertificateSavedAt] = useState<string | null>(null)
  const [certificateSaveBusy, setCertificateSaveBusy] = useState(false)
  const [calibrationRecordId, setCalibrationRecordId] = useState<string | null>(null)
  const [certificateBaseline, setCertificateBaseline] = useState<Record<string, unknown>>({})
  const [certificatePrefillNotice, setCertificatePrefillNotice] = useState(false)
  const certificateTouchedRef = useRef<Set<string>>(new Set())

  const seedCertificateFromWorkOrder = useCallback(
    (
      template: CalibrationTemplate | null,
      existing: Record<string, unknown> | null,
      woForSeed: WorkOrder | null,
      touched?: ReadonlySet<string>,
    ) => {
      if (!woForSeed) return seedCertificateValuesForWorkOrder(template, existing, null, { touchedFieldIds: touched })
      return seedCertificateValuesForWorkOrder(template, existing, buildCertificatePrefillContext(woForSeed), {
        touchedFieldIds: touched,
      })
    },
    [],
  )

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

    const techOpts = await loadTechnicianAssignOptions(supabase, orgId)
    setTechnicianAssignOptions(techOpts)
    const { data: vendorRows } = await supabase
      .from("org_vendors")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("name", { ascending: true })
    setWarrantyVendorOptions(((vendorRows ?? []) as Array<{ id: string; name: string }>).filter((v) => v.name?.trim()))

    const res = await loadWorkOrderDetailForOrg(supabase, orgId, workOrderId)
    if (!res.ok) {
      setWo(null)
      setLoading(false)
      return
    }
    setDbNotes(res.data.notes)
    setPlanServices(res.data.planServices)
    setWo(res.data.workOrder)
    setProblemReportedDraft(res.data.workOrder.repairLog.problemReported ?? "")
    setNotesDiagnosis(res.data.workOrder.repairLog.diagnosis ?? "")
    setNotesTechnician(res.data.workOrder.repairLog.technicianNotes ?? "")
    setNotesInternal(res.data.notes)
    setPhotoGallery(res.data.photoGallery)
    setDocumentAttachments(res.data.documentAttachments)
    setUsesPartsLineItems(res.data.usesPartsLineItems)
    setUsesTasksTable(res.data.usesTasksTable)
    const partsSnap = cloneParts(res.data.workOrder.repairLog.partsUsed)
    setTabParts(partsSnap)
    setSavedParts(partsSnap)
    const tasksSnap = cloneTasks(res.data.workOrder.repairLog.tasks ?? [])
    setTabTasks(tasksSnap)
    setSavedTasks(tasksSnap)
    const lh =
      typeof res.data.workOrder.repairLog.laborHours === "number"
        ? res.data.workOrder.repairLog.laborHours
        : 0
    setTabLaborHours(lh)
    setSavedLaborHours(lh)
    try {
      const [templates, latestRecord] = await Promise.all([
        listCalibrationTemplates(supabase, orgId),
        loadLatestCalibrationRecord(supabase, orgId, res.data.workOrder.id),
      ])
      setCertificateTemplates(templates)
      const category = res.data.workOrder.equipmentCategory ?? null
      const assignedTemplateId = res.data.workOrder.calibrationTemplateId ?? null
      const selectedId =
        latestRecord?.templateId ??
        assignedTemplateId ??
        (category ? templates.find((t) => t.equipmentCategoryId === category)?.id : null) ??
        templates[0]?.id ??
        ""
      setCertificateTemplateId(selectedId)
      const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null
      certificateTouchedRef.current.clear()
      const seeded = seedCertificateFromWorkOrder(
        selectedTemplate,
        latestRecord?.values ?? null,
        res.data.workOrder,
      )
      setCertificateValues(seeded.values)
      setCertificateBaseline(structuredClone(seeded.values))
      setCertificatePrefillNotice(seeded.hadPrefill)
      setCertificateSavedAt(latestRecord?.createdAt ?? null)
      setCalibrationRecordId(latestRecord?.id ?? null)
    } catch {
      setCertificateTemplates([])
      setCertificateTemplateId("")
      setCertificateValues({})
      setCertificateSavedAt(null)
      setCalibrationRecordId(null)
    }
    setLoading(false)
  }, [workOrderId, activeOrgId, orgStatus, seedCertificateFromWorkOrder])

  const partsDirty = useMemo(() => !partsEqual(tabParts, savedParts), [tabParts, savedParts])

  const tasksDirty = useMemo(() => !tasksEqual(tabTasks, savedTasks), [tabTasks, savedTasks])

  const laborDirty = useMemo(
    () => Math.abs(tabLaborHours - savedLaborHours) > 1e-9,
    [tabLaborHours, savedLaborHours],
  )

  const notesDirty = useMemo(() => {
    if (!wo) return false
    return (
      notesDiagnosis !== (wo.repairLog.diagnosis ?? "") ||
      notesTechnician !== (wo.repairLog.technicianNotes ?? "") ||
      notesInternal !== dbNotes
    )
  }, [wo, notesDiagnosis, notesTechnician, notesInternal, dbNotes])

  const problemDirty = useMemo(() => {
    if (!wo) return false
    return problemReportedDraft !== (wo.repairLog.problemReported ?? "")
  }, [wo, problemReportedDraft])

  useEffect(() => {
    if (!partsDirty && !tasksDirty && !laborDirty && !notesDirty && !problemDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [partsDirty, tasksDirty, laborDirty, notesDirty, problemDirty])

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setDraftLaborDollars("")
    setDraftPartsDollars("")
    setDrawerTab(initialTab ?? "overview")
    void loadWorkOrder()
  }, [workOrderId, loadWorkOrder, initialTab])

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

  const technicianOptions: TechnicianOption[] = useMemo(
    () =>
      technicianAssignOptions.map((o) => ({
        id: o.id,
        label: o.label,
        avatarUrl: o.avatarUrl,
      })),
    [technicianAssignOptions],
  )

  async function persistTechnicianAssignment(userId: string | null) {
    if (!wo || !activeOrgId) return
    if (userId && userId === wo.technicianId) {
      setAssignDialogOpen(false)
      return
    }
    if (!userId && wo.technicianId === "unassigned") {
      setAssignDialogOpen(false)
      return
    }

    const key = userId ?? "unassigned"
    setAssignSavingKey(key)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase
        .from("work_orders")
        .update({
          assigned_user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)

      if (error) {
        pushToast({
          variant: "destructive",
          title: "Could not update assignment",
          description: error.message,
        })
        return
      }

      pushToast({
        title: userId ? "Technician assigned" : "Technician unassigned",
        description: getWorkOrderDisplay(wo),
      })
      setAssignDialogOpen(false)
      await loadWorkOrder()
      onUpdated?.()
    } finally {
      setAssignSavingKey(null)
    }
  }

  function confirmDiscardUnsavedIfNeeded(): boolean {
    if (!partsDirty && !tasksDirty && !laborDirty && !notesDirty && !problemDirty) return true
    return window.confirm(
      "You have unsaved changes (parts, tasks, labor, notes, and/or problem description). Discard them and continue?",
    )
  }

  const requestClose = useCallback(() => {
    if (!confirmDiscardUnsavedIfNeeded()) return
    onClose()
  }, [partsDirty, tasksDirty, laborDirty, notesDirty, problemDirty, onClose])

  const handleDrawerTabChange = useCallback(
    (next: string) => {
      if (next === drawerTab) return
      if (drawerTab === "parts" && partsDirty) {
        if (
          !window.confirm(
            "You have unsaved changes to parts and materials. Leave this tab without saving?",
          )
        ) {
          return
        }
      }
      if (drawerTab === "tasks" && tasksDirty) {
        if (
          !window.confirm(
            "You have unsaved changes to tasks. Leave this tab without saving?",
          )
        ) {
          return
        }
      }
      if (drawerTab === "labor" && laborDirty) {
        if (
          !window.confirm(
            "You have unsaved changes to labor hours. Leave this tab without saving?",
          )
        ) {
          return
        }
      }
      if (drawerTab === "notes" && notesDirty) {
        if (
          !window.confirm(
            "You have unsaved changes to notes. Leave this tab without saving?",
          )
        ) {
          return
        }
      }
      if (drawerTab === "overview" && problemDirty) {
        if (
          !window.confirm(
            "You have unsaved changes to the problem description. Leave this tab without saving?",
          )
        ) {
          return
        }
      }
      setDrawerTab(next)
    },
    [drawerTab, partsDirty, tasksDirty, laborDirty, notesDirty, problemDirty],
  )

  function revertParts() {
    setTabParts(cloneParts(savedParts))
  }

  async function saveParts() {
    if (!wo || !activeOrgId) return
    setPartsSaving(true)
    try {
      await persistPartsFromTabs(tabParts)
    } finally {
      setPartsSaving(false)
    }
  }

  function revertTasks() {
    setTabTasks(cloneTasks(savedTasks))
  }

  function revertLabor() {
    setTabLaborHours(savedLaborHours)
  }

  function revertNotes() {
    if (!wo) return
    setNotesDiagnosis(wo.repairLog.diagnosis ?? "")
    setNotesTechnician(wo.repairLog.technicianNotes ?? "")
    setNotesInternal(dbNotes)
  }

  function revertProblemReported() {
    if (!wo) return
    setProblemReportedDraft(wo.repairLog.problemReported ?? "")
  }

  async function saveProblemReported() {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    setProblemSaving(true)
    try {
      const repairPayload: RepairLog = { ...wo.repairLog, problemReported: problemReportedDraft }
      const { error } = await supabase
        .from("work_orders")
        .update({
          problem_reported: problemReportedDraft.trim() || null,
          repair_log: repairLogJsonForPersist(repairPayload, {
            stripTasks: usesTasksTable,
            stripParts: usesPartsLineItems,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
      if (error) throw new Error(error.message)
      pushToast({ title: "Problem description saved" })
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setProblemSaving(false)
    }
  }

  async function saveNotes() {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    setNotesSaving(true)
    try {
      const repairPayload: RepairLog = {
        ...wo.repairLog,
        diagnosis: notesDiagnosis,
        technicianNotes: notesTechnician,
      }
      const { error } = await supabase
        .from("work_orders")
        .update({
          notes: notesInternal.trim() || null,
          repair_log: repairLogJsonForPersist(repairPayload, {
            stripTasks: usesTasksTable,
            stripParts: usesPartsLineItems,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
      if (error) throw new Error(error.message)
      pushToast({ title: "Notes saved", description: "Diagnosis, technician notes, and internal notes were updated." })
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save notes",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setNotesSaving(false)
    }
  }

  async function saveLabor() {
    if (!wo || !activeOrgId) return
    const hours = Math.max(0, tabLaborHours)
    const laborCents = Math.max(0, Math.round(hours * DRAWER_LABOR_RATE * 100))
    const supabase = createBrowserSupabaseClient()
    setLaborSaving(true)
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist(
            {
              ...wo.repairLog,
              laborHours: hours,
            },
            { stripTasks: usesTasksTable, stripParts: usesPartsLineItems },
          ),
          total_labor_cents: laborCents,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)

      if (error) throw new Error(error.message)
      pushToast({ title: "Labor saved", description: `${hours} hrs @ $${DRAWER_LABOR_RATE}/hr` })
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save labor",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLaborSaving(false)
    }
  }

  async function saveTasks() {
    if (!wo || !activeOrgId) return
    const normalized = tabTasks
      .filter((t) => t.label.trim())
      .map((t) => ({
        ...t,
        label: t.label.trim(),
        description: t.description?.trim() || undefined,
      }))
    setTasksSaving(true)
    try {
      await persistTasksFromTabs(normalized)
    } finally {
      setTasksSaving(false)
    }
  }

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
    setDraftLaborDollars(String(wo.totalLaborCost ?? 0))
    setDraftPartsDollars(String(wo.totalPartsCost ?? 0))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    if (wo) {
      setProblemReportedDraft(wo.repairLog.problemReported ?? "")
      setNotesDiagnosis(wo.repairLog.diagnosis ?? "")
      setNotesTechnician(wo.repairLog.technicianNotes ?? "")
      setNotesInternal(dbNotes)
    }
  }

  async function saveEdit() {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()

    const laborCents = Math.max(0, Math.round(parseFloat(draftLaborDollars || "0") * 100))
    const partsCents = Math.max(0, Math.round(parseFloat(draftPartsDollars || "0") * 100))

    const tid = (draft.technicianId ?? wo.technicianId) === "unassigned" ? null : (draft.technicianId ?? wo.technicianId)

    const repairPayload: RepairLog = {
      ...wo.repairLog,
      problemReported: problemReportedDraft,
      diagnosis: notesDiagnosis,
      technicianNotes: notesTechnician,
    }

    const updatePayload: Record<string, unknown> = {
      title: (draft.description ?? wo.description).trim(),
      problem_reported: problemReportedDraft.trim() || null,
      status: uiStatusToDb((draft.status ?? wo.status) as WorkOrderStatus),
      priority: uiPriorityToDb((draft.priority ?? wo.priority) as WorkOrderPriority),
      type: uiTypeToDb((draft.type ?? wo.type) as WorkOrderType),
      scheduled_on: (draft.scheduledDate ?? wo.scheduledDate) || null,
      scheduled_time: normalizeTimeForDb(draft.scheduledTime ?? wo.scheduledTime ?? ""),
      assigned_user_id: tid,
      notes: notesInternal.trim() || null,
      total_labor_cents: laborCents,
      repair_log: repairLogJsonForPersist(repairPayload, {
        stripTasks: usesTasksTable,
        stripParts: usesPartsLineItems,
      }),
    }
    if (!usesPartsLineItems) {
      updatePayload.total_parts_cents = partsCents
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

  async function handleCustomerSignatureSave(blob: Blob, name: string) {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    try {
      await persistWorkOrderCustomerSignature(
        supabase,
        activeOrgId,
        wo.id,
        blob,
        name,
        wo.repairLog,
        { stripTasks: usesTasksTable, stripParts: usesPartsLineItems },
      )
      pushToast({ title: "Signature saved", description: "Customer signature was uploaded." })
      const { data: stRow } = await supabase
        .from("work_orders")
        .select("status")
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
        .maybeSingle()
      if ((stRow as { status?: string } | null)?.status === "completed_pending_signature") {
        await supabase
          .from("work_orders")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", wo.id)
          .eq("organization_id", activeOrgId)
      }
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save signature",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function applyInvoiceBillingChoice(choice: "customer" | "vendor" | "hold") {
    if (!wo || !activeOrgId) return
    if (choice === "hold") {
      pushToast({
        title: "Invoice on hold",
        description: "Resolve warranty billing before creating an invoice.",
      })
      setBillingDecisionOpen(false)
      return
    }

    const supabase = createBrowserSupabaseClient()
    setBillingSaving(true)
    const patch: Record<string, unknown> =
      choice === "customer"
        ? {
            billable_to_customer: true,
            warranty_review_required: false,
            warranty_vendor_id: null,
          }
        : {
            billable_to_customer: false,
            warranty_review_required: false,
            warranty_vendor_id: billingVendorId || null,
          }
    const { error } = await supabase
      .from("work_orders")
      .update(patch)
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)
    setBillingSaving(false)
    if (error) {
      pushToast({
        variant: "destructive",
        title: "Could not update billing choice",
        description: error.message,
      })
      return
    }
    setBillingDecisionOpen(false)
    await loadWorkOrder()
    onUpdated?.()
    window.location.href = buildNewInvoiceHref()
  }

  function buildNewInvoiceHref() {
    if (!wo) return "/invoices?action=new-invoice"
    const params = new URLSearchParams()
    params.set("action", "new-invoice")
    params.set("workOrderId", wo.id)
    if (calibrationRecordId) params.set("calibrationRecordId", calibrationRecordId)
    return `/invoices?${params.toString()}`
  }

  function handleCreateInvoiceAction() {
    if (!wo) return
    if (wo.warrantyReviewRequired) {
      setBillingVendorId(wo.warrantyVendorId ?? "")
      setBillingDecisionOpen(true)
      return
    }
    window.location.href = buildNewInvoiceHref()
  }

  async function completeWorkOrder() {
    if (!wo || !activeOrgId) return
    const assignedTemplate = wo.calibrationTemplateId
      ? certificateTemplates.find((t) => t.id === wo.calibrationTemplateId) ?? null
      : null
    const gate = certificateGateForCompletion({
      calibrationTemplateId: wo.calibrationTemplateId,
      assignedTemplate,
      certificateSavedAt,
      certificateValues,
    })
    if (!gate.ok) {
      pushToast({
        variant: "destructive",
        title: "Certificate required",
        description: gate.message ?? "Complete the certificate before finishing this work order.",
      })
      return
    }

    const supabase = createBrowserSupabaseClient()
    const hasSig = customerSignatureCaptured(wo)
    const dbStatus = hasSig ? "completed" : "completed_pending_signature"
    const { error } = await supabase
      .from("work_orders")
      .update({
        status: dbStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }
    toast(hasSig ? "Work order completed" : "Work order completed — capture customer signature when ready.")
    await loadWorkOrder()
    onUpdated?.()
  }

  async function handleGenerateCertificatePdf() {
    if (!wo) return
    const tmpl = certificateTemplates.find((t) => t.id === certificateTemplateId) ?? null
    if (!tmpl) {
      pushToast({ variant: "destructive", title: "No template", description: "Select a certificate template first." })
      return
    }
    try {
      const sig = wo.repairLog.signatureDataUrl
      const techSig =
        sig && (sig.startsWith("data:") || sig.startsWith("http")) ? sig : null
      const html = buildCertificatePdfHtml({
        companyName: "Equipify Service Co.",
        templateName: tmpl.name,
        template: tmpl,
        values: certificateValues,
        workOrderLabel: getWorkOrderDisplay(wo),
        customerName: wo.customerName,
        serviceLocation: wo.location || undefined,
        equipmentName: wo.equipmentName,
        equipmentCode: wo.equipmentCode ?? null,
        equipmentSerialNumber: wo.equipmentSerialNumber ?? null,
        calibrationRecordId: calibrationRecordId,
        completedAtLabel: wo.completedDate ? fmtDate(wo.completedDate) : undefined,
        serviceDateLabel: wo.completedDate
          ? fmtDate(wo.completedDate)
          : wo.scheduledDate
            ? fmtDate(wo.scheduledDate)
            : undefined,
        technicianName: wo.technicianName,
        technicianSignatureDataUrl: techSig,
        customerSignatureUrl: wo.customerSignaturePreviewUrl ?? null,
        customerSignedBy: wo.repairLog.signedBy?.trim() || null,
        technicianSignedDateLabel: wo.repairLog.signedAt?.trim()
          ? fmtDate(wo.repairLog.signedAt.slice(0, 10))
          : wo.completedDate
            ? fmtDate(wo.completedDate)
            : undefined,
        customerSignedDateLabel: wo.customerSignatureCapturedAt
          ? fmtDate(wo.customerSignatureCapturedAt.slice(0, 10))
          : undefined,
        technicianNotes: wo.repairLog.technicianNotes?.trim() || undefined,
      })
      const result = await printCertificatePdfHtml(html)
      if (!result.success && result.message) {
        pushToast({
          variant: "destructive",
          title: "Print preview unavailable",
          description: result.message,
        })
      }
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not generate certificate",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  function handleDownloadCertificateHtml() {
    if (!wo) return
    const tmpl = certificateTemplates.find((t) => t.id === certificateTemplateId) ?? null
    if (!tmpl) {
      pushToast({ variant: "destructive", title: "No template", description: "Select a certificate template first." })
      return
    }
    const sig = wo.repairLog.signatureDataUrl
    const techSig =
      sig && (sig.startsWith("data:") || sig.startsWith("http")) ? sig : null
    const html = buildCertificatePdfHtml({
      companyName: "Equipify Service Co.",
      templateName: tmpl.name,
      template: tmpl,
      values: certificateValues,
      workOrderLabel: getWorkOrderDisplay(wo),
      customerName: wo.customerName,
      serviceLocation: wo.location || undefined,
      equipmentName: wo.equipmentName,
      equipmentCode: wo.equipmentCode ?? null,
      equipmentSerialNumber: wo.equipmentSerialNumber ?? null,
      calibrationRecordId: calibrationRecordId,
      completedAtLabel: wo.completedDate ? fmtDate(wo.completedDate) : undefined,
      serviceDateLabel: wo.completedDate
        ? fmtDate(wo.completedDate)
        : wo.scheduledDate
          ? fmtDate(wo.scheduledDate)
          : undefined,
      technicianName: wo.technicianName,
      technicianSignatureDataUrl: techSig,
      customerSignatureUrl: wo.customerSignaturePreviewUrl ?? null,
      customerSignedBy: wo.repairLog.signedBy?.trim() || null,
      technicianSignedDateLabel: wo.repairLog.signedAt?.trim()
        ? fmtDate(wo.repairLog.signedAt.slice(0, 10))
        : wo.completedDate
          ? fmtDate(wo.completedDate)
          : undefined,
      customerSignedDateLabel: wo.customerSignatureCapturedAt
        ? fmtDate(wo.customerSignatureCapturedAt.slice(0, 10))
        : undefined,
      technicianNotes: wo.repairLog.technicianNotes?.trim() || undefined,
    })
    downloadCertificateHtmlFile(html, `Calibration-${getWorkOrderDisplay(wo)}`)
    pushToast({ title: "Download started", description: "Open the HTML file and use Print → Save as PDF." })
  }

  function legacyRepairPhotoIndex(gallery: WorkOrderPhotoGalleryItem[], fullIndex: number): number | null {
    if (gallery[fullIndex]?.attachmentId) return null
    let li = 0
    for (let j = 0; j < fullIndex; j++) {
      if (!gallery[j]?.attachmentId) li++
    }
    return li
  }

  async function persistTasksFromTabs(
    next: { id: string; label: string; done: boolean; description?: string }[],
  ) {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    try {
      await replaceWorkOrderTasks(
        supabase,
        activeOrgId,
        wo.id,
        next.map(({ label, done, description }) => ({ label, done, description })),
      )
      const { error: rlErr } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist(wo.repairLog, { stripTasks: true }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
      if (rlErr) throw new Error(rlErr.message)
      pushToast({ title: "Tasks saved", description: getWorkOrderDisplay(wo) })
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save tasks",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function persistPartsFromTabs(next: Part[]) {
    if (!wo || !activeOrgId) return
    const supabase = createBrowserSupabaseClient()
    try {
      await replaceWorkOrderLineItems(supabase, activeOrgId, wo.id, next)
      const { error: rlErr } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist(wo.repairLog, { stripParts: true }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
      if (rlErr) throw new Error(rlErr.message)
      toast("Parts saved")
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      toast(`Parts: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleAttachmentUpload(files: FileList) {
    if (!wo || !activeOrgId) return
    const list = Array.from(files)
    if (list.length === 0) return
    const supabase = createBrowserSupabaseClient()
    setAttachmentUploading(true)
    setAttachmentUploadProgress(0)
    setAttachmentUploadLabel(
      list.length === 1 ? `Uploading ${list[0].name}…` : `Starting upload (1 of ${list.length})…`,
    )
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        setAttachmentUploadLabel(`Uploading ${file.name} (${i + 1} of ${list.length})`)
        setAttachmentUploadProgress(Math.round((i / list.length) * 100))
        await uploadWorkOrderAttachment(supabase, activeOrgId, wo.id, file)
        setAttachmentUploadProgress(Math.round(((i + 1) / list.length) * 100))
      }
      pushToast({
        title: "Upload complete",
        description: list.length === 1 ? list[0].name : `${list.length} files uploaded`,
      })
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Upload failed",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setAttachmentUploading(false)
      setAttachmentUploadProgress(null)
      setAttachmentUploadLabel("")
    }
  }

  async function handleRemoveAttachmentPhoto(attachmentId: string) {
    if (!wo || !activeOrgId) return
    if (
      !window.confirm(
        "Delete this attachment? It will be removed from storage. This cannot be undone.",
      )
    ) {
      return
    }
    const supabase = createBrowserSupabaseClient()
    try {
      await deleteWorkOrderAttachment(supabase, activeOrgId, attachmentId)
      pushToast({ title: "Attachment removed" })
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Remove failed",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleRemoveLegacyPhoto(fullIndex: number) {
    if (!wo || !activeOrgId) return
    if (!window.confirm("Remove this photo from the work order?")) return
    const at = legacyRepairPhotoIndex(photoGallery, fullIndex)
    if (at === null) return
    const nextLegacy = wo.repairLog.photos.filter((_, k) => k !== at)
    const supabase = createBrowserSupabaseClient()
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist({ ...wo.repairLog, photos: nextLegacy }, {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
      if (error) throw new Error(error.message)
      toast("Photo removed")
      await loadWorkOrder()
      onUpdated?.()
    } catch (e) {
      toast(`Remove failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleRemoveDocument(attachmentId: string) {
    await handleRemoveAttachmentPhoto(attachmentId)
  }

  async function archiveWorkOrder() {
    if (!wo || !activeOrgId) return
    if (!confirmDiscardUnsavedIfNeeded()) return
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

  async function handleCertificateTemplateChange(templateId: string) {
    if (!wo || !activeOrgId) return
    if (!certificateFieldMapsEqual(certificateValues, certificateBaseline)) {
      if (
        !window.confirm(
          "You have unsaved changes to certificate fields. Switch template and discard them?",
        )
      ) {
        return
      }
    }
    const supabase = createBrowserSupabaseClient()
    try {
      await assignTemplateToWorkOrder(supabase, activeOrgId, wo.id, templateId || null)
      setCertificateTemplateId(templateId)
      const selected = certificateTemplates.find((t) => t.id === templateId) ?? null
      certificateTouchedRef.current.clear()
      const seeded = seedCertificateFromWorkOrder(selected, null, wo)
      setCertificateValues(seeded.values)
      setCertificateBaseline(structuredClone(seeded.values))
      setCertificatePrefillNotice(seeded.hadPrefill)
      setCertificateSavedAt(null)
      if (templateId) toast("Certificate template assigned")
    } catch (e) {
      toast(`Template update failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleSaveCertificateRecord() {
    if (!wo || !activeOrgId || !certificateTemplateId) return
    const supabase = createBrowserSupabaseClient()
    setCertificateSaveBusy(true)
    try {
      const snapshot = structuredClone(certificateValues)
      const record = await createCalibrationRecord(
        supabase,
        activeOrgId,
        wo.id,
        certificateTemplateId,
        snapshot,
      )
      setCertificateSavedAt(record.createdAt)
      setCalibrationRecordId(record.id)
      setCertificateBaseline(snapshot)
      toast("Certificate record saved")
    } catch (e) {
      toast(`Certificate save failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCertificateSaveBusy(false)
    }
  }

  if (!workOrderId) return null

  if (!wo) {
    return (
      <DetailDrawer
        open={!!workOrderId}
        onClose={requestClose}
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

  const assignedForWorkflow = wo.calibrationTemplateId
    ? certificateTemplates.find((t) => t.id === wo.calibrationTemplateId) ?? null
    : null

  const certComplete =
    !wo.calibrationTemplateId ||
    (Boolean(certificateSavedAt) &&
      assignedForWorkflow != null &&
      isCalibrationRecordComplete(assignedForWorkflow, certificateValues))

  const workflowHints = {
    certificateAssigned: Boolean(wo.calibrationTemplateId),
    certificateComplete: certComplete,
    signatureCaptured: customerSignatureCaptured(wo),
  }

  const showPostComplete =
    wo.status === "Completed" || wo.status === "Completed Pending Signature"

  const postCompletionActions = showPostComplete ? (
    <div className="flex flex-wrap gap-2 items-center">
      {wo.calibrationTemplateId ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            onClick={handleGenerateCertificatePdf}
          >
            <FileDown className="w-3.5 h-3.5" />
            Print / Save as PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={handleDownloadCertificateHtml}
          >
            Download HTML
          </Button>
        </>
      ) : null}
      {!customerSignatureCaptured(wo) ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setDrawerTab("overview")}
        >
          <PenLine className="w-3.5 h-3.5" />
          Collect Customer Signature
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => handleCreateInvoiceAction()}
      >
        <Receipt className="w-3.5 h-3.5" />
        Create Invoice
      </Button>
    </div>
  ) : null

  return (
    <>
      <DetailDrawer
        open={!!workOrderId}
        onClose={requestClose}
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
                    className="w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer dark:bg-card"
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
                      value={notesInternal}
                      onChange={setNotesInternal}
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
            internalNotes={notesInternal}
            internalNotesEditable
            onInternalNotesChange={setNotesInternal}
            planServices={planServices}
            activityItems={buildWorkOrderActivityItems(wo)}
            problemReported={problemReportedDraft}
            onProblemReportedChange={setProblemReportedDraft}
            problemReportedInlineEditable
            problemReportedToolbar={
              problemDirty ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Unsaved changes
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={revertProblemReported}
                      disabled={problemSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void saveProblemReported()}
                      disabled={problemSaving}
                    >
                      {problemSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ) : null
            }
            problemEditable={false}
            diagnosis={notesDiagnosis}
            onDiagnosisChange={setNotesDiagnosis}
            technicianNotes={notesTechnician}
            onTechnicianNotesChange={setNotesTechnician}
            notesFieldsEditable
            parts={tabParts}
            onPartsChange={setTabParts}
            tabsValue={drawerTab}
            onTabsValueChange={handleDrawerTabChange}
            partsTabToolbar={
              partsDirty ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Unsaved changes
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={revertParts}
                      disabled={partsSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void saveParts()}
                      disabled={partsSaving}
                    >
                      {partsSaving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              ) : null
            }
            laborHours={tabLaborHours}
            onLaborHoursChange={setTabLaborHours}
            laborRatePerHour={DRAWER_LABOR_RATE}
            laborTabToolbar={
              laborDirty ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Unsaved changes
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={revertLabor}
                      disabled={laborSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void saveLabor()}
                      disabled={laborSaving}
                    >
                      {laborSaving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              ) : null
            }
            photos={photoGallery.map((g) => g.url)}
            onPhotosChange={() => {}}
            photoAttachmentIds={photoGallery.map((g) => g.attachmentId)}
            documentAttachments={documentAttachments}
            onAttachmentUpload={(files) => void handleAttachmentUpload(files)}
            onRemoveAttachmentPhoto={(id) => void handleRemoveAttachmentPhoto(id)}
            onRemoveLegacyPhoto={(i) => void handleRemoveLegacyPhoto(i)}
            onRemoveDocument={(id) => void handleRemoveDocument(id)}
            attachmentUploading={attachmentUploading}
            attachmentUploadProgress={attachmentUploadProgress}
            attachmentUploadStatusLabel={attachmentUploadLabel}
            tasks={tabTasks}
            onTasksChange={setTabTasks}
            tasksTabToolbar={
              tasksDirty ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Unsaved changes
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={revertTasks}
                      disabled={tasksSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void saveTasks()}
                      disabled={tasksSaving}
                    >
                      {tasksSaving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              ) : null
            }
            notesTabToolbar={
              notesDirty ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Unsaved changes
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={revertNotes}
                      disabled={notesSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void saveNotes()}
                      disabled={notesSaving}
                    >
                      {notesSaving ? "Saving…" : "Save notes"}
                    </Button>
                  </div>
                </div>
              ) : null
            }
            certificateTabContent={
              <CertificateTabContent
                templates={certificateTemplates}
                selectedTemplateId={certificateTemplateId}
                onTemplateChange={(templateId) => void handleCertificateTemplateChange(templateId)}
                values={certificateValues}
                onValueChange={(fieldId, value) => {
                  certificateTouchedRef.current.add(fieldId)
                  setCertificateValues((prev) => ({ ...prev, [fieldId]: value }))
                }}
                onSave={() => void handleSaveCertificateRecord()}
                saveBusy={certificateSaveBusy}
                lastSavedAt={certificateSavedAt}
                companyName="Equipify Service Co."
                workOrderLabel={getWorkOrderDisplay(wo)}
                customerName={wo.customerName}
                equipmentName={wo.equipmentName}
                workOrderDescription={wo.description}
                equipmentDetails={wo.location ? `Location: ${wo.location}` : undefined}
                serviceLocation={wo.location || undefined}
                equipmentCode={wo.equipmentCode ?? null}
                equipmentSerialNumber={wo.equipmentSerialNumber ?? null}
                calibrationRecordId={calibrationRecordId}
                serviceDateLabel={
                  wo.completedDate
                    ? fmtDate(wo.completedDate)
                    : wo.scheduledDate
                      ? fmtDate(wo.scheduledDate)
                      : null
                }
                technicianNotes={wo.repairLog.technicianNotes}
                technicianSignedDateLabel={
                  wo.repairLog.signedAt?.trim()
                    ? fmtDate(wo.repairLog.signedAt.slice(0, 10))
                    : wo.completedDate
                      ? fmtDate(wo.completedDate)
                      : null
                }
                customerSignedDateLabel={
                  wo.customerSignatureCapturedAt
                    ? fmtDate(wo.customerSignatureCapturedAt.slice(0, 10))
                    : null
                }
                technicianName={wo.technicianName}
                customerSignatureUrl={wo.customerSignaturePreviewUrl}
                customerSignedBy={wo.repairLog.signedBy || null}
                technicianSignatureDataUrl={
                  wo.repairLog.signatureDataUrl?.startsWith("data") ||
                  wo.repairLog.signatureDataUrl?.startsWith("http")
                    ? wo.repairLog.signatureDataUrl
                    : null
                }
                completedAtLabel={wo.completedDate ? fmtDate(wo.completedDate) : null}
                manageTemplatesHref="/calibration-templates"
                showPrefillHelper={certificatePrefillNotice}
              />
            }
            sigData={wo.repairLog.signatureDataUrl}
            signedBy={wo.repairLog.signedBy}
            signedAt={wo.repairLog.signedAt}
            customerSignaturePreviewUrl={wo.customerSignaturePreviewUrl}
            customerSignatureCapturedAt={wo.customerSignatureCapturedAt}
            onCustomerSignatureSave={(blob, name) => handleCustomerSignatureSave(blob, name)}
            signatureCaptureEnabled
            fieldsEditable={editing}
            partsPhotosEditable={true}
            tasksEditable
            onEditWorkOrder={startEdit}
            onAssignTechnician={() => setAssignDialogOpen(true)}
            onMarkComplete={() => void completeWorkOrder()}
            workflowHints={workflowHints}
            postCompletionActions={postCompletionActions}
            quoteHref={quoteHref}
            onInvoicePlaceholder={() => handleCreateInvoiceAction()}
            onPrint={() =>
              toast("Print preview is not available yet — coming in a future release.")
            }
            onArchive={() => void archiveWorkOrder()}
          />
          </div>
        </div>
      </DetailDrawer>

      <Dialog open={billingDecisionOpen} onOpenChange={setBillingDecisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Warranty billing review</DialogTitle>
            <DialogDescription>
              This work order requires warranty billing review before invoice creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Choose billing route</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={billingSaving} onClick={() => void applyInvoiceBillingChoice("customer")}>
                Bill customer
              </Button>
              <Button size="sm" variant="outline" disabled={billingSaving} onClick={() => void applyInvoiceBillingChoice("vendor")}>
                Bill vendor / warranty
              </Button>
              <Button size="sm" variant="ghost" disabled={billingSaving} onClick={() => void applyInvoiceBillingChoice("hold")}>
                Hold invoice
              </Button>
            </div>
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-medium text-muted-foreground">Warranty vendor (optional)</label>
              <select
                value={billingVendorId}
                onChange={(e) => setBillingVendorId(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                disabled={billingSaving}
              >
                <option value="">No vendor selected</option>
                {warrantyVendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingDecisionOpen(false)} disabled={billingSaving}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignTechnicianDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        options={technicianAssignOptions}
        currentTechnicianId={wo.technicianId}
        savingKey={assignSavingKey}
        onSelect={(userId) => void persistTechnicianAssignment(userId)}
      />

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
