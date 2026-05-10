"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import {
  loadWorkOrderDetailForOrg,
  type WorkOrderDocumentItem,
  type WorkOrderEquipmentAsset,
  type WorkOrderPhotoGalleryItem,
} from "@/lib/work-orders/detail-load"
import { loadTechnicianAssignOptions } from "@/lib/work-orders/load-technician-assign-options"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"
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
  certificateGateForCompletionAllAssets,
  customerSignatureCaptured,
  type CompletionCertificateSlot,
} from "@/lib/work-orders/work-order-completion"
import { CertificateMultiTabContent } from "@/components/work-orders/certificate-multi-tab-content"
import { WorkOrderInventoryUsageCard } from "@/components/inventory/work-order-inventory-usage-card"
import { WorkOrderTruckConsumeCard } from "@/components/inventory/work-order-truck-consume-card"
import { WorkOrderAiPartsSuggestionsPanel } from "@/components/work-orders/work-order-ai-parts-suggestions-panel"
import { RecentCommunicationsCard } from "@/components/communications/recent-communications-card"
import {
  WorkOrderCloseOutDialog,
  WorkOrderCustomerEmailDraftDialog,
} from "@/components/work-orders/work-order-close-out-dialog"
import { cloneParts, partsEqual } from "@/lib/work-orders/parts-snapshot"
import { cloneTasks, tasksEqual, type TaskDraft } from "@/lib/work-orders/tasks-snapshot"
import {
  WorkOrderDetailExperience,
  buildWorkOrderActivityItems,
} from "@/components/work-orders/work-order-detail-experience"
import { WorkOrderAiServiceSummaryPanel } from "@/components/work-orders/work-order-ai-service-summary-panel"
import { WorkOrderAiTechnicianAssistPanel } from "@/components/work-orders/work-order-ai-technician-assist-panel"
import { AddWorkOrderEquipmentModal } from "@/components/work-orders/add-work-order-equipment-modal"
import { useToast } from "@/hooks/use-toast"
import { useOrgArchivePermissions } from "@/lib/use-org-archive-permissions"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
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
  DetailDrawer,
  DrawerSection,
  DrawerRow,
  DrawerToastStack,
  DRAWER_FIELD_CLASS,
  DRAWER_STACKED_MODAL,
  NESTED_OVER_DRAWER_Z,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  Pencil,
  X,
  Check,
  AlertOctagon,
  ExternalLink,
  Mail,
  PenLine,
  Receipt,
  Loader2,
  PackageSearch,
  History,
  UserPlus,
  ChevronDown,
} from "lucide-react"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import { useTenant } from "@/lib/tenant-store"
import { documentBrandingFromTenantWorkspace } from "@/lib/organization/document-branding"
import { buildWorkOrderSummaryDocumentHtml } from "@/lib/documents/simple-document-html"
import { printHtmlDocument } from "@/lib/certificates/certificate-pdf-html"
import { buildWorkOrderPartFromCatalog } from "@/lib/catalog/catalog-line-snapshots"
import { AddFromCatalogDialog } from "@/components/catalog/add-from-catalog-dialog"
import { TechnicianMobileQuickBar } from "@/components/technician/technician-mobile-quick-bar"
import { useCustomerPrimaryPhone } from "@/hooks/use-customer-primary-phone"
import { deriveOperationalBadgesForDrawer } from "@/lib/dispatch/operational-badges"
import { deriveDispatchState } from "@/lib/dispatch/dispatch-state"
import {
  collectScheduleWarningsForPeer,
  type ScheduleWarnPeer,
  type ScheduleWarningItem,
} from "@/lib/dispatch/schedule-warnings"
import { OperationalBadgeRow } from "@/components/dispatch/operational-badge-row"
import { buildWorkOrderServiceTimeline } from "@/lib/lifecycle/service-timeline"
import { ServiceLifecycleTimeline } from "@/components/lifecycle/service-lifecycle-timeline"
import { fetchInvoicesForWorkOrder } from "@/lib/org-quotes-invoices/repository"
import type { AdminInvoice } from "@/lib/mock-data"
import { LinkedInvoicesSummary } from "@/components/work-orders/linked-invoices-summary"
import { SchedulingEventsCard } from "@/components/dispatch/scheduling-events-card"
import {
  composeReassignMessage,
  composeRescheduleMessage,
  composeUnassignMessage,
  emitSchedulingEvent,
} from "@/lib/dispatch/scheduling-events-client"
import {
  resolveCustomerBillingProfile,
  type CustomerBillingProfile,
} from "@/lib/customers/billing-profile"
import { SlaCoverageBadge } from "@/components/service-contracts/sla-coverage-badge"
import type { ServiceContractRow } from "@/lib/service-contracts/types"
import { evaluateSlaCoverageLabel, pickBestContract } from "@/lib/service-contracts/coverage"
import type { EquipmentWarrantyRow } from "@/lib/equipment-warranties/types"
import { evaluateWarrantyCoverage } from "@/lib/equipment-warranties/eval"
import { WarrantyCoverageBadge } from "@/components/equipment-warranties/warranty-coverage-badge"
import type { ReplacementReadinessResult } from "@/lib/equipment-replacement/types"
import {
  evaluateReplacementReadiness,
  equipmentStatusDbToUi,
  formatReplacementReadinessLabel,
  REPLACEMENT_DISCLAIMER,
} from "@/lib/equipment-replacement/eval"
import { ReplacementReadinessBadge } from "@/components/equipment-replacement/replacement-readiness-badge"
import type { EquipmentReliabilityResult } from "@/lib/equipment-reliability/types"
import {
  evaluateEquipmentReliability,
  formatEquipmentReliabilityLabel,
  RELIABILITY_DISCLAIMER,
} from "@/lib/equipment-reliability/eval"
import { ReliabilityBadge } from "@/components/equipment-reliability/reliability-badge"

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

function drawerSchedPastDue(wo: WorkOrder): boolean {
  const y = wo.scheduledDate?.trim().slice(0, 10)
  if (!y) return false
  const today = new Date().toISOString().slice(0, 10)
  const db = uiStatusToDb(wo.status)
  return ["open", "scheduled", "in_progress"].includes(db) && y < today
}

