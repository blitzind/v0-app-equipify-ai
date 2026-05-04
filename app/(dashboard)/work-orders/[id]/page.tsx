"use client"

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import {
  loadWorkOrderDetailForOrg,
  type WorkOrderDocumentItem,
  type WorkOrderPhotoGalleryItem,
} from "@/lib/work-orders/detail-load"
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
  defaultValueForField,
  listCalibrationTemplates,
  loadLatestCalibrationRecord,
  type CalibrationTemplate,
} from "@/lib/calibration-certificates"
import { cloneTasks, tasksEqual, type TaskDraft } from "@/lib/work-orders/tasks-snapshot"
import { useWorkOrders } from "@/lib/work-order-store"
import type { Part, RepairLog, WorkOrder, WorkOrderStatus } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronLeft, CheckCircle2, PenLine, Save, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  WorkOrderDetailExperience,
  buildWorkOrderActivityItems,
} from "@/components/work-orders/work-order-detail-experience"
import { useToast } from "@/hooks/use-toast"
import { CertificateTabContent } from "@/components/work-orders/certificate-tab-content"

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

const LABOR_RATE = 95

const nextStatus: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  Open: "Scheduled",
  Scheduled: "In Progress",
  "In Progress": "Completed",
  Completed: "Invoiced",
}

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const activeOrg = useActiveOrganization()
  const { getById, updateStatus, updateRepairLog, updateWorkOrder } = useWorkOrders()

  const storeWo = getById(id)
  const [dbWo, setDbWo] = useState<WorkOrder | null | undefined>(undefined)
  const [internalNotes, setInternalNotes] = useState("")
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

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
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
  const [certificateTemplates, setCertificateTemplates] = useState<CalibrationTemplate[]>([])
  const [certificateTemplateId, setCertificateTemplateId] = useState("")
  const [certificateValues, setCertificateValues] = useState<Record<string, unknown>>({})
  const [certificateSavedAt, setCertificateSavedAt] = useState<string | null>(null)
  const [certificateSaveBusy, setCertificateSaveBusy] = useState(false)

  const reload = useCallback(async () => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDbWo(null)
      return
    }
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setDbWo(null)
      return
    }
    const orgId = activeOrg.organizationId
    const res = await loadWorkOrderDetailForOrg(supabase, orgId, id)
    if (!res.ok) {
      setDbWo(null)
      if (!res.notFound) setDbLoadFailed(true)
      return
    }
    setDbLoadFailed(false)
    setDbWo(res.data.workOrder)
    setInternalNotes(res.data.notes)
    setPlanServices(res.data.planServices)
    setPhotoGallery(res.data.photoGallery)
    setDocumentAttachments(res.data.documentAttachments)
    setUsesPartsLineItems(res.data.usesPartsLineItems)
    setUsesTasksTable(res.data.usesTasksTable)
    const ts = cloneTasks(res.data.workOrder.repairLog.tasks ?? [])
    setTabTasks(ts)
    setSavedTasks(ts)
  }, [id, activeOrg.status, activeOrg.organizationId])

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
  const resolved = dbWo !== undefined || Boolean(storeWo)
  const loading = !resolved

  useEffect(() => {
    if (!wo) return
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
  }, [wo?.id])

  const seedCertificateValues = useCallback(
    (template: CalibrationTemplate | null, existing: Record<string, unknown> | null) => {
      if (!template) return {}
      const out: Record<string, unknown> = {}
      for (const field of template.fields) {
        if (field.type === "section_heading") continue
        out[field.id] = defaultValueForField(field.type)
      }
      if (existing) {
        for (const [k, v] of Object.entries(existing)) out[k] = v
      }
      return out
    },
    [],
  )

  useEffect(() => {
    if (!wo || activeOrg.status !== "ready" || !activeOrg.organizationId) return
    let cancelled = false
    const orgId = activeOrg.organizationId
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      try {
        const [templates, latestRecord] = await Promise.all([
          listCalibrationTemplates(supabase, orgId),
          loadLatestCalibrationRecord(supabase, orgId, wo.id),
        ])
        if (cancelled) return
        setCertificateTemplates(templates)
        const selectedId =
          latestRecord?.templateId ??
          wo.calibrationTemplateId ??
          (wo.equipmentCategory
            ? templates.find((t) => t.equipmentCategoryId === wo.equipmentCategory)?.id
            : null) ??
          templates[0]?.id ??
          ""
        setCertificateTemplateId(selectedId)
        const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null
        setCertificateValues(seedCertificateValues(selectedTemplate, latestRecord?.values ?? null))
        setCertificateSavedAt(latestRecord?.createdAt ?? null)
      } catch {
        if (cancelled) return
        setCertificateTemplates([])
        setCertificateTemplateId("")
        setCertificateValues({})
        setCertificateSavedAt(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [wo, activeOrg.status, activeOrg.organizationId, seedCertificateValues])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Loading work order…</p>
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          {dbLoadFailed ? "Could not load this work order." : "Work order not found."}
        </p>
        <Link href="/work-orders">
          <Button variant="outline">Back to Work Orders</Button>
        </Link>
      </div>
    )
  }

  const workOrder = wo
  const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)
  const laborCost = laborHours * LABOR_RATE
  const editable = editing && ["Open", "Scheduled", "In Progress"].includes(workOrder.status)

  const tasksDirty = useMemo(() => !tasksEqual(tabTasks, savedTasks), [tabTasks, savedTasks])

  async function persistUpdate(payload: Record<string, unknown>) {
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
    const payload: Record<string, unknown> = {
      problem_reported: problemReported.trim() || null,
      repair_log: repairLogJsonForPersist(
        {
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
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleStatusAdvance(next: WorkOrderStatus) {
    const payload: Record<string, unknown> = { status: uiStatusToDb(next) }
    if (next === "Completed") {
      payload.completed_at = new Date().toISOString()
    }
    const ok = await persistUpdate(payload)
    if (!ok) return
    updateStatus(workOrder.id, next)
  }

  async function handleMarkComplete() {
    await handleStatusAdvance("Completed")
  }

  async function applyInvoiceBillingChoice(choice: "customer" | "vendor" | "hold") {
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
    window.location.href = "/invoices?action=new-invoice"
  }

  function handleCreateInvoiceAction() {
    if (workOrder.warrantyReviewRequired) {
      setBillingVendorId(workOrder.warrantyVendorId ?? "")
      setBillingDecisionOpen(true)
      return
    }
    window.location.href = "/invoices?action=new-invoice"
  }

  async function handleCustomerSignatureSave(blob: Blob, name: string) {
    if (!editable || !activeOrg.organizationId) return
    const supabase = createBrowserSupabaseClient()
    const repairLogPayload: RepairLog = {
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
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save signature",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleCertificateTemplateChange(templateId: string) {
    if (!activeOrg.organizationId) return
    const supabase = createBrowserSupabaseClient()
    try {
      await assignTemplateToWorkOrder(supabase, activeOrg.organizationId, workOrder.id, templateId || null)
      setCertificateTemplateId(templateId)
      const selected = certificateTemplates.find((t) => t.id === templateId) ?? null
      setCertificateValues(seedCertificateValues(selected, null))
      setCertificateSavedAt(null)
      toast({ title: "Certificate template assigned" })
      await reload()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Template update failed",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleSaveCertificateRecord() {
    if (!activeOrg.organizationId || !certificateTemplateId) return
    const supabase = createBrowserSupabaseClient()
    setCertificateSaveBusy(true)
    try {
      const record = await createCalibrationRecord(
        supabase,
        activeOrg.organizationId,
        workOrder.id,
        certificateTemplateId,
        certificateValues,
      )
      setCertificateSavedAt(record.createdAt)
      toast({ title: "Certificate record saved" })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Certificate save failed",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCertificateSaveBusy(false)
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
    setTasksSaving(true)
    try {
      await persistTasksFromTabs(normalized)
    } finally {
      setTasksSaving(false)
    }
  }

  async function persistPartsFromTabs(next: Part[]) {
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
    partsPersistTimer.current = setTimeout(() => {
      void persistPartsFromTabs(next)
      partsPersistTimer.current = null
    }, 650)
  }

  async function handleAttachmentUpload(files: FileList) {
    if (!editable || !activeOrg.organizationId) return
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

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/work-orders">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border border-[color:var(--status-success)]/20 rounded-md px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All changes saved
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <>
              {nextStatus[workOrder.status] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleStatusAdvance(nextStatus[workOrder.status]!)}
                >
                  Move to {nextStatus[workOrder.status]}
                </Button>
              )}
              {["Open", "Scheduled", "In Progress"].includes(workOrder.status) && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  <PenLine className="w-3.5 h-3.5 mr-1.5" />
                  Edit repair log
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSave()}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save changes
              </Button>
            </>
          )}
        </div>
      </div>

      <WorkOrderDetailExperience
        workOrder={workOrder}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        internalNotesEditable={editable}
        planServices={planServices}
        activityItems={buildWorkOrderActivityItems(workOrder)}
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
        certificateTabContent={
          <CertificateTabContent
            templates={certificateTemplates}
            selectedTemplateId={certificateTemplateId}
            onTemplateChange={(templateId) => void handleCertificateTemplateChange(templateId)}
            values={certificateValues}
            onValueChange={(fieldId, value) =>
              setCertificateValues((prev) => ({ ...prev, [fieldId]: value }))
            }
            onSave={() => void handleSaveCertificateRecord()}
            saveBusy={certificateSaveBusy}
            lastSavedAt={certificateSavedAt}
            companyName="Equipify Service Co."
            workOrderLabel={getWorkOrderDisplay(workOrder)}
            customerName={workOrder.customerName}
            equipmentName={workOrder.equipmentName}
            manageTemplatesHref="/calibration-templates"
          />
        }
        sigData={sigData}
        signedBy={signedBy}
        signedAt={signedAt}
        customerSignaturePreviewUrl={workOrder.customerSignaturePreviewUrl}
        customerSignatureCapturedAt={workOrder.customerSignatureCapturedAt}
        onCustomerSignatureSave={(blob, name) => handleCustomerSignatureSave(blob, name)}
        signatureCaptureEnabled={editable}
        fieldsEditable={editable}
        partsPhotosEditable={editable}
        tasksEditable={editable}
        onEditWorkOrder={() => setEditing(true)}
        onAssignTechnician={() => router.push(`/work-orders?open=${encodeURIComponent(workOrder.id)}`)}
        onMarkComplete={handleMarkComplete}
        quoteHref={quoteHref}
        onInvoicePlaceholder={() =>
          handleCreateInvoiceAction()
        }
        leading={
          <p className="text-[10px] text-muted-foreground font-mono">
            {getWorkOrderDisplay(workOrder)}
          </p>
        }
      />

      {editing && (
        <div className={cn("flex justify-end gap-2 pb-8 border-t border-border pt-4")}>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()}>
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
