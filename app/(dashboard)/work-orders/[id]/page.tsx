"use client"

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  loadWorkOrderDetailForOrg,
  type WorkOrderDocumentItem,
  type WorkOrderEquipmentAsset,
  type WorkOrderPhotoGalleryItem,
} from "@/lib/work-orders/detail-load"
import { repairLogJsonForPersist } from "@/lib/work-orders/parse-repair-log"
import {
  deleteWorkOrderAttachment,
  isWorkOrderPhotoCategoryMime,
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
import { cloneTasks, tasksEqual, type TaskDraft } from "@/lib/work-orders/tasks-snapshot"
import { partsEqual } from "@/lib/work-orders/parts-snapshot"
import { useWorkOrders } from "@/lib/work-order-store"
import type { AdminInvoice, Part, RepairLog, WorkOrder, WorkOrderStatus } from "@/lib/mock-data"
import { fetchInvoicesForWorkOrder } from "@/lib/org-quotes-invoices/repository"
import { buildWorkOrderServiceTimeline } from "@/lib/lifecycle/service-timeline"
import { ServiceLifecycleTimeline } from "@/components/lifecycle/service-lifecycle-timeline"
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
  ChevronLeft,
  CheckCircle2,
  PenLine,
  Save,
  AlertTriangle,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  WorkOrderDetailExperience,
  buildWorkOrderActivityItems,
} from "@/components/work-orders/work-order-detail-experience"
import { WorkOrderAiServiceSummaryPanel } from "@/components/work-orders/work-order-ai-service-summary-panel"
import { WorkOrderAiPartsSuggestionsPanel } from "@/components/work-orders/work-order-ai-parts-suggestions-panel"
import { WorkOrderAiTechnicianAssistPanel } from "@/components/work-orders/work-order-ai-technician-assist-panel"
import { useToast } from "@/hooks/use-toast"
import { CertificateMultiTabContent } from "@/components/work-orders/certificate-multi-tab-content"
import { WorkOrderTruckConsumeCard } from "@/components/inventory/work-order-truck-consume-card"
import { TechnicianMobileQuickBar } from "@/components/technician/technician-mobile-quick-bar"
import { WorkOrderSyncPrepBanner } from "@/components/sync-prep/work-order-sync-prep-banner"
import { WorkOrderOfflineConflictDialog } from "@/components/work-orders/work-order-offline-conflict-dialog"
import { WorkOrderOfflineSyncBar } from "@/components/work-orders/work-order-offline-sync-bar"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { subscribeWorkOrderOfflineBump } from "@/lib/work-orders/offline/broadcast"
import {
  deleteWorkOrderOfflineForScope,
  filterPendingOfflineRecords,
  getWorkOrderOfflineRecordForScope,
} from "@/lib/work-orders/offline/idb-store"
import { putOfflineBundleMergePatch } from "@/lib/work-orders/offline/concurrency-put"
import {
  makeWorkOrderOfflineScopeKey,
  type WorkOrderOfflineBundlePayload,
  type WorkOrderOfflineOutboxRecord,
} from "@/lib/work-orders/offline/types"
import { ONLINE_REQUIRED_LABEL, SYNC_PREP_COPY } from "@/lib/sync-prep"
import { AidenProductivitySection } from "@/components/aiden/aiden-productivity-section"
import { useCustomerPrimaryPhone } from "@/hooks/use-customer-primary-phone"
import { useWorkOrderOfflinePendingPhotoPreviews } from "@/hooks/use-work-order-offline-pending-photo-previews"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import {
  appendWorkOrderOfflinePhotoQueue,
  removeWorkOrderOfflineQueuedPhoto,
} from "@/lib/work-orders/offline/offline-photo-queue"

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

const LABOR_RATE = 95

function fmtShortDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n)
}

const nextStatus: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  Open: "Scheduled",
  Scheduled: "In Progress",
  "In Progress": "Completed",
  "Completed Pending Signature": "Invoiced",
  Completed: "Invoiced",
}