function normalizePeerTimeForWarnings(t: string | null | undefined): string | null {
  const s = t?.trim()
  if (!s) return null
  if (s.length === 5 && s.includes(":")) return `${s}:00`
  return s
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
      className={cn(
        DRAWER_FIELD_CLASS,
        "w-full shadow-xs transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
      )}
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
      className={cn(
        DRAWER_FIELD_CLASS,
        "w-full cursor-pointer shadow-xs transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
      )}
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
      className={cn(
        DRAWER_FIELD_CLASS,
        "w-full resize-none shadow-xs transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
      )}
    />
  )
}

function DrawerCompactSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm dark:bg-[#0B111E] dark:border-[#25324C]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">{title}</span>
          {subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span> : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <div className="border-t border-border px-3 py-3 dark:border-[#25324C]">{children}</div> : null}
    </div>
  )
}

function EditRow({ label, view, editing, children }: {
  label: string; view: ReactNode; editing: boolean; children: ReactNode
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
  /** Opens this tab when the drawer loads (e.g. `certificates` or legacy `certificate` from deep link). */
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
  const { canArchiveRestore } = useOrgArchivePermissions()
  // Phase 2 (Permissions): hide work-order mutation buttons for read-only roles.
  const { permissions: woOrgPermissions } = useOrgPermissions()
  const woCanEdit = woOrgPermissions.canEditWorkOrders
  const woCanManageDispatch = woOrgPermissions.canManageDispatch
  const woCanCreateInvoice = woOrgPermissions.canEditInvoices || woOrgPermissions.canApproveInvoices
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
  /** Service lifecycle timeline (WO + linked invoices); collapsed by default so tabs keep vertical space. */
  const [drawerServiceTimelineOpen, setDrawerServiceTimelineOpen] = useState(false)
  const [certificateFocusEquipmentId, setCertificateFocusEquipmentId] = useState<string | null>(null)
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
  const [closeOutOpen, setCloseOutOpen] = useState(false)
  const [postEmailDraftOpen, setPostEmailDraftOpen] = useState(false)
  const [woSummaryEmailOpen, setWoSummaryEmailOpen] = useState(false)
  const [woSummaryEmailTo, setWoSummaryEmailTo] = useState("")
  const [woSummaryEmailNote, setWoSummaryEmailNote] = useState("")
  const [woSummaryEmailBusy, setWoSummaryEmailBusy] = useState(false)
  const [billingDecisionOpen, setBillingDecisionOpen] = useState(false)
  const [billingSaving, setBillingSaving] = useState(false)
  const [warrantyVendorOptions, setWarrantyVendorOptions] = useState<Array<{ id: string; name: string }>>([])
  const [billingVendorId, setBillingVendorId] = useState<string>("")
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
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
  const [equipmentAssets, setEquipmentAssets] = useState<WorkOrderEquipmentAsset[]>([])
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)
  const [completionCertSlots, setCompletionCertSlots] = useState<CompletionCertificateSlot[]>([])
  const [linkedInvoices, setLinkedInvoices] = useState<AdminInvoice[]>([])
  const [billingProfile, setBillingProfile] = useState<CustomerBillingProfile | null>(null)
  /** Phase 4: bumping this triggers the SchedulingEventsCard to re-fetch — used after we emit an event from this drawer. */
  const [schedulingEventsRefresh, setSchedulingEventsRefresh] = useState(0)
  /** Phase 35: same-calendar-day peers for soft scheduling warnings (org + technician scope). */
  const [schedulePeerRows, setSchedulePeerRows] = useState<ScheduleWarnPeer[] | null>(null)
  const [woContractEval, setWoContractEval] = useState<ReturnType<typeof evaluateSlaCoverageLabel> | null>(null)
  const [woWarrantyEval, setWoWarrantyEval] = useState<ReturnType<typeof evaluateWarrantyCoverage> | null>(null)
  const [woReplacementReadiness, setWoReplacementReadiness] = useState<ReplacementReadinessResult | null>(null)
  const [woEquipmentReliability, setWoEquipmentReliability] = useState<EquipmentReliabilityResult | null>(null)

  const loadWorkOrder = useCallback(async () => {
    if (!workOrderId) {
      setWo(null)
      setBillingProfile(null)
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
    if (process.env.NODE_ENV === "development") {
      console.debug("[work-order-drawer] detail load", {
        workOrderId,
        organizationId: orgId,
        orgStatus,
        ok: res.ok,
        ...(res.ok ? {} : { notFound: res.notFound, message: "message" in res ? res.message : undefined }),
      })
    }
    if (!res.ok) {
      setWo(null)
      setBillingProfile(null)
      setLoading(false)
      return
    }
    if (woOrgPermissions.canViewAssignedWorkOrdersOnly && !woOrgPermissions.canViewAllWorkOrders) {
      const assignedScope = await loadAssignedWorkScope(supabase, { organizationId: orgId, userId: user.id })
      if (res.data.workOrder.assignedUserId !== user.id && !assignedScope.workOrderIds.includes(res.data.workOrder.id)) {
        setWo(null)
        setBillingProfile(null)
        setLoading(false)
        return
      }
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
    setEquipmentAssets(res.data.equipmentAssets ?? [])
    if (woOrgPermissions.canViewFinancials || woOrgPermissions.canViewBilling) {
      const profile = await resolveCustomerBillingProfile(supabase, {
        organizationId: orgId,
        customerId: res.data.workOrder.customerId,
      }).catch(() => null)
      setBillingProfile(profile)
    } else {
      setBillingProfile(null)
    }
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
    setLoading(false)
  }, [workOrderId, activeOrgId, orgStatus, woOrgPermissions])

  useEffect(() => {
    if (!workOrderId) setSchedulePeerRows(null)
  }, [workOrderId])

  useEffect(() => {
    if (!wo || !activeOrgId || orgStatus !== "ready") {
      setWoContractEval(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const [{ data: woRow }, { data: contracts }] = await Promise.all([
        supabase
          .from("work_orders")
          .select("customer_location_id, created_at, completed_at, status")
          .eq("organization_id", activeOrgId)
          .eq("id", wo.id)
          .maybeSingle(),
        supabase
          .from("org_service_contracts")
          .select("*")
          .eq("organization_id", activeOrgId)
          .eq("customer_id", wo.customerId),
      ])
      if (cancelled) return
      const r = woRow as {
        customer_location_id: string | null
        created_at: string
        completed_at: string | null
        status: string
      } | null
      if (!r) {
        setWoContractEval(null)
        return
      }
      const best = pickBestContract((contracts ?? []) as ServiceContractRow[], {
        customerId: wo.customerId,
        locationId: r.customer_location_id,
        equipmentId: wo.equipmentId,
        openedAtIso: r.created_at,
        closedAtIso: r.completed_at,
        lifecycleStatus: r.status,
      })
      setWoContractEval(
        evaluateSlaCoverageLabel(best, {
          customerId: wo.customerId,
          locationId: r.customer_location_id,
          equipmentId: wo.equipmentId,
          openedAtIso: r.created_at,
          closedAtIso: r.completed_at,
          lifecycleStatus: r.status,
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [wo?.id, wo?.customerId, wo?.equipmentId, activeOrgId, orgStatus])

  useEffect(() => {
    if (!wo?.equipmentId?.trim() || !activeOrgId || orgStatus !== "ready") {
      setWoWarrantyEval(null)
      setWoReplacementReadiness(null)
      setWoEquipmentReliability(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const eid = wo.equipmentId.trim()
      const [{ data: wRows }, { data: eqRow }, { data: woHist }, { data: planRows }] = await Promise.all([
        supabase
          .from("org_equipment_warranties")
          .select("*")
          .eq("organization_id", activeOrgId)
          .eq("equipment_id", eid),
        supabase
          .from("equipment")
          .select(
            "warranty_start_date, warranty_expiration_date, warranty_expires_at, manufacturer, install_date, next_due_at, status",
          )
          .eq("organization_id", activeOrgId)
          .eq("id", eid)
          .maybeSingle(),
        supabase
          .from("work_orders")
          .select("created_at, completed_at, status, title, type")
          .eq("organization_id", activeOrgId)
          .eq("equipment_id", eid)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("maintenance_plans")
          .select("status, next_due_date")
          .eq("organization_id", activeOrgId)
          .eq("equipment_id", eid)
          .is("archived_at", null),
      ])
      if (cancelled) return
      const row = eqRow as {
        warranty_start_date?: string | null
        warranty_expiration_date?: string | null
        warranty_expires_at?: string | null
        manufacturer?: string | null
        install_date?: string | null
        next_due_at?: string | null
        status?: string | null
      } | null
      const end = row?.warranty_expiration_date?.trim() || row?.warranty_expires_at?.trim() || null
      const start = row?.warranty_start_date?.trim() || null
      const ev = evaluateWarrantyCoverage({
        records: (wRows ?? []) as EquipmentWarrantyRow[],
        equipmentFallback:
          end || start ?
            {
              start: start ? start.slice(0, 10) : null,
              end: end ? end.slice(0, 10) : null,
              manufacturerLabel: row?.manufacturer ?? null,
            }
          : null,
      })
      setWoWarrantyEval(ev)

      const installYmd = row?.install_date?.trim() ? row.install_date.slice(0, 10) : null
      const nextDueYmd = row?.next_due_at?.trim() ? row.next_due_at.slice(0, 10) : null
      const eqStatusUi = equipmentStatusDbToUi(row?.status ?? undefined)
      const woRowsMinimal =
        (woHist ?? []) as Array<{ created_at: string; completed_at: string | null; status: string }>
      const woRowsReliability =
        (woHist ?? []) as Array<{
          created_at: string
          completed_at: string | null
          status: string
          title: string
          type: string
        }>
      const repl = evaluateReplacementReadiness({
        warranty: ev,
        installDateYmd: installYmd,
        equipmentStatus: eqStatusUi,
        workOrders: woRowsMinimal,
        equipmentNextDueYmd: nextDueYmd,
        maintenancePlans:
          (planRows ?? []) as Array<{ status: string; next_due_date: string | null }>,
      })
      setWoReplacementReadiness(repl)
      setWoEquipmentReliability(evaluateEquipmentReliability(woRowsReliability))
    })()
    return () => {
      cancelled = true
    }
  }, [wo?.id, wo?.equipmentId, activeOrgId, orgStatus])

  useEffect(() => {
    if (!wo || !activeOrgId || orgStatus !== "ready") {
      setSchedulePeerRows(null)
      return
    }
    const ymdHead = wo.scheduledDate?.trim().slice(0, 10)
    if (!ymdHead) {
      setSchedulePeerRows(null)
      return
    }

    let cancelled = false

    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      let q = supabase
        .from("work_orders")
        .select("id, status, scheduled_on, scheduled_time, assigned_user_id, customer_id, customer_location_id")
        .eq("organization_id", activeOrgId)
        .is("archived_at", null)
        .eq("scheduled_on", ymdHead)
        .in("status", ["open", "scheduled", "in_progress"])

      if (woOrgPermissions.canViewAssignedWorkOrdersOnly && !woOrgPermissions.canViewAllWorkOrders) {
        const scope = await loadAssignedWorkScope(supabase, { organizationId: activeOrgId, userId: user.id })
        const ids = [...new Set([...scope.workOrderIds, wo.id])]
        if (ids.length === 0) {
          if (!cancelled) setSchedulePeerRows([])
          return
        }
        q = q.in("id", ids)
      }

      const { data, error } = await q
      if (cancelled) return
      if (error || !data) {
        setSchedulePeerRows([])
        return
      }

      const rows: ScheduleWarnPeer[] = (
        data as Array<{
          id: string
          status: string
          scheduled_on: string | null
          scheduled_time: string | null
          assigned_user_id: string | null
          customer_id: string
          customer_location_id: string | null
        }>
      ).map((r) => ({
        id: r.id,
        status: r.status,
        scheduled_on: r.scheduled_on,
        scheduled_time: r.scheduled_time,
        assigned_user_id: r.assigned_user_id,
        customer_id: r.customer_id,
        customerLocationId: r.customer_location_id ?? null,
        opsFlags: undefined,
      }))
      setSchedulePeerRows(rows)
    })()

    return () => {
      cancelled = true
    }
  }, [
    wo,
    activeOrgId,
    orgStatus,
    woOrgPermissions.canViewAssignedWorkOrdersOnly,
    woOrgPermissions.canViewAllWorkOrders,
  ])

  const workOrderScheduleSoftWarnings: ScheduleWarningItem[] = useMemo(() => {
    if (!wo || schedulePeerRows === null) return []
    const self: ScheduleWarnPeer = {
      id: wo.id,
      status: uiStatusToDb(wo.status),
      scheduled_on: wo.scheduledDate?.trim() || null,
      scheduled_time: normalizePeerTimeForWarnings(wo.scheduledTime),
      assigned_user_id: wo.assignedUserId ?? null,
      customer_id: wo.customerId,
      customerLocationId: null,
      opsFlags: { sched_past_due: drawerSchedPastDue(wo) },
    }
    const others = schedulePeerRows.filter((p) => p.id !== wo.id)
    return collectScheduleWarningsForPeer(self, [self, ...others])
  }, [wo, schedulePeerRows])

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
    setDrawerServiceTimelineOpen(false)
    setDrawerTab(initialTab === "certificate" ? "certificates" : (initialTab ?? "overview"))
    void loadWorkOrder()
  }, [workOrderId, loadWorkOrder, initialTab])

  useEffect(() => {
    if (editing) setDrawerServiceTimelineOpen(false)
  }, [editing])

  useEffect(() => {
    if (!workOrderId || orgStatus !== "ready" || !activeOrgId) {
      setLinkedInvoices([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    let cancelled = false
    void (async () => {
      const { invoices } = await fetchInvoicesForWorkOrder(supabase, activeOrgId, workOrderId)
      if (!cancelled) setLinkedInvoices(invoices ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [workOrderId, activeOrgId, orgStatus])

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

  const operationalDrawerBadges = useMemo(() => {
    const w = displayWo ?? wo
    if (!w) return []
    return deriveOperationalBadgesForDrawer(w, equipmentAssets)
  }, [displayWo, wo, equipmentAssets])

  const serviceTimelineEvents = useMemo(() => {
    const w = displayWo ?? wo
    if (!w) return []
    return buildWorkOrderServiceTimeline(w, linkedInvoices)
  }, [displayWo, wo, linkedInvoices])

  const { workspace } = useTenant()
  const documentBranding = useMemo(() => documentBrandingFromTenantWorkspace(workspace), [workspace])

  const primaryPhone = useCustomerPrimaryPhone(
    wo?.customerId,
    orgStatus === "ready" ? activeOrgId : null,
  )
  const navigateQuery = useMemo(() => {
    if (!wo) return ""
    return [wo.customerName, wo.location].filter(Boolean).join(" ").trim()
  }, [wo?.customerName, wo?.location])

  async function handlePrintWorkOrderSummary() {
    const w = displayWo ?? wo
    if (!w) return
    const fmtShort = (d: string) =>
      d ?
        new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null
    const html = buildWorkOrderSummaryDocumentHtml({
      branding: documentBranding,
      workOrderLabel: getWorkOrderDisplay({ id: w.id, workOrderNumber: w.workOrderNumber }),
      title: w.description?.trim() || "Work order",
      status: w.status,
      priority: w.priority,
      type: w.type,
      customerName: w.customerName,
      equipmentSummary: w.equipmentName,
      scheduledOn: fmtShort(w.scheduledDate),
      completedAt: fmtShort(w.completedDate),
      problemReported: w.repairLog?.problemReported,
      diagnosis: w.repairLog?.diagnosis,
      technicianNotes: w.repairLog?.technicianNotes,
    })
    const result = await printHtmlDocument(html)
    if (!result.success && result.message) {
      pushToast({
        variant: "destructive",
        title: "Print preview unavailable",
        description: result.message,
      })
    }
  }

  const equipmentIdsOnWorkOrder = useMemo(
    () => Array.from(new Set(equipmentAssets.map((a) => a.id))),
    [equipmentAssets],
  )

  const handleRemoveEquipmentFromWorkOrder = useCallback(
    async (joinRowId: string) => {
      if (!activeOrgId) return
      if (
        !window.confirm(
          "Remove this equipment from the work order? The equipment record will not be deleted.",
        )
      ) {
        return
      }
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase
        .from("work_order_equipment")
        .delete()
        .eq("id", joinRowId)
        .eq("organization_id", activeOrgId)
      if (error) {
        pushToast({
          variant: "destructive",
          title: "Could not remove equipment",
          description: error.message,
        })
        return
      }
      pushToast({ title: "Equipment removed from work order" })
      await loadWorkOrder()
      onUpdated?.()
    },
    [activeOrgId, loadWorkOrder, onUpdated, pushToast],
  )

  const handleAddEquipmentToWorkOrderSuccess = useCallback(async () => {
    pushToast({ title: "Equipment added to work order" })
    await loadWorkOrder()
    onUpdated?.()
  }, [loadWorkOrder, onUpdated, pushToast])

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
      const assign = await workOrderAssignmentColumns(supabase, activeOrgId, userId)
      const { error } = await supabase
        .from("work_orders")
        .update({
          ...assign,
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

      // Phase 4: non-blocking scheduling event. Failure is intentionally ignored.
      const fromTechLabel = wo.technicianId === "unassigned" ? null : wo.technicianName
      const toTechLabel =
        userId
          ? technicianAssignOptions.find((o) => o.id === userId)?.label ?? null
          : null
      void emitSchedulingEvent({
        organizationId: activeOrgId,
        workOrderId: wo.id,
        eventType: userId ? "reassign" : "unassign",
        severity: "info",
        message: userId
          ? composeReassignMessage({ fromTechLabel, toTechLabel })
          : composeUnassignMessage({ fromTechLabel }),
        metadata: {
          source: "work_order_drawer.assign_dialog",
          previousTechnicianId: wo.technicianId === "unassigned" ? null : wo.technicianId,
          nextTechnicianId: userId ?? null,
        },
      })

      pushToast({
        title: userId ? "Technician assigned" : "Technician unassigned",
        description: getWorkOrderDisplay(wo),
      })
      setAssignDialogOpen(false)
      await loadWorkOrder()
      setSchedulingEventsRefresh((n) => n + 1)
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

  async function saveNotes(): Promise<boolean> {
    if (!wo || !activeOrgId) return false
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
      return true
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save notes",
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      setNotesSaving(false)
    }
  }

  async function persistServiceSummaries(patch: {
    internalServiceSummary?: string
    customerServiceSummary?: string
  }): Promise<boolean> {
    if (!wo || !activeOrgId || wo.isArchived) return false
    const supabase = createBrowserSupabaseClient()
    try {
      const repairPayload: RepairLog = { ...wo.repairLog, ...patch }
      const { error } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist(repairPayload, {
            stripTasks: usesTasksTable,
            stripParts: usesPartsLineItems,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wo.id)
        .eq("organization_id", activeOrgId)
      if (error) throw new Error(error.message)
      await loadWorkOrder()
      onUpdated?.()
      return true
    } catch (e) {
      pushToast({
        variant: "destructive",
        title: "Could not save summary",
        description: e instanceof Error ? e.message : String(e),
      })
      return false
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
    const assign = await workOrderAssignmentColumns(supabase, activeOrgId, tid)

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
      ...assign,
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

    const prevStatusDb = uiStatusToDb(wo.status as WorkOrderStatus)
    const nextStatusDb = updatePayload.status as string

    const { error } = await supabase
      .from("work_orders")
      .update(updatePayload)
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }

    // Phase 4: emit scheduling events when scheduled date/time or technician changed.
    // Non-blocking — fired after the work_orders update succeeded.
    const prevTechnicianId = wo.technicianId === "unassigned" ? null : wo.technicianId
    const nextTechnicianIdRaw =
      (draft.technicianId ?? wo.technicianId) === "unassigned"
        ? null
        : (draft.technicianId ?? wo.technicianId)
    const techChanged = prevTechnicianId !== nextTechnicianIdRaw
    const prevDate = wo.scheduledDate ?? null
    const nextDate = (draft.scheduledDate ?? wo.scheduledDate) || null
    const prevTime = wo.scheduledTime ?? null
    const nextTime = (draft.scheduledTime ?? wo.scheduledTime) || null
    const scheduleChanged = prevDate !== nextDate || prevTime !== nextTime

    if (techChanged) {
      const fromLabel = wo.technicianId === "unassigned" ? null : wo.technicianName
      const toLabel = nextTechnicianIdRaw
        ? draft.technicianName ?? technicianAssignOptions.find((o) => o.id === nextTechnicianIdRaw)?.label ?? null
        : null
      void emitSchedulingEvent({
        organizationId: activeOrgId,
        workOrderId: wo.id,
        eventType: nextTechnicianIdRaw ? "reassign" : "unassign",
        severity: "info",
        message: nextTechnicianIdRaw
          ? composeReassignMessage({ fromTechLabel: fromLabel, toTechLabel: toLabel })
          : composeUnassignMessage({ fromTechLabel: fromLabel }),
        metadata: {
          source: "work_order_drawer.edit_save",
          previousTechnicianId: prevTechnicianId,
          nextTechnicianId: nextTechnicianIdRaw,
        },
      })
    }
    if (scheduleChanged) {
      void emitSchedulingEvent({
        organizationId: activeOrgId,
        workOrderId: wo.id,
        eventType: "reschedule",
        severity: "info",
        message: composeRescheduleMessage({
          scheduledOn: nextDate,
          scheduledTimeHhMm: nextTime,
        }),
        metadata: {
          source: "work_order_drawer.edit_save",
          previousScheduledOn: prevDate,
          previousScheduledTime: prevTime,
          nextScheduledOn: nextDate,
          nextScheduledTime: nextTime,
        },
      })
    }
    if (techChanged || scheduleChanged) {
      setSchedulingEventsRefresh((n) => n + 1)
    }

    if (prevStatusDb !== nextStatusDb) {
      const woCtx = {
        id: wo.id,
        status: nextStatusDb,
        priority: updatePayload.priority,
        customer_id: wo.customerId,
        equipment_id: wo.equipmentId,
        assigned_user_id: assign.assigned_user_id,
        assigned_technician_id: assign.assigned_technician_id,
      }
      void fetch(`/api/organizations/${activeOrgId}/workflows/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: "work_order_status_changed",
          source_type: "work_order",
          source_id: wo.id,
          context: {
            work_order: woCtx,
            previous_work_order: { status: prevStatusDb },
          },
        }),
      }).catch(() => {})
      if (["completed", "invoiced", "completed_pending_signature"].includes(nextStatusDb)) {
        void fetch(`/api/organizations/${activeOrgId}/workflows/emit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger_type: "work_order_completed",
            source_type: "work_order",
            source_id: wo.id,
            context: { work_order: woCtx },
          }),
        }).catch(() => {})
      }
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

  async function completeWorkOrder(): Promise<boolean> {
    if (!wo || !activeOrgId) return false
    const gate = certificateGateForCompletionAllAssets({
      calibrationTemplateId: wo.calibrationTemplateId,
      slots: completionCertSlots,
    })
    if (!gate.ok) {
      pushToast({
        variant: "destructive",
        title: "Certificate required",
        description: gate.message ?? "Complete the certificate before finishing this work order.",
      })
      return false
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
      return false
    }
    toast(hasSig ? "Work order completed" : "Work order completed — capture customer signature when ready.")
    await loadWorkOrder()
    onUpdated?.()
    return true
  }

  async function handleCloseOutFinalize(): Promise<boolean> {
    if (notesDirty) {
      const saved = await saveNotes()
      if (!saved) return false
    }
    return completeWorkOrder()
  }

  function handleCertificatePrintHint() {
    pushToast({
      title: "Certificate tab",
      description: "Expand an equipment row on the Certificate tab, then use Print or Download HTML there.",
    })
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from("work_orders")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user?.id ?? null,
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

  async function restoreWorkOrder() {
    if (!wo || !activeOrgId) return
    if (!confirmDiscardUnsavedIfNeeded()) return
    if (!window.confirm("Restore this work order to active lists?")) return
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      })
      .eq("id", wo.id)
      .eq("organization_id", activeOrgId)

    if (error) {
      toast(`Restore failed: ${error.message}`)
      return
    }
    toast("Work order restored")
    await loadWorkOrder()
    onUpdated?.()
  }

  function setField<K extends keyof WorkOrder>(field: K, value: WorkOrder[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
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

  const closeOutCertGate = certificateGateForCompletionAllAssets({
    calibrationTemplateId: wo.calibrationTemplateId,
    slots: completionCertSlots,
  })

  const certComplete = !wo.calibrationTemplateId || closeOutCertGate.ok

  const workflowHints = {
    certificateAssigned: Boolean(wo.calibrationTemplateId),
    certificateComplete: certComplete,
    signatureCaptured: customerSignatureCaptured(wo),
  }

  const showPostComplete =
    wo.status === "Completed" || wo.status === "Completed Pending Signature"
  const readyToInvoice = showPostComplete && linkedInvoices.filter((i) => !i.isArchived).length === 0
  const dispatchState = deriveDispatchState({
    status: uiStatusToDb(wo.status),
    customerId: wo.customerId,
    scheduledOn: wo.scheduledDate,
    scheduledTime: wo.scheduledTime,
    assignedUserId: wo.technicianId === "unassigned" ? null : wo.technicianId,
    archivedAt: wo.isArchived ? "archived" : null,
  })

  const drawerOverviewLeadSlot = !editing ? (
    <div className="space-y-3">
      {woContractEval ?
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contract / SLA
            </p>
            {woContractEval.contractName ?
              <p className="text-xs text-foreground truncate">{woContractEval.contractName}</p>
            : <p className="text-xs text-muted-foreground">No active matching contract.</p>}
          </div>
          <SlaCoverageBadge label={woContractEval.label} />
        </div>
      : null}
      {woWarrantyEval && wo?.equipmentId?.trim() ?
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Asset warranty
            </p>
            <p className="text-xs text-foreground truncate">
              {woWarrantyEval.provider ?? "Coverage from asset profile"}
              {woWarrantyEval.endDate ? ` · ends ${woWarrantyEval.endDate}` : ""}
            </p>
          </div>
          <WarrantyCoverageBadge label={woWarrantyEval.label} />
        </div>
      : null}
      {woEquipmentReliability && wo?.equipmentId?.trim() && woEquipmentReliability.label !== "stable" ?
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Service reliability
            </p>
            <ReliabilityBadge label={woEquipmentReliability.label} className="normal-case" />
          </div>
          <p className="text-xs font-medium text-foreground">
            {formatEquipmentReliabilityLabel(woEquipmentReliability.label)}
          </p>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
            {woEquipmentReliability.reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground leading-snug">{RELIABILITY_DISCLAIMER}</p>
        </div>
      : null}
      {woReplacementReadiness && wo?.equipmentId?.trim() ?
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Replacement readiness
            </p>
            <ReplacementReadinessBadge label={woReplacementReadiness.label} className="normal-case" />
          </div>
          <p className="text-xs font-medium text-foreground">{formatReplacementReadinessLabel(woReplacementReadiness.label)}</p>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
            {woReplacementReadiness.reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground leading-snug">{REPLACEMENT_DISCLAIMER}</p>
        </div>
      : null}
      {dispatchState.dispatchIncomplete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Still in dispatch queue</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {dispatchState.needsAssignment ? "Needs technician assignment. " : ""}
              {dispatchState.needsScheduling ? "Needs scheduled date/time. " : ""}
              Current state: {dispatchState.label}.
            </p>
          </div>
          {woCanManageDispatch && !wo.isArchived ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setAssignDialogOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign technician
            </Button>
          ) : null}
        </div>
      ) : null}

      {operationalDrawerBadges.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Operational signals
          </p>
          <OperationalBadgeRow badges={operationalDrawerBadges} cap={6} />
        </div>
      ) : null}

      {workOrderScheduleSoftWarnings.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/15 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scheduling checks
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
            {workOrderScheduleSoftWarnings.map((w) => (
              <li key={w.key}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {billingProfile?.poRequiredBeforeService ? (
        <div className="flex items-start gap-2 rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-3 py-2 text-[11px] text-[color:var(--status-warning)]">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">PO required before service</p>
            <p>
              {billingProfile.billingName} requires a PO before work begins.
              {billingProfile.defaultPoNumber ? ` Default PO: ${billingProfile.defaultPoNumber}.` : ""}
            </p>
            {billingProfile.invoiceInstructions ? (
              <p className="mt-1 text-muted-foreground">{billingProfile.invoiceInstructions}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <DrawerCompactSection
        title="Invoicing"
        subtitle={readyToInvoice ? "Ready to invoice" : linkedInvoices.length > 0 ? `${linkedInvoices.length} linked invoice${linkedInvoices.length === 1 ? "" : "s"}` : "No linked invoices yet"}
        defaultOpen={readyToInvoice}
      >
        <LinkedInvoicesSummary
          invoices={linkedInvoices}
          canCreateInvoice={woCanCreateInvoice && !wo.isArchived}
          onCreateInvoice={handleCreateInvoiceAction}
          billingProfile={billingProfile}
          readyToInvoice={readyToInvoice}
        />
      </DrawerCompactSection>

      <DrawerCompactSection
        title="Scheduling activity"
        subtitle="Assignment, drag/drop, and conflict history"
      >
        <SchedulingEventsCard workOrderId={wo.id} refreshKey={schedulingEventsRefresh} />
      </DrawerCompactSection>

      <DrawerCompactSection
        title="Recent communications"
        subtitle="Confirmations, summary emails, automations, and reminders"
      >
        <RecentCommunicationsCard
          entityType="work_order"
          entityId={wo.id}
          limit={4}
          title="Recent communications"
          description="Confirmations, summary emails, automation runs, and reminders for this work order."
        />
      </DrawerCompactSection>

      {drawerServiceTimelineOpen && serviceTimelineEvents.length > 0 ? (
        <ServiceLifecycleTimeline title="Service timeline" events={serviceTimelineEvents} />
      ) : null}
    </div>
  ) : undefined

  async function sendWorkOrderSummaryEmail() {
    if (!wo || !activeOrgId) return
    const to = woSummaryEmailTo.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      pushToast({
        variant: "destructive",
        title: "Invalid email",
        description: "Enter a valid recipient email address.",
      })
      return
    }
    setWoSummaryEmailBusy(true)
    try {
      const res = await fetch("/api/email/work-order-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrgId,
          workOrderId: wo.id,
          to,
          message: woSummaryEmailNote.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        pushToast({
          variant: "destructive",
          title: "Could not send email",
          description: typeof data.message === "string" ? data.message : "Request failed.",
        })
        return
      }
      pushToast({ title: "Summary email sent", description: `Message sent to ${to}.` })
      setWoSummaryEmailOpen(false)
    } finally {
      setWoSummaryEmailBusy(false)
    }
  }

  const postCompletionActions = showPostComplete && !wo.isArchived ? (
    <div className="space-y-3">
      {wo.calibrationTemplateId ?
        <p className="text-[11px] text-muted-foreground">
          Print or save certificates from the Certificates tab — one card per equipment asset.
        </p>
      : null}
      <div className="flex flex-wrap gap-2 items-center">
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
        {woCanCreateInvoice ? (
          <>
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleCreateInvoiceAction()}>
              <Receipt className="w-3.5 h-3.5" />
              Create Invoice
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setPostEmailDraftOpen(true)}
            >
              <Mail className="w-3.5 h-3.5" />
              Draft Email
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setWoSummaryEmailTo("")
                setWoSummaryEmailNote("")
                setWoSummaryEmailOpen(true)
              }}
            >
              <Mail className="w-3.5 h-3.5" />
              Email work summary
            </Button>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            Post-completion actions (invoicing, customer email) are restricted to other roles.
          </p>
        )}
      </div>
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
          <div className="flex flex-wrap items-center gap-1 shrink-0">
            <Badge variant="secondary" className={cn("text-xs border shrink-0", STATUS_STYLE[currentStatus])}>
              {currentStatus}
            </Badge>
            {dispatchState.dispatchIncomplete ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] shrink-0"
              >
                Dispatch incomplete
              </Badge>
            ) : null}
            {wo.isArchived ? (
              <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border shrink-0">
                Archived
              </Badge>
            ) : null}
            {readyToInvoice ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] shrink-0"
              >
                Ready to invoice
              </Badge>
            ) : null}
          </div>
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
              {!wo.isArchived ? (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                  <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit
                </Button>
              ) : null}
              {serviceTimelineEvents.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant={drawerServiceTimelineOpen ? "secondary" : "outline"}
                  className="gap-1.5 text-xs cursor-pointer"
                  aria-expanded={drawerServiceTimelineOpen}
                  onClick={() => setDrawerServiceTimelineOpen((o) => !o)}
                >
                  <History className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {drawerServiceTimelineOpen ? "Hide timeline" : "Timeline"}
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild className="text-xs cursor-pointer">
                <Link
                  href={`/work-orders?workOrderId=${encodeURIComponent(workOrderId)}`}
                  className="flex items-center gap-1.5"
                  onClick={() => {
                    if (process.env.NODE_ENV === "development") {
                      const href = `/work-orders?workOrderId=${encodeURIComponent(workOrderId)}`
                      console.debug("[work-order-drawer] Full profile navigation", {
                        workOrderId,
                        href,
                        display: getWorkOrderDisplay(wo),
                        organizationId: activeOrgId,
                        orgStatus,
                      })
                    }
                  }}
                >
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
                      <span className="text-muted-foreground">{wo.technicianName}</span>
                    </span>
                  }
                  editing={woCanManageDispatch}
                >
                  {woCanManageDispatch ? (
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
                      className={cn(
                        DRAWER_FIELD_CLASS,
                        "w-full cursor-pointer shadow-xs transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
                      )}
                    >
                      <option value="unassigned">Unassigned</option>
                      {technicianOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
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
                {wo.invoiceNumber && woOrgPermissions.canViewFinancials && (
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

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden min-w-0">
          <WorkOrderDetailExperience
            layout="drawer"
            workOrder={displayWo ?? wo}
            internalNotes={notesInternal}
            internalNotesEditable={!wo.isArchived}
            onInternalNotesChange={setNotesInternal}
            planServices={planServices}
            activityItems={buildWorkOrderActivityItems(wo)}
            overviewLeadSlot={drawerOverviewLeadSlot}
            overviewFooterSlot={
              orgStatus === "ready" && activeOrgId && wo.id && woCanEdit ?
                <WorkOrderAiTechnicianAssistPanel
                  organizationId={activeOrgId}
                  workOrderId={wo.id}
                  workOrderArchived={Boolean(wo.isArchived)}
                  canEdit={woCanEdit}
                />
              : null
            }
            problemReported={problemReportedDraft}
            onProblemReportedChange={setProblemReportedDraft}
            problemReportedInlineEditable={!wo.isArchived}
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
            notesFieldsEditable={!wo.isArchived}
            parts={tabParts}
            onPartsChange={setTabParts}
            tabsValue={drawerTab}
            onTabsValueChange={handleDrawerTabChange}
            partsTabLeadSlot={
              orgStatus === "ready" && activeOrgId && wo.id ?
                <>
                  {woCanEdit ?
                    <WorkOrderAiPartsSuggestionsPanel
                      organizationId={activeOrgId}
                      workOrderId={wo.id}
                      workOrderArchived={Boolean(wo.isArchived)}
                      canEdit={woCanEdit}
                    />
                  : null}
                  <WorkOrderTruckConsumeCard organizationId={activeOrgId} workOrderId={wo.id} />
                </>
              : null
            }
            partsTabToolbar={
              <div className="flex flex-col gap-2">
                {partsDirty ? (
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
                ) : null}
                {orgStatus === "ready" && activeOrgId && wo.id ? (
                  <WorkOrderInventoryUsageCard
                    organizationId={activeOrgId}
                    workOrderId={wo.id}
                  />
                ) : null}
              </div>
            }
            partsTableExtraActions={
              !wo.isArchived && orgStatus === "ready" && activeOrgId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setCatalogPickerOpen(true)}
                >
                  <PackageSearch className="w-3.5 h-3.5" />
                  Add from catalog
                </Button>
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
            notesTabFooterSlot={
              orgStatus === "ready" && activeOrgId && wo.id && woCanEdit ?
                <WorkOrderAiServiceSummaryPanel
                  organizationId={activeOrgId}
                  workOrderId={wo.id}
                  workOrderArchived={Boolean(wo.isArchived)}
                  canEdit={woCanEdit}
                  savedInternal={wo.repairLog.internalServiceSummary}
                  savedCustomer={wo.repairLog.customerServiceSummary}
                  onPersistSummaries={persistServiceSummaries}
                />
              : null
            }
            equipmentAssets={equipmentAssets}
            onNavigateToCertificateForEquipment={(eqId) => {
              setDrawerTab("certificates")
              setCertificateFocusEquipmentId(eqId)
            }}
            onOpenAddEquipment={
              wo && activeOrgId && wo.customerId && !wo.isArchived
                ? () => setAddEquipmentOpen(true)
                : undefined
            }
            onRemoveEquipmentAsset={handleRemoveEquipmentFromWorkOrder}
            certificateTabContent={
              <CertificateMultiTabContent
                organizationId={activeOrgId}
                workOrder={wo}
                equipmentAssets={equipmentAssets}
                onCompletionSlotsChange={setCompletionCertSlots}
                focusEquipmentId={certificateFocusEquipmentId}
                onFocusEquipmentApplied={() => setCertificateFocusEquipmentId(null)}
              />
            }
            sigData={wo.repairLog.signatureDataUrl}
            signedBy={wo.repairLog.signedBy}
            signedAt={wo.repairLog.signedAt}
            customerSignaturePreviewUrl={wo.customerSignaturePreviewUrl}
            customerSignatureCapturedAt={wo.customerSignatureCapturedAt}
            onCustomerSignatureSave={(blob, name) => handleCustomerSignatureSave(blob, name)}
            signatureCaptureEnabled
            fieldsEditable={editing && !wo.isArchived}
            partsPhotosEditable={!wo.isArchived}
            tasksEditable={!wo.isArchived}
            onEditWorkOrder={startEdit}
            onAssignTechnician={() => {
              if (woCanManageDispatch) setAssignDialogOpen(true)
            }}
            onMarkComplete={() => setCloseOutOpen(true)}
            workflowHints={workflowHints}
            postCompletionActions={postCompletionActions}
            quoteHref={quoteHref}
            onInvoicePlaceholder={() => handleCreateInvoiceAction()}
            canCreateQuote={woOrgPermissions.canEditQuotes}
            canCreateInvoice={woCanCreateInvoice}
            onPrint={() => void handlePrintWorkOrderSummary()}
            onArchive={
              canArchiveRestore
                ? () => void (wo.isArchived ? restoreWorkOrder() : archiveWorkOrder())
                : undefined
            }
          />
          {!editing && !wo.isArchived ? (
            <TechnicianMobileQuickBar
              stickyDock
              phone={primaryPhone}
              navigateQuery={navigateQuery}
              showComplete={["Open", "Scheduled", "In Progress"].includes(wo.status)}
              onComplete={() => setCloseOutOpen(true)}
              onPhotoFiles={(files) => void handleAttachmentUpload(files)}
              onSignature={() => {
                handleDrawerTabChange("overview")
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    window.setTimeout(() => {
                      document
                        .getElementById("customer-signature-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }, 100)
                  })
                })
              }}
              onTechnicianNotes={() => {
                handleDrawerTabChange("notes")
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    window.setTimeout(() => {
                      document
                        .getElementById("technician-notes-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }, 100)
                  })
                })
              }}
              onCertificates={() => handleDrawerTabChange("certificates")}
              showCertificatesShortcut={
                Boolean(wo.calibrationTemplateId) || equipmentAssets.length > 0
              }
            />
          ) : null}
          </div>
        </div>
      </DetailDrawer>

      {wo && activeOrgId && orgStatus === "ready" ? (
        <AddWorkOrderEquipmentModal
          open={addEquipmentOpen}
          onClose={() => setAddEquipmentOpen(false)}
          onSuccess={() => void handleAddEquipmentToWorkOrderSuccess()}
          organizationId={activeOrgId}
          customerId={wo.customerId}
          workOrderId={wo.id}
          excludeEquipmentIds={equipmentIdsOnWorkOrder}
          defaultWorkType={(displayWo ?? wo).type}
          defaultPriority={(displayWo ?? wo).priority}
        />
      ) : null}

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
                className={cn(DRAWER_FIELD_CLASS, "w-full")}
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

      {woSummaryEmailOpen ? (
        <div className={cn("fixed inset-0 flex items-center justify-center p-4", NESTED_OVER_DRAWER_Z)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !woSummaryEmailBusy && setWoSummaryEmailOpen(false)} />
          <div className={cn(DRAWER_STACKED_MODAL, "relative z-[1] max-w-lg")}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Email work order summary
              </h3>
              <button
                type="button"
                onClick={() => !woSummaryEmailBusy && setWoSummaryEmailOpen(false)}
                disabled={woSummaryEmailBusy}
                className="p-1 rounded hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">
                  To
                </label>
                <input
                  type="email"
                  value={woSummaryEmailTo}
                  onChange={(e) => setWoSummaryEmailTo(e.target.value)}
                  placeholder="customer@example.com"
                  className={cn(DRAWER_FIELD_CLASS, "w-full px-3 py-2 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors")}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">
                  Optional note for customer
                </label>
                <textarea
                  rows={4}
                  value={woSummaryEmailNote}
                  onChange={(e) => setWoSummaryEmailNote(e.target.value)}
                  className={cn(
                    DRAWER_FIELD_CLASS,
                    "w-full px-3 py-2 resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
                  )}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWoSummaryEmailOpen(false)}
                disabled={woSummaryEmailBusy}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void sendWorkOrderSummaryEmail()}
                disabled={woSummaryEmailBusy}
                className="text-xs gap-1.5"
              >
                {woSummaryEmailBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" /> Send email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <WorkOrderCloseOutDialog
        open={closeOutOpen}
        onOpenChange={setCloseOutOpen}
        workOrder={wo}
        certificateAssigned={Boolean(wo.calibrationTemplateId)}
        certificateComplete={certComplete}
        certificateBlockingMessage={closeOutCertGate.message}
        signatureCaptured={customerSignatureCaptured(wo)}
        diagnosis={notesDiagnosis}
        technicianNotes={notesTechnician}
        notesDirty={notesDirty}
        onGoToCertificateTab={() => {
          setCloseOutOpen(false)
          setDrawerTab("certificates")
        }}
        onGoToNotesTab={() => {
          setCloseOutOpen(false)
          setDrawerTab("notes")
        }}
        onGoToSignature={() => {
          setCloseOutOpen(false)
          setDrawerTab("overview")
        }}
        onFinalize={handleCloseOutFinalize}
        onPrintCertificate={handleCertificatePrintHint}
        onSaveCertificate={handleCertificatePrintHint}
        onCreateInvoice={() => {
          setCloseOutOpen(false)
          handleCreateInvoiceAction()
        }}
      />

      <WorkOrderCustomerEmailDraftDialog
        open={postEmailDraftOpen}
        onOpenChange={setPostEmailDraftOpen}
        workOrder={wo}
        diagnosis={notesDiagnosis}
        technicianNotes={notesTechnician}
      />

      <AssignTechnicianDialog
        open={assignDialogOpen && woCanManageDispatch}
        onOpenChange={setAssignDialogOpen}
        options={technicianAssignOptions}
        currentTechnicianId={wo.technicianId}
        savingKey={assignSavingKey}
        onSelect={(userId) => void persistTechnicianAssignment(userId)}
      />

      <AddFromCatalogDialog
        open={catalogPickerOpen}
        onOpenChange={setCatalogPickerOpen}
        organizationId={orgStatus === "ready" ? activeOrgId : null}
        pricingMode="sale"
        onPick={(row, qty) => {
          setTabParts((prev) => [...prev, buildWorkOrderPartFromCatalog(row, qty)])
        }}
      />

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