export default function WorkOrderDetailPage() {
  const routeParams = useParams<{ id?: string | string[] }>()
  const rawId = routeParams?.id
  const rawSegment =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] ?? "" : ""
  const workOrderRouteId = useMemo(() => {
    const t = rawSegment.trim()
    if (!t) return ""
    try {
      return decodeURIComponent(t)
    } catch {
      return t
    }
  }, [rawSegment])
  const router = useRouter()
  const { toast } = useToast()
  const activeOrg = useActiveOrganization()
  const { permissions: orgPermissions, status: orgPermStatus } = useOrgPermissions()
  const { getById, updateStatus, updateRepairLog, updateWorkOrder } = useWorkOrders()

  const storeWo = getById(workOrderRouteId)
  const [dbWo, setDbWo] = useState<WorkOrder | null | undefined>(undefined)
  const [internalNotes, setInternalNotes] = useState("")
  /** Server `work_orders.notes` at last successful load — used for offline bundle baselines. */
  const [serverInternalNotes, setServerInternalNotes] = useState("")
  const [planServices, setPlanServices] = useState<unknown[] | null>(null)
  const [photoGallery, setPhotoGallery] = useState<WorkOrderPhotoGalleryItem[]>([])
  const [documentAttachments, setDocumentAttachments] = useState<WorkOrderDocumentItem[]>([])
  const [usesPartsLineItems, setUsesPartsLineItems] = useState(false)
  const [usesTasksTable, setUsesTasksTable] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<number | null>(null)
  const [attachmentUploadLabel, setAttachmentUploadLabel] = useState("")
  const partsPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dbLoadFailed, setDbLoadFailed] = useState(false)
  const [detailLoadMessage, setDetailLoadMessage] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [savedBanner, setSavedBanner] = useState<"server" | "local" | null>(null)
  const [billingDecisionOpen, setBillingDecisionOpen] = useState(false)
  const [billingSaving, setBillingSaving] = useState(false)
  const [billingVendorId, setBillingVendorId] = useState("")
  const [warrantyVendorOptions, setWarrantyVendorOptions] = useState<Array<{ id: string; name: string }>>([])

  const [problemReported, setProblemReported] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [parts, setParts] = useState<Part[]>([])
  const [laborHours, setLaborHours] = useState(0)
  const [techNotes, setTechNotes] = useState("")
  const [tabTasks, setTabTasks] = useState<TaskDraft[]>([])
  const [savedTasks, setSavedTasks] = useState<TaskDraft[]>([])
  const [tasksSaving, setTasksSaving] = useState(false)
  const [sigData, setSigData] = useState("")
  const [signedBy, setSignedBy] = useState("")
  const [signedAt, setSignedAt] = useState("")
  const [equipmentAssets, setEquipmentAssets] = useState<WorkOrderEquipmentAsset[]>([])
  const [completionCertSlots, setCompletionCertSlots] = useState<CompletionCertificateSlot[]>([])
  const [pageWoTab, setPageWoTab] = useState("overview")
  const [pageCertificateFocusEqId, setPageCertificateFocusEqId] = useState<string | null>(null)
  const [linkedInvoices, setLinkedInvoices] = useState<AdminInvoice[]>([])
  const { online } = useNetworkStatus()
  const [pageUserId, setPageUserId] = useState<string | null>(null)
  const [pageOfflineDigest, setPageOfflineDigest] = useState<{
    status?: WorkOrderOfflineOutboxRecord["status"]
    pending: boolean
  }>({ pending: false })
  const [pageConflictOpen, setPageConflictOpen] = useState(false)
  const [pageConflictRecord, setPageConflictRecord] = useState<WorkOrderOfflineOutboxRecord | null>(null)
  const [pageOfflineFormEpoch, setPageOfflineFormEpoch] = useState(0)

  const pendingOfflinePhotoPreviews = useWorkOrderOfflinePendingPhotoPreviews(
    activeOrg.status === "ready" ? activeOrg.organizationId : null,
    pageUserId,
    workOrderRouteId || null,
  )

  const reload = useCallback(async () => {
    if (!workOrderRouteId) {
      setDbWo(null)
      setDetailLoadMessage("No work order id in the URL.")
      setDbLoadFailed(true)
      return
    }

    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setPageUserId(null)
      setDbWo(null)
      setDetailLoadMessage(null)
      setDbLoadFailed(false)
      return
    }
    setPageUserId(user.id)
    // Wait for org context — do not setDbWo(null) here or we flash "not found" before org is ready.
    if (activeOrg.switching || activeOrg.status !== "ready" || !activeOrg.organizationId) {
      return
    }
    const orgId = activeOrg.organizationId
    const res = await loadWorkOrderDetailForOrg(supabase, orgId, workOrderRouteId)

    if (process.env.NODE_ENV === "development") {
      console.debug("[work-order-detail-page] loadWorkOrderDetailForOrg", {
        rawParam: rawSegment,
        decodedRouteId: workOrderRouteId,
        organizationId: orgId,
        orgStatus: activeOrg.status,
        switching: activeOrg.switching,
        ok: res.ok,
        ...(res.ok
          ? { workOrderId: res.data.workOrder.id }
          : { notFound: res.notFound, message: "message" in res ? res.message : undefined }),
      })
    }

    if (!res.ok) {
      setDbWo(null)
      setDetailLoadMessage(
        res.notFound
          ? null
          : ("message" in res && res.message) ? res.message : "Could not load this work order.",
      )
      if (!res.notFound) setDbLoadFailed(true)
      return
    }
    setDbLoadFailed(false)
    setDetailLoadMessage(null)
    setDbWo(res.data.workOrder)
    const n = res.data.notes ?? ""
    setInternalNotes(n)
    setServerInternalNotes(n)
    setPlanServices(res.data.planServices)
    setPhotoGallery(res.data.photoGallery)
    setDocumentAttachments(res.data.documentAttachments)
    setUsesPartsLineItems(res.data.usesPartsLineItems)
    setUsesTasksTable(res.data.usesTasksTable)
    setEquipmentAssets(res.data.equipmentAssets ?? [])
    const ts = cloneTasks(res.data.workOrder.repairLog.tasks ?? [])
    setTabTasks(ts)
    setSavedTasks(ts)
  }, [
    workOrderRouteId,
    rawSegment,
    activeOrg.status,
    activeOrg.organizationId,
    activeOrg.switching,
  ])

  useLayoutEffect(() => {
    setDbWo(undefined)
    setDbLoadFailed(false)
    setDetailLoadMessage(null)
  }, [workOrderRouteId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) return
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("org_vendors")
        .select("id, name")
        .eq("organization_id", activeOrg.organizationId)
        .eq("status", "active")
        .order("name", { ascending: true })
      setWarrantyVendorOptions(((data ?? []) as Array<{ id: string; name: string }>).filter((v) => v.name?.trim()))
    })()
  }, [activeOrg.status, activeOrg.organizationId])

  const wo = dbWo ?? storeWo

  const fullPageOfflineSaveContext = useMemo(() => {
    if (!wo) {
      return {
        unsafeDirty: false,
        safeTextDirty: false,
        safeTasksDirty: false,
      }
    }
    const serverLabor = typeof wo.repairLog.laborHours === "number" ? wo.repairLog.laborHours : 0
    const unsafePartsDirty = !partsEqual(parts, wo.repairLog.partsUsed ?? [])
    const unsafeLaborDirty = laborHours !== serverLabor
    const unsafeSigDirty =
      (sigData ?? "") !== (wo.repairLog.signatureDataUrl ?? "") ||
      (signedBy ?? "") !== (wo.repairLog.signedBy ?? "") ||
      (signedAt ?? "") !== (wo.repairLog.signedAt ?? "")
    const safeTextDirty =
      problemReported.trim() !== (wo.repairLog.problemReported ?? "").trim() ||
      diagnosis !== (wo.repairLog.diagnosis ?? "") ||
      techNotes !== (wo.repairLog.technicianNotes ?? "") ||
      internalNotes.trim() !== (serverInternalNotes ?? "").trim()
    const tasksDirtyPage = !tasksEqual(tabTasks, savedTasks)
    const safeTasksDirty = !usesTasksTable && tasksDirtyPage
    const unsafeDirty = unsafePartsDirty || unsafeLaborDirty || unsafeSigDirty
    return { unsafeDirty, safeTextDirty, safeTasksDirty }
  }, [
    wo,
    parts,
    laborHours,
    sigData,
    signedBy,
    signedAt,
    problemReported,
    diagnosis,
    techNotes,
    internalNotes,
    serverInternalNotes,
    tabTasks,
    savedTasks,
    usesTasksTable,
  ])

  const refreshPageOfflineDigest = useCallback(async () => {
    if (!activeOrg.organizationId || !pageUserId || !workOrderRouteId) {
      setPageOfflineDigest({ pending: false })
      return
    }
    const sk = makeWorkOrderOfflineScopeKey(activeOrg.organizationId, pageUserId, workOrderRouteId)
    const r = await getWorkOrderOfflineRecordForScope(sk)
    setPageOfflineDigest({
      status: r?.status,
      pending: r ? filterPendingOfflineRecords([r]).length > 0 : false,
    })
  }, [activeOrg.organizationId, pageUserId, workOrderRouteId])

  useEffect(() => {
    void refreshPageOfflineDigest()
  }, [refreshPageOfflineDigest])

  useEffect(() => {
    return subscribeWorkOrderOfflineBump(() => {
      void refreshPageOfflineDigest()
      setPageOfflineFormEpoch((n) => n + 1)
    })
  }, [refreshPageOfflineDigest])

  const queuePageOfflineBundle = useCallback(
    async (patch: Partial<WorkOrderOfflineBundlePayload>) => {
      const snapshot = dbWo ?? storeWo
      if (!activeOrg.organizationId || !pageUserId || !snapshot?.id) {
        return { ok: false as const, reason: "no_changes" as const }
      }
      const r = await putOfflineBundleMergePatch({
        organizationId: activeOrg.organizationId,
        userId: pageUserId,
        workOrder: snapshot,
        dbNotes: serverInternalNotes,
        patch,
      })
      if (r.ok) await refreshPageOfflineDigest()
      return r
    },
    [activeOrg.organizationId, pageUserId, dbWo, storeWo, serverInternalNotes, refreshPageOfflineDigest],
  )

  const woTimelineEvents = useMemo(() => {
    if (!wo) return []
    return buildWorkOrderServiceTimeline(wo, linkedInvoices)
  }, [wo, linkedInvoices])

  useEffect(() => {
    if (!wo?.id || activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setLinkedInvoices([])
      return
    }
    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    const orgId = activeOrg.organizationId
    void (async () => {
      const { invoices, error } = await fetchInvoicesForWorkOrder(supabase, orgId, wo.id)
      if (!cancelled) setLinkedInvoices(error ? [] : invoices)
    })()
    return () => {
      cancelled = true
    }
  }, [wo?.id, activeOrg.status, activeOrg.organizationId])

  const orgBlockingDetail =
    activeOrg.switching || activeOrg.status !== "ready" || !activeOrg.organizationId
  const awaitingDb =
    !orgBlockingDetail &&
    Boolean(workOrderRouteId) &&
    dbWo === undefined &&
    !storeWo
  const loading =
    Boolean(workOrderRouteId) && (orgBlockingDetail || awaitingDb)

  useEffect(() => {
    if (!wo) return
    let cancelled = false
    void (async () => {
      if (activeOrg.organizationId && pageUserId) {
        const sk = makeWorkOrderOfflineScopeKey(activeOrg.organizationId, pageUserId, wo.id)
        const rec = await getWorkOrderOfflineRecordForScope(sk)
        if (
          !cancelled &&
          rec &&
          filterPendingOfflineRecords([rec]).length
        ) {
          if (rec.payload.repair) {
            setProblemReported(rec.payload.repair.problemReported)
            setDiagnosis(rec.payload.repair.diagnosis)
            setTechNotes(rec.payload.repair.technicianNotes)
            setInternalNotes(rec.payload.repair.notesInternal)
          }
          if (rec.payload.tasks && !usesTasksTable) {
            const ots = rec.payload.tasks.map((t) => ({
              id: t.id,
              label: t.label,
              done: t.done,
              description: t.description,
            }))
            setTabTasks(ots)
            setSavedTasks(ots)
          }
          const rl = wo.repairLog
          setParts(rl.partsUsed)
          setLaborHours(rl.laborHours)
          setSigData(rl.signatureDataUrl)
          setSignedBy(rl.signedBy)
          setSignedAt(rl.signedAt)
          return
        }
      }
      if (cancelled) return
      const rl = wo.repairLog
      setProblemReported(rl.problemReported)
      setDiagnosis(rl.diagnosis)
      setParts(rl.partsUsed)
      setLaborHours(rl.laborHours)
      setTechNotes(rl.technicianNotes)
      const tsn = cloneTasks(rl.tasks ?? [])
      setTabTasks(tsn)
      setSavedTasks(tsn)
      setSigData(rl.signatureDataUrl)
      setSignedBy(rl.signedBy)
      setSignedAt(rl.signedAt)
    })()
    return () => {
      cancelled = true
    }
  }, [wo, activeOrg.organizationId, pageUserId, usesTasksTable, pageOfflineFormEpoch])

  const tasksDirty = useMemo(
    () => !tasksEqual(tabTasks ?? [], savedTasks ?? []),
    [tabTasks, savedTasks],
  )

  /** Must run unconditionally (before early returns) — use `wo` until `workOrder` is assigned below. */
  const primaryPhone = useCustomerPrimaryPhone(
    wo?.customerId,
    activeOrg.status === "ready" ? activeOrg.organizationId : null,
  )
  const navigateQuery = useMemo(() => {
    return [wo?.customerName, wo?.location].filter(Boolean).join(" ").trim()
  }, [wo?.customerName, wo?.location])

  const mobileJumpToSection = useCallback((tab: string, sectionId?: string | null) => {
    setPageWoTab(tab)
    const id = sectionId?.trim()
    if (!id) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 100)
      })
    })
  }, [])

  if (!workOrderRouteId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 max-w-md mx-auto text-center px-4">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Invalid work order link</p>
          <p className="text-sm text-muted-foreground">
            The URL is missing a work order id. Open the job from Work Orders or use a shared link that includes the id.
          </p>
        </div>
        <Link href="/work-orders">
          <Button variant="outline">Back to Work Orders</Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">
          {orgBlockingDetail ? "Loading workspace…" : "Loading work order…"}
        </p>
      </div>
    )
  }

  if (!wo) {
    const devOrg =
      process.env.NODE_ENV === "development"
        ? activeOrg.organizationId ?? "(no organization id)"
        : null
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 max-w-lg mx-auto text-center px-4">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {dbLoadFailed ? "Could not load this work order" : "Work order not found"}
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            Attempted id: {workOrderRouteId}
          </p>
          {detailLoadMessage ? (
            <p className="text-sm text-muted-foreground">{detailLoadMessage}</p>
          ) : dbLoadFailed ? null : (
            <p className="text-sm text-muted-foreground">
              This id may not exist in your current workspace, or it may belong to another organization.
            </p>
          )}
          {process.env.NODE_ENV === "development" ? (
            <p className="text-[11px] text-muted-foreground font-mono">
              organizationId: {String(devOrg)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Link href="/work-orders">
            <Button variant="outline">Back to Work Orders</Button>
          </Link>
          <Link href={`/work-orders?workOrderId=${encodeURIComponent(workOrderRouteId)}`}>
            <Button variant="secondary">Open in Work Orders drawer</Button>
          </Link>
        </div>
      </div>
    )
  }

  const workOrder = wo
  const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)
  const laborCost = laborHours * LABOR_RATE
  const editable = editing && ["Open", "Scheduled", "In Progress"].includes(workOrder.status)
  const woCanEdit = orgPermStatus !== "loading" && orgPermissions.canEditWorkOrders

  async function openPageOfflineConflictReview() {
    if (!activeOrg.organizationId || !pageUserId) return
    const sk = makeWorkOrderOfflineScopeKey(activeOrg.organizationId, pageUserId, workOrder.id)
    setPageConflictRecord((await getWorkOrderOfflineRecordForScope(sk)) ?? null)
    setPageConflictOpen(true)
  }

  async function discardPageOfflineDraft() {
    if (!activeOrg.organizationId || !pageUserId) return
    await deleteWorkOrderOfflineForScope(makeWorkOrderOfflineScopeKey(activeOrg.organizationId, pageUserId, workOrder.id))
    await refreshPageOfflineDigest()
    await reload()
  }

  async function persistUpdate(payload: Record<string, unknown>) {
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: SYNC_PREP_COPY.workOrderFullPageUnsafeOfflineBody,
      })
      return false
    }
    if (!activeOrg.organizationId) {
      toast({ title: "Not signed in", description: "Save your session and try again.", variant: "destructive" })
      return false
    }
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update(payload)
      .eq("id", workOrder.id)
      .eq("organization_id", activeOrg.organizationId)
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
      return false
    }
    await reload()
    return true
  }

  async function handleSave() {
    if (!woCanEdit) return

    const { unsafeDirty, safeTextDirty, safeTasksDirty } = fullPageOfflineSaveContext

    if (!online) {
      const patch: Partial<WorkOrderOfflineBundlePayload> = {}
      if (safeTextDirty) {
        patch.repair = {
          problemReported,
          diagnosis,
          technicianNotes: techNotes,
          notesInternal: internalNotes,
        }
      }
      if (safeTasksDirty) {
        patch.tasks = tabTasks
          .filter((t) => t.label.trim())
          .map((t) => ({
            ...t,
            label: t.label.trim(),
            description: t.description?.trim() || undefined,
          }))
      }
      const hasPatch = patch.repair !== undefined || patch.tasks !== undefined
      if (!hasPatch) {
        if (unsafeDirty) {
          toast({
            variant: "destructive",
            title: SYNC_PREP_COPY.workOrderFullPageUnsafeOfflineTitle,
            description: SYNC_PREP_COPY.workOrderFullPageUnsafeOfflineBody,
          })
        } else {
          toast({
            title: "Nothing to save",
            description: "No technician field changes to queue offline.",
          })
        }
        return
      }
      const qr = await queuePageOfflineBundle(patch)
      if (!qr.ok) {
        if (qr.reason === "syncing") {
          toast({
            variant: "destructive",
            title: SYNC_PREP_COPY.workOrderOfflineQueueBlockedSyncingTitle,
            description: SYNC_PREP_COPY.workOrderOfflineQueueBlockedSyncingBody,
          })
        } else if (qr.reason === "conflict") {
          toast({
            variant: "destructive",
            title: SYNC_PREP_COPY.workOrderOfflineQueueBlockedConflictTitle,
            description: SYNC_PREP_COPY.workOrderOfflineQueueBlockedConflictBody,
          })
        } else {
          toast({
            variant: "destructive",
            title: "Could not save locally",
            description: "Try again when signed in and this job is loaded.",
          })
        }
        return
      }
      if (unsafeDirty) {
        toast({
          title: SYNC_PREP_COPY.workOrderFullPageSplitOfflineSaveTitle,
          description: SYNC_PREP_COPY.workOrderFullPageSplitOfflineSaveBody,
        })
      } else {
        toast({
          title: SYNC_PREP_COPY.workOrderFullPageTechnicianSavedLocalTitle,
          description: SYNC_PREP_COPY.workOrderFullPageTechnicianSavedLocalBody,
        })
      }
      if (safeTasksDirty) {
        setSavedTasks(
          cloneTasks(
            (patch.tasks ?? []).map((t) => ({
              id: t.id,
              label: t.label,
              done: t.done,
              description: t.description,
            })),
          ),
        )
      }
      setSavedBanner("local")
      setTimeout(() => setSavedBanner(null), 5000)
      if (!unsafeDirty) {
        setEditing(false)
      }
      return
    }

    const payload: Record<string, unknown> = {
      problem_reported: problemReported.trim() || null,
      repair_log: repairLogJsonForPersist(
        {
          ...workOrder.repairLog,
          problemReported,
          diagnosis,
          partsUsed: usesPartsLineItems ? [] : parts,
          laborHours,
          technicianNotes: techNotes,
          photos: workOrder.repairLog.photos,
          signatureDataUrl: sigData,
          signedBy,
          signedAt,
          tasks: usesTasksTable ? [] : tabTasks,
        },
        {
          stripTasks: usesTasksTable,
          stripParts: usesPartsLineItems,
        },
      ),
      total_labor_cents: Math.round(laborCost * 100),
      notes: internalNotes.trim() || null,
    }
    if (!usesPartsLineItems) {
      payload.total_parts_cents = Math.round(partsCost * 100)
    }

    const ok = await persistUpdate(payload)
    if (!ok) return

    updateRepairLog(workOrder.id, {
      problemReported,
      diagnosis,
      partsUsed: parts,
      laborHours,
      technicianNotes: techNotes,
      photos: workOrder.repairLog.photos,
      signatureDataUrl: sigData,
      signedBy,
      signedAt,
      tasks: tabTasks,
    })
    updateWorkOrder(workOrder.id, {
      totalLaborCost: laborCost,
      totalPartsCost: usesPartsLineItems ? workOrder.totalPartsCost : partsCost,
    })
    setServerInternalNotes(internalNotes.trim())
    setSavedBanner("server")
    setEditing(false)
    setTimeout(() => setSavedBanner(null), 3000)
  }

  async function finalizeWorkOrderCompletion(): Promise<boolean> {
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Finishing a job requires a connection (certificates, signatures, and server status).",
      })
      return false
    }
    const gate = certificateGateForCompletionAllAssets({
      calibrationTemplateId: workOrder.calibrationTemplateId,
      slots: completionCertSlots,
    })
    if (!gate.ok) {
      toast({
        variant: "destructive",
        title: "Certificate required",
        description: gate.message ?? "Complete the certificate before finishing this work order.",
      })
      return false
    }
    const hasSig = customerSignatureCaptured(workOrder)
    const nextUi: WorkOrderStatus = hasSig ? "Completed" : "Completed Pending Signature"
    const ok = await persistUpdate({
      status: uiStatusToDb(nextUi),
      completed_at: new Date().toISOString(),
    })
    if (ok) {
      updateStatus(workOrder.id, nextUi)
      toast({
        title: hasSig ? "Work order completed" : "Work order completed",
        description: hasSig
          ? "Service is marked complete."
          : "Capture the customer signature on the Overview tab when you can.",
      })
    }
    return ok
  }

  async function handleStatusAdvance(next: WorkOrderStatus) {
    if (next === "Completed") {
      await finalizeWorkOrderCompletion()
      return
    }
    if (!online) {
      if (next === "In Progress" && (workOrder.status === "Open" || workOrder.status === "Scheduled")) {
        const qr = await queuePageOfflineBundle({ statusInProgress: true })
        if (qr.ok) {
          toast({
            title: SYNC_PREP_COPY.savedLocallyLabel,
            description: SYNC_PREP_COPY.workOrderFullPageTechnicianSavedLocalBody,
          })
        } else if (qr.reason === "syncing") {
          toast({
            variant: "destructive",
            title: SYNC_PREP_COPY.workOrderOfflineQueueBlockedSyncingTitle,
            description: SYNC_PREP_COPY.workOrderOfflineQueueBlockedSyncingBody,
          })
        } else if (qr.reason === "conflict") {
          toast({
            variant: "destructive",
            title: SYNC_PREP_COPY.workOrderOfflineQueueBlockedConflictTitle,
            description: SYNC_PREP_COPY.workOrderOfflineQueueBlockedConflictBody,
          })
        } else {
          toast({
            variant: "destructive",
            title: "Could not save locally",
            description: "Try again when this job is fully loaded.",
          })
        }
        return
      }
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: SYNC_PREP_COPY.statusChangeRequiresNetwork,
      })
      return
    }
    const payload: Record<string, unknown> = { status: uiStatusToDb(next) }
    const ok = await persistUpdate(payload)
    if (!ok) return
    updateStatus(workOrder.id, next)
  }

  async function handleMarkComplete() {
    await finalizeWorkOrderCompletion()
  }

  async function applyInvoiceBillingChoice(choice: "customer" | "vendor" | "hold") {
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Billing updates require a connection.",
      })
      return
    }
    if (!activeOrg.organizationId) return
    if (choice === "hold") {
      toast({
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
        ? { billable_to_customer: true, warranty_review_required: false, warranty_vendor_id: null }
        : { billable_to_customer: false, warranty_review_required: false, warranty_vendor_id: billingVendorId || null }
    const { error } = await supabase
      .from("work_orders")
      .update(patch)
      .eq("id", workOrder.id)
      .eq("organization_id", activeOrg.organizationId)
    setBillingSaving(false)
    if (error) {
      toast({ variant: "destructive", title: "Could not update billing choice", description: error.message })
      return
    }
    setBillingDecisionOpen(false)
    await reload()
    window.location.href = buildNewInvoiceHref()
  }

  function buildNewInvoiceHref() {
    const params = new URLSearchParams()
    params.set("action", "new-invoice")
    params.set("workOrderId", workOrder.id)
    return `/invoices?${params.toString()}`
  }

  function handleCreateInvoiceAction() {
    if (workOrder.warrantyReviewRequired) {
      setBillingVendorId(workOrder.warrantyVendorId ?? "")
      setBillingDecisionOpen(true)
      return
    }
    window.location.href = buildNewInvoiceHref()
  }

  async function handleCustomerSignatureSave(blob: Blob, name: string) {
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Signatures upload requires a connection.",
      })
      return
    }
    if (!activeOrg.organizationId) return
    const supabase = createBrowserSupabaseClient()
    const repairLogPayload: RepairLog = {
      ...workOrder.repairLog,
      problemReported,
      diagnosis,
      partsUsed: usesPartsLineItems ? workOrder.repairLog.partsUsed : parts,
      laborHours,
      technicianNotes: techNotes,
      photos: workOrder.repairLog.photos,
      signatureDataUrl: sigData,
      signedBy,
      signedAt,
      tasks: usesTasksTable ? workOrder.repairLog.tasks ?? [] : tabTasks,
    }
    try {
      await persistWorkOrderCustomerSignature(
        supabase,
        activeOrg.organizationId,
        workOrder.id,
        blob,
        name,
        repairLogPayload,
        { stripTasks: usesTasksTable, stripParts: usesPartsLineItems },
      )
      toast({ title: "Signature saved", description: "Customer signature was uploaded." })
      const { data: stRow } = await supabase
        .from("work_orders")
        .select("status")
        .eq("id", workOrder.id)
        .eq("organization_id", activeOrg.organizationId)
        .maybeSingle()
      if ((stRow as { status?: string } | null)?.status === "completed_pending_signature") {
        await supabase
          .from("work_orders")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", workOrder.id)
          .eq("organization_id", activeOrg.organizationId)
      }
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save signature",
        description: e instanceof Error ? e.message : String(e),
      })
    }
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
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Server-backed tasks require a connection.",
      })
      return
    }
    if (!editable || !activeOrg.organizationId) return
    const supabase = createBrowserSupabaseClient()
    try {
      await replaceWorkOrderTasks(
        supabase,
        activeOrg.organizationId,
        workOrder.id,
        next.map(({ label, done, description }) => ({ label, done, description })),
      )
      const { error: rlErr } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist(workOrder.repairLog, { stripTasks: true }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workOrder.id)
        .eq("organization_id", activeOrg.organizationId)
      if (rlErr) throw new Error(rlErr.message)
      toast({ title: "Tasks saved" })
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Tasks failed",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  function revertTasksPage() {
    setTabTasks(cloneTasks(savedTasks))
  }

  async function saveTasksPage() {
    if (!editable || !activeOrg.organizationId) return
    const normalized = tabTasks
      .filter((t) => t.label.trim())
      .map((t) => ({
        ...t,
        label: t.label.trim(),
        description: t.description?.trim() || undefined,
      }))
    if (!online) {
      if (usesTasksTable) {
        toast({
          variant: "destructive",
          title: ONLINE_REQUIRED_LABEL,
          description: "This job uses server-backed tasks — connect to save task changes.",
        })
        return
      }
      setTasksSaving(true)
      try {
        const qr = await queuePageOfflineBundle({ tasks: normalized })
        if (!qr.ok) {
          if (qr.reason === "syncing") {
            toast({
              variant: "destructive",
              title: SYNC_PREP_COPY.workOrderOfflineQueueBlockedSyncingTitle,
              description: SYNC_PREP_COPY.workOrderOfflineQueueBlockedSyncingBody,
            })
          } else if (qr.reason === "conflict") {
            toast({
              variant: "destructive",
              title: SYNC_PREP_COPY.workOrderOfflineQueueBlockedConflictTitle,
              description: SYNC_PREP_COPY.workOrderOfflineQueueBlockedConflictBody,
            })
          } else {
            toast({
              variant: "destructive",
              title: "Could not save locally",
              description: "Try again when signed in and this job is loaded.",
            })
          }
          return
        }
        setSavedTasks(cloneTasks(normalized))
        toast({
          title: SYNC_PREP_COPY.workOrderFullPageTechnicianSavedLocalTitle,
          description: SYNC_PREP_COPY.workOrderFullPageTechnicianSavedLocalBody,
        })
      } finally {
        setTasksSaving(false)
      }
      return
    }
    setTasksSaving(true)
    try {
      await persistTasksFromTabs(normalized)
    } finally {
      setTasksSaving(false)
    }
  }

  async function persistPartsFromTabs(next: Part[]) {
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Parts and materials require a connection to save.",
      })
      return
    }
    if (!editable || !activeOrg.organizationId) return
    const supabase = createBrowserSupabaseClient()
    try {
      await replaceWorkOrderLineItems(supabase, activeOrg.organizationId, workOrder.id, next)
      const { error: rlErr } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist(workOrder.repairLog, { stripParts: true }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workOrder.id)
        .eq("organization_id", activeOrg.organizationId)
      if (rlErr) throw new Error(rlErr.message)
      toast({ title: "Parts saved" })
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Parts failed",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  function schedulePersistParts(next: Part[]) {
    setParts(next)
    if (partsPersistTimer.current) clearTimeout(partsPersistTimer.current)
    partsPersistTimer.current = null
    if (!online) return
    partsPersistTimer.current = setTimeout(() => {
      void persistPartsFromTabs(next)
      partsPersistTimer.current = null
    }, 650)
  }

  async function handleRemovePendingOfflinePhoto(localId: string) {
    if (!activeOrg.organizationId || !pageUserId) return
    if (!window.confirm("Remove this photo from the offline queue? It will be deleted from this device.")) return
    await removeWorkOrderOfflineQueuedPhoto({
      organizationId: activeOrg.organizationId,
      userId: pageUserId,
      workOrder,
      dbNotes: serverInternalNotes,
      localId,
    })
    toast({ title: "Removed from queue" })
    await refreshPageOfflineDigest()
  }

  async function handleAttachmentUpload(files: FileList) {
    if (!activeOrg.organizationId || workOrder.isArchived) return
    const list = Array.from(files)
    if (list.length === 0) return

    if (!online) {
      if (!pageUserId) {
        toast({
          variant: "destructive",
          title: "Not signed in",
          description: "Sign in to save photos offline.",
        })
        return
      }
      const images = list.filter((f) => isWorkOrderPhotoCategoryMime(f.type))
      const nonImages = list.filter((f) => !isWorkOrderPhotoCategoryMime(f.type))
      if (nonImages.length > 0) {
        toast({
          variant: "destructive",
          title: ONLINE_REQUIRED_LABEL,
          description:
            nonImages.length === list.length
              ? "Documents and PDFs need a connection. You can queue photos (JPEG, PNG, WebP, GIF) offline."
              : `${nonImages.length} non-image file(s) skipped — only photos can be queued offline.`,
        })
      }
      if (images.length === 0) return
      const r = await appendWorkOrderOfflinePhotoQueue({
        organizationId: activeOrg.organizationId,
        userId: pageUserId,
        workOrder,
        dbNotes: serverInternalNotes,
        files: images,
      })
      if (!r.ok) {
        toast({ variant: "destructive", title: "Could not queue photos", description: r.message })
        return
      }
      toast({
        title: "Photos saved on device",
        description:
          r.count === 1
            ? "Tap Sync now when online to upload to the work order."
            : `${r.count} photos queued — use Sync when you have signal.`,
      })
      await refreshPageOfflineDigest()
      return
    }

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
        await uploadWorkOrderAttachment(supabase, activeOrg.organizationId, workOrder.id, file)
        setAttachmentUploadProgress(Math.round(((i + 1) / list.length) * 100))
      }
      toast({
        title: "Upload complete",
        description: list.length === 1 ? list[0].name : `${list.length} files uploaded`,
      })
      await reload()
    } catch (e) {
      toast({
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
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Removing attachments requires a connection.",
      })
      return
    }
    if (!editable || !activeOrg.organizationId) return
    if (
      !window.confirm(
        "Delete this attachment? It will be removed from storage. This cannot be undone.",
      )
    ) {
      return
    }
    const supabase = createBrowserSupabaseClient()
    try {
      await deleteWorkOrderAttachment(supabase, activeOrg.organizationId, attachmentId)
      toast({ title: "Attachment removed" })
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Remove failed",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleRemoveLegacyPhoto(fullIndex: number) {
    if (!online) {
      toast({
        variant: "destructive",
        title: ONLINE_REQUIRED_LABEL,
        description: "Removing photos requires a connection.",
      })
      return
    }
    if (!editable || !activeOrg.organizationId) return
    if (!window.confirm("Remove this photo from the work order?")) return
    const at = legacyRepairPhotoIndex(photoGallery, fullIndex)
    if (at === null) return
    const nextLegacy = workOrder.repairLog.photos.filter((_, k) => k !== at)
    const supabase = createBrowserSupabaseClient()
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          repair_log: repairLogJsonForPersist({ ...workOrder.repairLog, photos: nextLegacy }, {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workOrder.id)
        .eq("organization_id", activeOrg.organizationId)
      if (error) throw new Error(error.message)
      toast({ title: "Photo removed" })
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Remove failed",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const quoteHref = `/quotes?action=new-quote&customerId=${encodeURIComponent(workOrder.customerId)}&equipmentId=${encodeURIComponent(workOrder.equipmentId)}`

  const closeCertificateGate = certificateGateForCompletionAllAssets({
    calibrationTemplateId: workOrder.calibrationTemplateId,
    slots: completionCertSlots,
  })

  const certComplete = !workOrder.calibrationTemplateId || closeCertificateGate.ok

  const workflowHints = {
    certificateAssigned: Boolean(workOrder.calibrationTemplateId),
    certificateComplete: certComplete,
    signatureCaptured: customerSignatureCaptured(workOrder),
  }

  const showPostComplete =
    workOrder.status === "Completed" || workOrder.status === "Completed Pending Signature"

  const postCompletionActions = showPostComplete ? (
    <div className="flex flex-wrap gap-2 items-center">
      {workOrder.calibrationTemplateId ?
        <p className="text-[11px] text-muted-foreground max-w-md">
          Print, PDF, and HTML certificate actions are on the Certificates tab for each equipment asset.
        </p>
      : null}
      {!customerSignatureCaptured(workOrder) ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() =>
            document.getElementById("customer-signature-section")?.scrollIntoView({ behavior: "smooth" })
          }
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
    <div className="flex flex-col gap-4 max-w-5xl mx-auto max-lg:pb-[min(40vh,14rem)]">
      <div className="flex flex-wrap items-center gap-2 justify-between max-lg:flex-col max-lg:items-stretch">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/work-orders">
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 touch-manipulation lg:h-8 lg:w-8">
              <ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" />
            </Button>
          </Link>
          {savedBanner === "server" ? (
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border border-[color:var(--status-success)]/20 rounded-md px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All changes saved
            </div>
          ) : null}
          {savedBanner === "local" ? (
            <div className="flex items-start gap-1.5 text-xs text-sky-900 dark:text-sky-100 bg-sky-500/10 border border-sky-500/25 rounded-md px-3 py-1.5 max-w-md">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="font-medium block">{SYNC_PREP_COPY.workOrderFullPageTechnicianSavedLocalTitle}</span>
                {fullPageOfflineSaveContext.unsafeDirty ? (
                  <span className="block text-[11px] text-sky-950/80 dark:text-sky-50/85 mt-1 leading-snug">
                    {SYNC_PREP_COPY.workOrderFullPageOfflineUnsafeEditingNote}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
          {!editing ? (
            <>
              {nextStatus[workOrder.status] && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-full touch-manipulation sm:min-h-9 sm:w-auto"
                  title={(() => {
                    const nextSt = nextStatus[workOrder.status]!
                    if (
                      !online &&
                      nextSt === "In Progress" &&
                      (workOrder.status === "Open" || workOrder.status === "Scheduled")
                    ) {
                      return undefined
                    }
                    return SYNC_PREP_COPY.statusChangeRequiresNetwork
                  })()}
                  onClick={() => void handleStatusAdvance(nextStatus[workOrder.status]!)}
                >
                  Move to {nextStatus[workOrder.status]}
                </Button>
              )}
              {["Open", "Scheduled", "In Progress"].includes(workOrder.status) && (
                <Button
                  size="sm"
                  className="min-h-11 w-full touch-manipulation sm:min-h-9 sm:w-auto"
                  onClick={() => setEditing(true)}
                >
                  <PenLine className="w-3.5 h-3.5 mr-1.5" />
                  Edit repair log
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 w-full touch-manipulation sm:min-h-9 sm:w-auto"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="min-h-11 w-full touch-manipulation sm:min-h-9 sm:w-auto"
                title={
                  !online
                    ? SYNC_PREP_COPY.workOrderFullPageOfflineSaveButtonTooltip
                    : SYNC_PREP_COPY.saveRequiresNetwork
                }
                onClick={() => void handleSave()}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save changes
              </Button>
            </>
          )}
        </div>
      </div>

      <WorkOrderSyncPrepBanner
        networkOnline={online}
        hasPendingOffline={pageOfflineDigest.pending}
        offlineStatus={
          pageOfflineDigest.status === "conflict" ||
          pageOfflineDigest.status === "failed" ||
          pageOfflineDigest.status === "syncing"
            ? pageOfflineDigest.status
            : null
        }
      />

      {activeOrg.organizationId && pageUserId ? (
        <WorkOrderOfflineSyncBar
          organizationId={activeOrg.organizationId}
          userId={pageUserId}
          workOrderId={workOrder.id}
          workOrder={workOrder}
          usesTasksTable={usesTasksTable}
          usesPartsLineItems={usesPartsLineItems}
          canEdit={woCanEdit}
          onAfterChange={() => void reload()}
          onConflict={() => void openPageOfflineConflictReview()}
        />
      ) : null}

      <WorkOrderOfflineConflictDialog
        open={pageConflictOpen}
        onOpenChange={setPageConflictOpen}
        organizationId={activeOrg.organizationId}
        workOrderId={workOrder.id}
        record={pageConflictRecord}
        onDiscardLocal={() => discardPageOfflineDraft()}
      />

      {(!online || pageOfflineDigest.pending) && woCanEdit ? (
        <p
          role="note"
          className="text-[11px] text-muted-foreground leading-snug border border-border/80 rounded-lg bg-muted/20 px-3 py-2"
        >
          {SYNC_PREP_COPY.workOrderFullPageOfflineHint}
        </p>
      ) : null}

      {!online && editing && fullPageOfflineSaveContext.unsafeDirty ? (
        <p
          role="status"
          className="text-[11px] text-amber-950 dark:text-amber-100 leading-snug border border-amber-500/35 rounded-lg bg-amber-500/10 px-3 py-2"
        >
          {SYNC_PREP_COPY.workOrderFullPageOfflineUnsafeEditingNote}
        </p>
      ) : null}

      <WorkOrderDetailExperience
        tabsValue={pageWoTab}
        onTabsValueChange={setPageWoTab}
        overviewLeadSlot={
          <>
            {activeOrg.organizationId ?
              <AidenProductivitySection
                organizationId={activeOrg.organizationId}
                mode="work_order"
                workOrderId={workOrder.id}
              />
            : null}
            {linkedInvoices.length > 0 ? (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 dark:bg-muted/15 px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Linked invoices
                  </p>
                  <span className="text-[10px] text-muted-foreground">{linkedInvoices.length} linked</span>
                </div>
                <ul className="divide-y divide-border/70">
                  {linkedInvoices.map((inv) => (
                    <li key={inv.id}>
                      <Link
                        href={`/invoices?open=${encodeURIComponent(inv.id)}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
                      >
                        <span className="font-medium text-foreground">
                          {inv.invoiceNumber?.trim() ? inv.invoiceNumber : "Invoice"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums text-right">
                          {fmtUsd(inv.amount)} · {inv.status}
                          {inv.dueDate ? ` · Due ${fmtShortDate(inv.dueDate)}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ServiceLifecycleTimeline title="Service timeline" events={woTimelineEvents} />
          </>
        }
        overviewFooterSlot={
          activeOrg.status === "ready" && activeOrg.organizationId && woCanEdit ?
            <WorkOrderAiTechnicianAssistPanel
              organizationId={activeOrg.organizationId}
              workOrderId={workOrder.id}
              workOrderArchived={Boolean(workOrder.isArchived)}
              canEdit={woCanEdit}
            />
          : null
        }
        workOrder={workOrder}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        internalNotesEditable={editable}
        planServices={planServices}
        activityItems={buildWorkOrderActivityItems(workOrder)}
        partsTabLeadSlot={
          activeOrg.organizationId ?
            <>
              {activeOrg.status === "ready" && woCanEdit ?
                <WorkOrderAiPartsSuggestionsPanel
                  organizationId={activeOrg.organizationId}
                  workOrderId={workOrder.id}
                  workOrderArchived={Boolean(workOrder.isArchived)}
                  canEdit={woCanEdit}
                />
              : null}
              <WorkOrderTruckConsumeCard
                organizationId={activeOrg.organizationId}
                workOrderId={workOrder.id}
              />
            </>
          : null
        }
        problemReported={problemReported}
        onProblemReportedChange={setProblemReported}
        diagnosis={diagnosis}
        onDiagnosisChange={setDiagnosis}
        technicianNotes={techNotes}
        onTechnicianNotesChange={setTechNotes}
        parts={parts}
        onPartsChange={(p) => schedulePersistParts(p)}
        laborHours={laborHours}
        onLaborHoursChange={setLaborHours}
        laborRatePerHour={LABOR_RATE}
        photos={photoGallery.map((g) => g.url)}
        onPhotosChange={() => {}}
        photoAttachmentIds={photoGallery.map((g) => g.attachmentId)}
        documentAttachments={documentAttachments}
        onAttachmentUpload={(files) => void handleAttachmentUpload(files)}
        onRemoveAttachmentPhoto={(aid) => void handleRemoveAttachmentPhoto(aid)}
        onRemoveLegacyPhoto={(i) => void handleRemoveLegacyPhoto(i)}
        onRemoveDocument={(aid) => void handleRemoveAttachmentPhoto(aid)}
        attachmentUploading={attachmentUploading}
        attachmentUploadProgress={attachmentUploadProgress}
        attachmentUploadStatusLabel={attachmentUploadLabel}
        pendingOfflinePhotos={pendingOfflinePhotoPreviews}
        onRemovePendingOfflinePhoto={(id) => void handleRemovePendingOfflinePhoto(id)}
        attachmentsOfflineExplainer={
          !online && woCanEdit ? SYNC_PREP_COPY.workOrderOfflinePhotoQueueHint : null
        }
        tasks={tabTasks}
        onTasksChange={setTabTasks}
        tasksTabToolbar={
          editable && tasksDirty ? (
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
                  onClick={revertTasksPage}
                  disabled={tasksSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void saveTasksPage()}
                  disabled={tasksSaving}
                >
                  {tasksSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          ) : null
        }
        notesTabFooterSlot={
          activeOrg.status === "ready" && activeOrg.organizationId && woCanEdit ?
            <WorkOrderAiServiceSummaryPanel
              organizationId={activeOrg.organizationId}
              workOrderId={workOrder.id}
              workOrderArchived={Boolean(workOrder.isArchived)}
              canEdit={woCanEdit}
              savedInternal={workOrder.repairLog.internalServiceSummary}
              savedCustomer={workOrder.repairLog.customerServiceSummary}
              onPersistSummaries={async (patch) => {
                if (!activeOrg.organizationId || workOrder.isArchived || !woCanEdit) return false
                if (!online) {
                  toast({
                    variant: "destructive",
                    title: ONLINE_REQUIRED_LABEL,
                    description: "AI-generated summaries require a connection to save.",
                  })
                  return false
                }
                const merged: RepairLog = { ...workOrder.repairLog, ...patch }
                return persistUpdate({
                  repair_log: repairLogJsonForPersist(merged, {
                    stripTasks: usesTasksTable,
                    stripParts: usesPartsLineItems,
                  }),
                  updated_at: new Date().toISOString(),
                })
              }}
            />
          : null
        }
        equipmentAssets={equipmentAssets}
        onNavigateToCertificateForEquipment={(eqId) => {
          setPageWoTab("certificates")
          setPageCertificateFocusEqId(eqId)
        }}
        certificateTabContent={
          <CertificateMultiTabContent
            organizationId={activeOrg.organizationId}
            workOrder={workOrder}
            equipmentAssets={equipmentAssets}
            onCompletionSlotsChange={setCompletionCertSlots}
            focusEquipmentId={pageCertificateFocusEqId}
            onFocusEquipmentApplied={() => setPageCertificateFocusEqId(null)}
          />
        }
        sigData={sigData}
        signedBy={signedBy}
        signedAt={signedAt}
        customerSignaturePreviewUrl={workOrder.customerSignaturePreviewUrl}
        customerSignatureCapturedAt={workOrder.customerSignatureCapturedAt}
        onCustomerSignatureSave={(blob, name) => handleCustomerSignatureSave(blob, name)}
        signatureCaptureEnabled={
          editable ||
          workOrder.status === "Completed" ||
          workOrder.status === "Completed Pending Signature"
        }
        fieldsEditable={editable}
        partsPhotosEditable={editable}
        tasksEditable={editable}
        onEditWorkOrder={() => setEditing(true)}
        onAssignTechnician={() =>
          router.push(`/work-orders?workOrderId=${encodeURIComponent(workOrder.id)}`)
        }
        onMarkComplete={handleMarkComplete}
        quoteHref={quoteHref}
        workflowHints={workflowHints}
        postCompletionActions={postCompletionActions}
        onInvoicePlaceholder={() =>
          handleCreateInvoiceAction()
        }
      />

      {!editing && !workOrder.isArchived ? (
        <TechnicianMobileQuickBar
          fixedAboveMobileNav
          phone={primaryPhone}
          navigateQuery={navigateQuery}
          showComplete={["Open", "Scheduled", "In Progress"].includes(workOrder.status)}
          onComplete={() => void handleMarkComplete()}
          onPhotoFiles={(files) => void handleAttachmentUpload(files)}
          onSignature={() => mobileJumpToSection("overview", "customer-signature-section")}
          onTechnicianNotes={() => mobileJumpToSection("notes", "technician-notes-section")}
          onTasks={() => mobileJumpToSection("tasks")}
          onParts={() => mobileJumpToSection("parts")}
          onCertificates={() => setPageWoTab("certificates")}
          showCertificatesShortcut={
            Boolean(workOrder.calibrationTemplateId) || equipmentAssets.length > 0
          }
        />
      ) : null}

      {editing && (
        <div className={cn("flex justify-end gap-2 pb-8 border-t border-border pt-4")}>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            title={
              !online
                ? SYNC_PREP_COPY.workOrderFullPageOfflineSaveButtonTooltip
                : SYNC_PREP_COPY.saveRequiresNetwork
            }
            onClick={() => void handleSave()}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save repair log
          </Button>
        </div>
      )}

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
    </div>
  )
}
