"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, ClipboardList, Copy, ExternalLink } from "lucide-react"
import { PreparedActionAuditTrail } from "@/components/aiden/prepared-actions/PreparedActionAuditTrail"
import { PreparedActionConfirmDialog } from "@/components/aiden/prepared-actions/PreparedActionConfirmDialog"
import { BulkPreparedInvoicePreview } from "@/components/aiden/prepared-actions/BulkPreparedInvoicePreview"
import { PreparedActionStatusBadge } from "@/components/aiden/prepared-actions/PreparedActionStatusBadge"
import { PreparedInvoicePreview } from "@/components/aiden/prepared-actions/PreparedInvoicePreview"
import {
  PreparedPaymentLinkCompleted,
  PreparedPaymentLinkPreview,
} from "@/components/aiden/prepared-actions/PreparedPaymentLinkPreview"
import { PreparedQuickBooksInvoiceSyncPreview } from "@/components/aiden/prepared-actions/PreparedQuickBooksInvoiceSyncPreview"
import {
  humanizePreparedActionId,
  parseCreateFollowUpTaskPreviewFromPayload,
  parseCreateMaintenancePlanFromEquipmentPreviewFromPayload,
  parseCreatePartsReorderRequestPreviewFromPayload,
  parseDraftCustomerMessagePreviewFromPayload,
  parseInvoicePreviewFromPayload,
  parsePaymentLinkPreviewFromPayload,
  parsePrepareQuickBooksInvoiceSyncPreviewFromPayload,
  parseQuoteFromWorkOrderPreviewFromPayload,
  parseScheduleMaintenanceVisitPreviewFromPayload,
  parseSummarizeCustomerHistoryPreviewFromPayload,
  parseBulkInvoiceCompletedWorkOrdersPreviewFromPayload,
  type BulkInvoiceCompletedWorkOrdersPreview,
  type CreateFollowUpTaskPreviewPayload,
  type CreateMaintenancePlanFromEquipmentPreviewPayload,
  type CreatePartsReorderPreviewPayload,
  type DraftCustomerMessagePreviewPayload,
  type InvoicePreviewPayload,
  type SerializedPreparedAction,
  type PreparedActionApprovalApi,
  type ScheduleMaintenanceVisitPreviewPayload,
  type SummarizeCustomerHistoryPreviewPayload,
} from "@/components/aiden/prepared-actions/types"
import { recalcInvoicePreviewTotals } from "@/components/aiden/prepared-actions/invoice-preview-recalc"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { UUID_RE } from "@/lib/aiden/prepared-actions/prepared-actions-shared"
import { AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE } from "@/lib/aiden/actions/bulk-invoice-confirmation"

export function PreparedActionCard({
  organizationId,
  preparedAction,
  onPreparedActionUpdated,
  onEditBeforeCreating,
  onPrefillChat,
  onDismiss,
  className,
}: {
  organizationId: string
  preparedAction: SerializedPreparedAction
  onPreparedActionUpdated: (next: SerializedPreparedAction) => void
  /** Open Invoices with manual control (e.g. new invoice from work order). */
  onEditBeforeCreating?: (ctx: { workOrderId?: string; customerId?: string }) => void
  /** Prefill AIden chat input (e.g. draft message shortcut from read-only summaries). */
  onPrefillChat?: (text: string) => void
  /** Clear panel state after a terminal outcome so the user can prepare again. */
  onDismiss?: () => void
  className?: string
}) {
  const { toast } = useToast()
  const [mutationBusy, setMutationBusy] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [approval, setApproval] = useState<PreparedActionApprovalApi | null>(null)
  const [approvalLoading, setApprovalLoading] = useState(true)
  const [draftInvoicePreview, setDraftInvoicePreview] = useState<InvoicePreviewPayload | null>(null)
  const [draftMessageEdit, setDraftMessageEdit] = useState<DraftCustomerMessagePreviewPayload | null>(null)
  const [followUpTaskEdit, setFollowUpTaskEdit] = useState<CreateFollowUpTaskPreviewPayload | null>(null)
  const [scheduleVisitEdit, setScheduleVisitEdit] = useState<ScheduleMaintenanceVisitPreviewPayload | null>(null)
  const [maintenancePlanEdit, setMaintenancePlanEdit] =
    useState<CreateMaintenancePlanFromEquipmentPreviewPayload | null>(null)
  const [partsReorderEdit, setPartsReorderEdit] = useState<CreatePartsReorderPreviewPayload | null>(null)
  const [bulkExcludedIds, setBulkExcludedIds] = useState<Set<string>>(new Set())

  const supportsDraftInvoiceUi = preparedAction.actionId === "create_invoice_from_work_order"
  const supportsQuoteFromWoUi = preparedAction.actionId === "create_quote_from_work_order"
  const supportsFinancialLinePreview = supportsDraftInvoiceUi || supportsQuoteFromWoUi
  const supportsPaymentLinkUi = preparedAction.actionId === "prepare_invoice_payment_link"
  const supportsDraftMessageUi = preparedAction.actionId === "draft_customer_message"
  const supportsQbSyncUi = preparedAction.actionId === "prepare_quickbooks_invoice_sync"
  const supportsCustomerSummaryUi = preparedAction.actionId === "summarize_customer_history"
  const supportsFollowUpTaskUi = preparedAction.actionId === "create_follow_up_task"
  const supportsScheduleMaintenanceVisitUi = preparedAction.actionId === "schedule_maintenance_visit"
  const supportsCreateMaintenancePlanFromEquipmentUi =
    preparedAction.actionId === "create_maintenance_plan_from_equipment"
  const supportsCreatePartsReorderRequestUi = preparedAction.actionId === "create_parts_reorder_request"
  const supportsBulkInvoiceUi = preparedAction.actionId === "bulk_invoice_completed_work_orders"

  const financialServerPreview = useMemo((): InvoicePreviewPayload | null => {
    if (supportsDraftInvoiceUi) return parseInvoicePreviewFromPayload(preparedAction.previewPayload)
    if (supportsQuoteFromWoUi) return parseQuoteFromWorkOrderPreviewFromPayload(preparedAction.previewPayload)
    return null
  }, [preparedAction.previewPayload, supportsDraftInvoiceUi, supportsQuoteFromWoUi])

  useEffect(() => {
    if (!supportsFinancialLinePreview || !financialServerPreview) {
      setDraftInvoicePreview(null)
      return
    }
    setDraftInvoicePreview(recalcInvoicePreviewTotals(structuredClone(financialServerPreview)))
  }, [financialServerPreview, supportsFinancialLinePreview])

  const serverDraftMessage = useMemo(
    () =>
      supportsDraftMessageUi ? parseDraftCustomerMessagePreviewFromPayload(preparedAction.previewPayload) : null,
    [preparedAction.previewPayload, supportsDraftMessageUi],
  )

  useEffect(() => {
    if (!serverDraftMessage) {
      setDraftMessageEdit(null)
      return
    }
    setDraftMessageEdit(structuredClone(serverDraftMessage))
  }, [serverDraftMessage])

  const previewDirty = useMemo(() => {
    if (!draftInvoicePreview || !financialServerPreview) return false
    return (
      JSON.stringify({
        lines: draftInvoicePreview.lineItems ?? [],
        notes: draftInvoicePreview.notes ?? "",
      }) !==
      JSON.stringify({
        lines: financialServerPreview.lineItems ?? [],
        notes: financialServerPreview.notes ?? "",
      })
    )
  }, [draftInvoicePreview, financialServerPreview])

  const messagePreviewDirty = useMemo(() => {
    if (!draftMessageEdit || !serverDraftMessage) return false
    return (
      draftMessageEdit.subject !== serverDraftMessage.subject || draftMessageEdit.body !== serverDraftMessage.body
    )
  }, [draftMessageEdit, serverDraftMessage])

  const displayDraftMessage = draftMessageEdit ?? serverDraftMessage

  const displayInvoicePreview = draftInvoicePreview ?? financialServerPreview
  const invoicePreview =
    preparedAction.actionId === "create_invoice_from_work_order"
      ? parseInvoicePreviewFromPayload(preparedAction.previewPayload)
      : null
  const quotePreview =
    preparedAction.actionId === "create_quote_from_work_order"
      ? parseQuoteFromWorkOrderPreviewFromPayload(preparedAction.previewPayload)
      : null
  const hasFinancialLinePreview = Boolean(invoicePreview ?? quotePreview)

  const paymentLinkPreview =
    preparedAction.actionId === "prepare_invoice_payment_link"
      ? parsePaymentLinkPreviewFromPayload(preparedAction.previewPayload)
      : null

  const qbSyncPreview = useMemo(
    () =>
      supportsQbSyncUi ? parsePrepareQuickBooksInvoiceSyncPreviewFromPayload(preparedAction.previewPayload) : null,
    [preparedAction.previewPayload, supportsQbSyncUi],
  )

  const customerSummaryPreview = useMemo((): SummarizeCustomerHistoryPreviewPayload | null => {
    if (!supportsCustomerSummaryUi) return null
    return parseSummarizeCustomerHistoryPreviewFromPayload(preparedAction.previewPayload)
  }, [preparedAction.previewPayload, supportsCustomerSummaryUi])

  const serverFollowUpTask = useMemo(
    () => (supportsFollowUpTaskUi ? parseCreateFollowUpTaskPreviewFromPayload(preparedAction.previewPayload) : null),
    [preparedAction.previewPayload, supportsFollowUpTaskUi],
  )

  useEffect(() => {
    if (!serverFollowUpTask) {
      setFollowUpTaskEdit(null)
      return
    }
    setFollowUpTaskEdit(structuredClone(serverFollowUpTask))
  }, [serverFollowUpTask])

  const followUpTaskDirty = useMemo(() => {
    if (!followUpTaskEdit || !serverFollowUpTask) return false
    return (
      followUpTaskEdit.title !== serverFollowUpTask.title ||
      followUpTaskEdit.notes !== serverFollowUpTask.notes ||
      followUpTaskEdit.dueDate !== serverFollowUpTask.dueDate
    )
  }, [followUpTaskEdit, serverFollowUpTask])

  const displayFollowUpTask = followUpTaskEdit ?? serverFollowUpTask

  const serverScheduleVisit = useMemo(
    () =>
      supportsScheduleMaintenanceVisitUi ?
        parseScheduleMaintenanceVisitPreviewFromPayload(preparedAction.previewPayload)
      : null,
    [preparedAction.previewPayload, supportsScheduleMaintenanceVisitUi],
  )

  useEffect(() => {
    if (!serverScheduleVisit) {
      setScheduleVisitEdit(null)
      return
    }
    setScheduleVisitEdit(structuredClone(serverScheduleVisit))
  }, [serverScheduleVisit])

  const scheduleVisitDirty = useMemo(() => {
    if (!scheduleVisitEdit || !serverScheduleVisit) return false
    return (
      scheduleVisitEdit.suggestedDate !== serverScheduleVisit.suggestedDate ||
      scheduleVisitEdit.suggestedTime !== serverScheduleVisit.suggestedTime ||
      scheduleVisitEdit.serviceTypeUi !== serverScheduleVisit.serviceTypeUi ||
      scheduleVisitEdit.priorityUi !== serverScheduleVisit.priorityUi ||
      scheduleVisitEdit.notes !== serverScheduleVisit.notes ||
      scheduleVisitEdit.serviceReason !== serverScheduleVisit.serviceReason
    )
  }, [scheduleVisitEdit, serverScheduleVisit])

  const displayScheduleVisit = scheduleVisitEdit ?? serverScheduleVisit

  const serverMaintenancePlan = useMemo(
    () =>
      supportsCreateMaintenancePlanFromEquipmentUi ?
        parseCreateMaintenancePlanFromEquipmentPreviewFromPayload(preparedAction.previewPayload)
      : null,
    [preparedAction.previewPayload, supportsCreateMaintenancePlanFromEquipmentUi],
  )

  useEffect(() => {
    if (!serverMaintenancePlan) {
      setMaintenancePlanEdit(null)
      return
    }
    setMaintenancePlanEdit(structuredClone(serverMaintenancePlan))
  }, [serverMaintenancePlan])

  const maintenancePlanDirty = useMemo(() => {
    if (!maintenancePlanEdit || !serverMaintenancePlan) return false
    return JSON.stringify(maintenancePlanEdit) !== JSON.stringify(serverMaintenancePlan)
  }, [maintenancePlanEdit, serverMaintenancePlan])

  const displayMaintenancePlan = maintenancePlanEdit ?? serverMaintenancePlan

  const serverPartsReorder = useMemo(
    () =>
      supportsCreatePartsReorderRequestUi ?
        parseCreatePartsReorderRequestPreviewFromPayload(preparedAction.previewPayload)
      : null,
    [preparedAction.previewPayload, supportsCreatePartsReorderRequestUi],
  )

  useEffect(() => {
    if (!serverPartsReorder) {
      setPartsReorderEdit(null)
      return
    }
    setPartsReorderEdit(structuredClone(serverPartsReorder))
  }, [serverPartsReorder])

  const partsReorderDirty = useMemo(() => {
    if (!partsReorderEdit || !serverPartsReorder) return false
    return JSON.stringify(partsReorderEdit) !== JSON.stringify(serverPartsReorder)
  }, [partsReorderEdit, serverPartsReorder])

  const displayPartsReorder = partsReorderEdit ?? serverPartsReorder

  const serverBulkInvoicePreview = useMemo((): BulkInvoiceCompletedWorkOrdersPreview | null => {
    if (!supportsBulkInvoiceUi) return null
    return parseBulkInvoiceCompletedWorkOrdersPreviewFromPayload(preparedAction.previewPayload)
  }, [preparedAction.previewPayload, supportsBulkInvoiceUi])

  useEffect(() => {
    if (!serverBulkInvoicePreview) {
      setBulkExcludedIds(new Set())
      return
    }
    setBulkExcludedIds(new Set(serverBulkInvoicePreview.excludedWorkOrderIds))
  }, [serverBulkInvoicePreview])

  const bulkPreviewDirty = useMemo(() => {
    if (!serverBulkInvoicePreview) return false
    const a = [...serverBulkInvoicePreview.excludedWorkOrderIds].sort().join(",")
    const b = [...bulkExcludedIds].sort().join(",")
    return a !== b
  }, [serverBulkInvoicePreview, bulkExcludedIds])

  const loadApprovalPolicy = useCallback(async () => {
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}`,
      { credentials: "include" },
    )
    const data = (await res.json().catch(() => ({}))) as { approval?: PreparedActionApprovalApi }
    setApproval(data.approval ?? null)
  }, [organizationId, preparedAction.id, preparedAction.updatedAt, preparedAction.previewPayload])

  useEffect(() => {
    let cancelled = false
    setApprovalLoading(true)
    void loadApprovalPolicy()
      .catch(() => {
        if (!cancelled) setApproval(null)
      })
      .finally(() => {
        if (!cancelled) setApprovalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadApprovalPolicy])

  const paymentLinkBlocked = paymentLinkPreview?.readiness === "blocked"
  const qbSyncBlocked = qbSyncPreview?.readiness === "blocked"

  const actionTitle = humanizePreparedActionId(preparedAction.actionId)

  const needsClarification = preparedAction.status === "needs_clarification"
  const failed = preparedAction.status === "failed"
  const completed = preparedAction.status === "completed"
  const canceled = preparedAction.status === "canceled"

  const canAct =
    preparedAction.status === "prepared" ||
    preparedAction.status === "ready_for_confirmation" ||
    preparedAction.status === "confirmed"

  const approvalBlocked = !approvalLoading && approval !== null && !approval.allowed

  const execPayload = preparedAction.executionPayload as {
    invoiceId?: string
    invoiceNumber?: string
    quoteId?: string
    checkoutUrl?: string
    checkoutSessionId?: string
    communicationEventId?: string
    followUpTaskId?: string
    workOrderId?: string
    maintenancePlanId?: string
    purchaseOrderId?: string
    purchaseOrderNumber?: string | null
    restockLedgerIds?: string[]
    quickBooksSync?: { attempted: number; succeeded: number; errors?: Array<{ internalId: string; message: string }> }
    bulk?: boolean
    succeeded?: number
    failed?: number
    skipped?: number
    results?: Array<
      | { workOrderId: string; invoiceId: string; invoiceNumber: string; status: "draft" }
      | { workOrderId: string; skipped: true; reason: string }
      | { workOrderId: string; error: string }
    >
  } | undefined
  const targetInvoiceId = preparedAction.targetRecordId ?? execPayload?.invoiceId
  const targetQuoteId = preparedAction.targetRecordId ?? execPayload?.quoteId
  const checkoutUrlComplete = typeof execPayload?.checkoutUrl === "string" ? execPayload.checkoutUrl.trim() : ""

  const paymentLinkInvoiceLabel = useMemo(() => {
    if (paymentLinkPreview) {
      return `${paymentLinkPreview.invoice.title} #${paymentLinkPreview.invoice.invoiceNumber}`
    }
    const num = execPayload?.invoiceNumber?.trim()
    if (num) return `Invoice #${num}`
    return "Invoice"
  }, [paymentLinkPreview, execPayload?.invoiceNumber])

  const confirmPrimaryLabel = supportsScheduleMaintenanceVisitUi
    ? "Create scheduled visit"
    : supportsCreateMaintenancePlanFromEquipmentUi
      ? "Create maintenance plan"
      : supportsCreatePartsReorderRequestUi
        ? "Create reorder request"
        : supportsBulkInvoiceUi
          ? "Create Draft Invoices"
          : supportsFollowUpTaskUi
        ? "Create follow-up task"
        : supportsQbSyncUi
          ? "Sync Invoice to QuickBooks"
          : supportsPaymentLinkUi
            ? "Prepare payment link"
            : supportsDraftMessageUi
              ? "Save to Communications"
              : supportsQuoteFromWoUi
                ? "Create draft quote"
                : "Create Draft Invoice"

  async function patchPreviewToServer(): Promise<void> {
    if (supportsBulkInvoiceUi && serverBulkInvoicePreview) {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              excludedWorkOrderIds: [...bulkExcludedIds],
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }

    if (supportsFinancialLinePreview) {
      if (!draftInvoicePreview) return
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              lineItems: draftInvoicePreview.lineItems ?? [],
              notes: draftInvoicePreview.notes ?? "",
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }

    if (supportsDraftMessageUi) {
      if (!draftMessageEdit) return
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              subject: draftMessageEdit.subject,
              body: draftMessageEdit.body,
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }

    if (supportsFollowUpTaskUi) {
      if (!followUpTaskEdit) return
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              title: followUpTaskEdit.title,
              notes: followUpTaskEdit.notes,
              dueDate: followUpTaskEdit.dueDate,
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }

    if (supportsScheduleMaintenanceVisitUi) {
      if (!scheduleVisitEdit) return
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              suggestedDate: scheduleVisitEdit.suggestedDate,
              suggestedTime: scheduleVisitEdit.suggestedTime,
              serviceTypeUi: scheduleVisitEdit.serviceTypeUi,
              priorityUi: scheduleVisitEdit.priorityUi,
              notes: scheduleVisitEdit.notes,
              serviceReason: scheduleVisitEdit.serviceReason,
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }

    if (supportsCreateMaintenancePlanFromEquipmentUi) {
      if (!maintenancePlanEdit) return
      const p = maintenancePlanEdit
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              planName: p.planName,
              intervalUi: p.intervalUi,
              customIntervalDays: p.customIntervalDays,
              nextDueDate: p.nextDueDate,
              lastServiceDate: p.lastServiceDate,
              serviceScope: p.serviceScope,
              estimatedDurationMinutes: p.estimatedDurationMinutes,
              workOrderTypeUi: p.workOrderTypeUi,
              workOrderPriorityUi: p.workOrderPriorityUi,
              preferredServiceTime: p.preferredServiceTime,
              technicianSelectionId: p.technicianSelectionId,
              autoCreateWorkOrder: p.autoCreateWorkOrder,
              notes: p.notes,
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }

    if (supportsCreatePartsReorderRequestUi) {
      if (!partsReorderEdit) return
      const p = partsReorderEdit
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/preview`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: {
              source: p.source,
              executionMode: p.executionMode,
              draftPurchaseOrderEligible: p.draftPurchaseOrderEligible,
              lines: p.lines,
              relatedWorkOrder: p.relatedWorkOrder,
              relatedEquipment: p.relatedEquipment,
              availableVendors: p.availableVendors,
              internalNotes: p.internalNotes,
            },
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        preparedAction?: SerializedPreparedAction
        message?: string
        error?: string
      }
      if (!res.ok) {
        const msg = data.message ?? data.error ?? `Request failed (${res.status})`
        throw new Error(msg)
      }
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
      return
    }
  }

  async function handleSavePreview() {
    if (
      (!previewDirty &&
        !messagePreviewDirty &&
        !followUpTaskDirty &&
        !scheduleVisitDirty &&
        !maintenancePlanDirty &&
        !partsReorderDirty &&
        !bulkPreviewDirty) ||
      mutationBusy
    )
      return
    setMutationBusy(true)
    setMutationError(null)
    try {
      await patchPreviewToServer()
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Could not save preview.")
    } finally {
      setMutationBusy(false)
    }
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as {
      preparedAction?: SerializedPreparedAction
      invoiceId?: string
      invoiceNumber?: string
      quoteId?: string
      checkoutUrl?: string
      checkoutSessionId?: string
      communicationEventId?: string
      followUpTaskId?: string
      workOrderId?: string
      maintenancePlanId?: string
      purchaseOrderId?: string | null
      purchaseOrderNumber?: string | null
      restockLedgerIds?: string[]
      quickBooksSync?: { attempted: number; succeeded: number; errors?: Array<{ internalId: string; message: string }> }
      bulk?: boolean
      results?: Array<
        | { workOrderId: string; invoiceId: string; invoiceNumber: string; status: "draft" }
        | { workOrderId: string; skipped: true; reason: string }
        | { workOrderId: string; error: string }
      >
      succeeded?: number
      failed?: number
      skipped?: number
      status?: string
      message?: string
      error?: string
      needsConfirmation?: boolean
    }
    if (!res.ok) {
      const msg = data.message ?? data.error ?? `Request failed (${res.status})`
      throw new Error(msg)
    }
    return data
  }

  async function handleCancel() {
    setMutationBusy(true)
    setMutationError(null)
    try {
      const data = await postJson(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/cancel`,
        {},
      )
      if (data.preparedAction) onPreparedActionUpdated(data.preparedAction)
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Could not cancel.")
    } finally {
      setMutationBusy(false)
    }
  }

  async function handleCreateDraftInvoice(opts?: { typedPhrase?: string }) {
    setMutationBusy(true)
    setMutationError(null)
    try {
      if (supportsFinancialLinePreview && previewDirty) {
        await patchPreviewToServer()
      } else if (supportsDraftMessageUi && messagePreviewDirty) {
        await patchPreviewToServer()
      } else if (supportsFollowUpTaskUi && followUpTaskDirty) {
        await patchPreviewToServer()
      } else if (supportsScheduleMaintenanceVisitUi && scheduleVisitDirty) {
        await patchPreviewToServer()
      } else if (supportsCreateMaintenancePlanFromEquipmentUi && maintenancePlanDirty) {
        await patchPreviewToServer()
      } else if (supportsCreatePartsReorderRequestUi && partsReorderDirty) {
        await patchPreviewToServer()
      } else if (supportsBulkInvoiceUi && bulkPreviewDirty) {
        await patchPreviewToServer()
      }
      const confirmBody: Record<string, unknown> =
        supportsBulkInvoiceUi ?
          { execute: true, bulkConfirmationPhrase: opts?.typedPhrase ?? "" }
        : { execute: true }
      const data = await postJson(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/${encodeURIComponent(preparedAction.id)}/confirm`,
        confirmBody,
      )
      if (data.preparedAction) {
        onPreparedActionUpdated(data.preparedAction)
      }
      setConfirmOpen(false)
    } catch (e) {
      let msg: string
      if (supportsQbSyncUi) {
        msg = e instanceof Error ? e.message : "Could not sync this invoice to QuickBooks."
      } else if (supportsCreatePartsReorderRequestUi) {
        msg = e instanceof Error ? e.message : "Could not create the reorder request."
      } else if (supportsCreateMaintenancePlanFromEquipmentUi) {
        msg = e instanceof Error ? e.message : "Could not create the maintenance plan."
      } else if (supportsScheduleMaintenanceVisitUi) {
        msg = e instanceof Error ? e.message : "Could not create the scheduled visit."
      } else if (supportsFollowUpTaskUi) {
        msg = e instanceof Error ? e.message : "Could not create the follow-up task."
      } else if (supportsQuoteFromWoUi) {
        msg = e instanceof Error ? e.message : "Could not create draft quote."
      } else if (supportsPaymentLinkUi) {
        msg = e instanceof Error ? e.message : "Could not prepare payment link."
      } else if (supportsDraftMessageUi) {
        msg = e instanceof Error ? e.message : "Could not save the communication draft."
      } else if (supportsBulkInvoiceUi) {
        msg = e instanceof Error ? e.message : "Could not create draft invoices."
      } else {
        msg = e instanceof Error ? e.message : "Could not create draft invoice."
      }
      setMutationError(msg)
      void loadApprovalPolicy()
    } finally {
      setMutationBusy(false)
    }
  }

  function handleEditBeforeCreating() {
    const wo = displayInvoicePreview?.workOrder?.id
    const cust = displayInvoicePreview?.customer?.id
    onEditBeforeCreating?.({ workOrderId: wo, customerId: cust })
  }

  async function copyDraftMessage(): Promise<void> {
    const d = displayDraftMessage
    if (!d) return
    const text = `${d.subject}\n\n${d.body}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Subject and body copied to the clipboard." })
    } catch {
      toast({ title: "Copy failed", description: "Select the text manually.", variant: "destructive" })
    }
  }

  return (
    <Card className={cn("border-border shadow-xs", className)}>
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Prepared workspace action</h3>
          <PreparedActionStatusBadge status={preparedAction.status} />
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {preparedAction.actionId}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{actionTitle}</p>
      </div>

      <div className="space-y-4 px-4 py-4">
        {mutationError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{mutationError}</span>
          </div>
        ) : null}

        {needsClarification ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <p className="font-medium text-amber-950 dark:text-amber-100">Needs clarification</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(preparedAction.previewPayload?.reason as string) ??
                "Resolve missing fields, then prepare again from AIden."}
            </p>
            {Array.isArray(preparedAction.previewPayload?.customerCandidates) &&
            (preparedAction.previewPayload.customerCandidates as unknown[]).length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-foreground">
                {(preparedAction.previewPayload.customerCandidates as Array<{ label?: string }>).map((c, i) => (
                  <li key={i}>{c.label ?? "Candidate"}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {failed ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">This action could not be prepared</p>
              <p className="mt-1 text-destructive/90">{preparedAction.errorMessage ?? "Unknown error."}</p>
            </div>
          </div>
        ) : null}

        {canceled ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            This prepared action was canceled. Nothing was changed.
          </div>
        ) : null}

        {completed && supportsPaymentLinkUi && checkoutUrlComplete ? (
          <PreparedPaymentLinkCompleted checkoutUrl={checkoutUrlComplete} invoiceLabel={paymentLinkInvoiceLabel} />
        ) : null}

        {completed && supportsPaymentLinkUi && !checkoutUrlComplete ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
            This action completed, but no checkout URL was returned. Open the audit trail below or try preparing again.
          </div>
        ) : null}

        {completed && supportsDraftMessageUi && execPayload?.communicationEventId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Communication draft saved</p>
                <p className="text-xs text-muted-foreground">
                  The message was saved to your Communications feed as a draft. Nothing was emailed or texted from
                  Equipify.
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href="/communications">
                    Open Communications
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {completed && supportsQbSyncUi && targetInvoiceId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">QuickBooks sync finished</p>
                <p className="text-xs text-muted-foreground">
                  {execPayload?.quickBooksSync ?
                    `${execPayload.quickBooksSync.succeeded} of ${execPayload.quickBooksSync.attempted} invoice attempt(s) succeeded in this run.`
                  : "Sync completed. See audit trail for details."}
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href={`/invoices?open=${encodeURIComponent(targetInvoiceId)}`}>
                    Open invoice
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {completed && targetInvoiceId && supportsDraftInvoiceUi ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Draft invoice created</p>
                <p className="text-xs text-muted-foreground">
                  Draft invoice created. Review before sending — nothing is emailed or charged automatically.
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href={`/invoices?open=${encodeURIComponent(targetInvoiceId)}`}>
                    Open invoice
                    {(execPayload?.invoiceNumber as string | undefined)?.trim()
                      ? ` ${String(execPayload?.invoiceNumber).trim()}`
                      : ""}
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {completed && targetQuoteId && supportsQuoteFromWoUi ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Draft quote created</p>
                <p className="text-xs text-muted-foreground">
                  Draft quote created. Review in Quotes before sending — nothing is emailed automatically.
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href={`/quotes?open=${encodeURIComponent(targetQuoteId)}`}>
                    Open quote
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {completed && supportsBulkInvoiceUi && execPayload?.bulk ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Bulk draft invoices</p>
                <p className="text-xs text-muted-foreground">
                  {typeof execPayload.succeeded === "number" ? execPayload.succeeded : 0} created ·{" "}
                  {typeof execPayload.failed === "number" ? execPayload.failed : 0} failed ·{" "}
                  {typeof execPayload.skipped === "number" ? execPayload.skipped : 0} skipped. Nothing was emailed or
                  sent automatically.
                </p>
                {Array.isArray(execPayload.results) && execPayload.results.length > 0 ? (
                  <ScrollArea className="max-h-40 rounded-md border border-border bg-background/60">
                    <ul className="divide-y divide-border px-2 py-1 text-xs">
                      {execPayload.results.map((r) => (
                        <li key={r.workOrderId} className="py-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{r.workOrderId.slice(0, 8)}…</span>
                          {" — "}
                          {"invoiceId" in r ?
                            <span className="text-foreground">Invoice #{r.invoiceNumber}</span>
                          : "skipped" in r ?
                            <span className="text-muted-foreground">Skipped: {r.reason}</span>
                          : <span className="text-destructive">{r.error}</span>}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && customerSummaryPreview ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
            {completed ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-2 text-xs text-emerald-950 dark:text-emerald-50">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span>
                  Read-only summary is ready. Nothing in your workspace was changed by this step beyond saving this
                  card.
                </span>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Customer</p>
              <p className="font-medium text-foreground">{customerSummaryPreview.customer.companyName}</p>
              {customerSummaryPreview.customer.billingCity || customerSummaryPreview.customer.billingState ?
                <p className="text-xs text-muted-foreground">
                  {[customerSummaryPreview.customer.billingCity, customerSummaryPreview.customer.billingState]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              : null}
            </div>
            {customerSummaryPreview.financialsRedacted ?
              <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
                Invoice balances and quote amounts are hidden for this role (no financial access).
              </p>
            : null}
            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Overview</p>
                <p>{customerSummaryPreview.customerOverview}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Recent work</p>
                <p>{customerSummaryPreview.recentWorkPerformed}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Open issues</p>
                <p>{customerSummaryPreview.openIssues}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Upcoming maintenance</p>
                <p>{customerSummaryPreview.upcomingMaintenance}</p>
              </div>
              {!customerSummaryPreview.financialsRedacted && customerSummaryPreview.financialStatus ?
                <div>
                  <p className="font-medium text-foreground">Financial status</p>
                  <p>{customerSummaryPreview.financialStatus}</p>
                </div>
              : null}
              <div>
                <p className="font-medium text-foreground">Suggested next steps</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {customerSummaryPreview.recommendedNextActions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
            {customerSummaryPreview.equipment.length > 0 ?
              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Equipment (recent)</p>
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {customerSummaryPreview.equipment.slice(0, 6).map((e) => (
                    <li key={e.id}>
                      {e.name}
                      {e.serialNumber ? ` · SN ${e.serialNumber}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            : null}
            {customerSummaryPreview.recentCommunications && customerSummaryPreview.recentCommunications.length > 0 ?
              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Recent communications</p>
                <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                  {customerSummaryPreview.recentCommunications.slice(0, 5).map((c) => (
                    <li key={c.id} className="border-b border-border/60 pb-1 last:border-0 last:pb-0">
                      <span className="font-medium text-foreground">{c.title}</span>
                      {c.summary ? <span className="block text-muted-foreground">{c.summary}</span> : null}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        {c.channel ? ` · ${c.channel}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button variant="secondary" size="sm" className="h-8 text-xs" asChild>
                <Link
                  href={`/customers/${encodeURIComponent(customerSummaryPreview.customer.id)}`}
                  title="Open the customer profile to add a follow-up task, note, or work order."
                >
                  Create follow-up task
                  <ExternalLink className="ml-1 size-3.5 opacity-70" aria-hidden />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!onPrefillChat}
                title={!onPrefillChat ? "Chat prefill is unavailable here." : undefined}
                onClick={() =>
                  onPrefillChat?.(
                    `Draft a professional follow-up email for ${customerSummaryPreview.customer.companyName}. Summarize recent service, acknowledge any open items from my notes, and propose a clear next step. Do not send — prepare copy only.`,
                  )
                }
              >
                Draft message
              </Button>
              {customerSummaryPreview.showCreateInvoiceFromLatestWorkOrder &&
              customerSummaryPreview.latestCompletedBillableWorkOrderId ?
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!onEditBeforeCreating}
                  title={!onEditBeforeCreating ? "Invoice editor shortcut is unavailable here." : undefined}
                  onClick={() =>
                    onEditBeforeCreating?.({
                      workOrderId: customerSummaryPreview.latestCompletedBillableWorkOrderId ?? undefined,
                      customerId: customerSummaryPreview.customer.id,
                    })
                  }
                >
                  Create invoice from latest completed work order
                </Button>
              : null}
            </div>
          </div>
        ) : null}

        {completed && supportsFollowUpTaskUi && execPayload?.followUpTaskId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Follow-up task created</p>
                <p className="text-xs text-muted-foreground">
                  The task was added to your follow-up queue. Nothing was emailed or texted to the customer from this
                  step.
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href="/communications/follow-ups">
                    Open follow-ups
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {completed && supportsScheduleMaintenanceVisitUi && execPayload?.workOrderId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Scheduled visit created</p>
                <p className="text-xs text-muted-foreground">
                  A scheduled work order was created. Customer email is not sent automatically from this step unless you
                  configure it elsewhere.
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href={`/work-orders?open=${encodeURIComponent(execPayload.workOrderId)}`}>
                    Open work order
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {completed && supportsCreateMaintenancePlanFromEquipmentUi && execPayload?.maintenancePlanId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Maintenance plan created</p>
                <p className="text-xs text-muted-foreground">
                  The plan is active with the interval and next due you confirmed. Auto work orders follow the plan
                  settings.
                </p>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                  <Link href={`/maintenance-plans?open=${encodeURIComponent(execPayload.maintenancePlanId)}`}>
                    Open maintenance plan
                    <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && displayFollowUpTask ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Follow-up task</p>
              <p className="text-xs text-muted-foreground">
                Edit the title, due date, and notes, then create the task. Customer messages are not sent
                automatically.
              </p>
            </div>
            {displayFollowUpTask.reason.trim() ? (
              <div className="rounded-md border border-border bg-muted/40 px-2 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Context</p>
                <p className="mt-1 whitespace-pre-wrap">{displayFollowUpTask.reason}</p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Related record</Label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
                  {displayFollowUpTask.relatedRecord.entityType.replace(/_/g, " ")}
                </span>
                <span className="text-foreground">{displayFollowUpTask.relatedRecord.label}</span>
              </div>
              {displayFollowUpTask.relatedRecord.customerName ? (
                <p className="text-[11px] text-muted-foreground">
                  Customer:{" "}
                  <span className="font-medium text-foreground">{displayFollowUpTask.relatedRecord.customerName}</span>
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assignee (suggested)</Label>
              <p className="text-xs text-muted-foreground">
                {displayFollowUpTask.assigneeLabel?.trim() || "Not assigned — pick an owner in the follow-up queue if needed."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={displayFollowUpTask.title}
                readOnly={!canAct || completed}
                className="text-sm"
                onChange={
                  canAct && !completed && followUpTaskEdit ?
                    (e) => setFollowUpTaskEdit({ ...followUpTaskEdit, title: e.target.value })
                  : undefined
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={displayFollowUpTask.dueDate}
                readOnly={!canAct || completed}
                className="max-w-[12rem] text-sm"
                onChange={
                  canAct && !completed && followUpTaskEdit ?
                    (e) => {
                      const ymd = e.target.value
                      setFollowUpTaskEdit({
                        ...followUpTaskEdit,
                        dueDate: ymd,
                        scheduledForIso: `${ymd}T12:00:00.000Z`,
                      })
                    }
                  : undefined
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={displayFollowUpTask.notes}
                readOnly={!canAct || completed}
                rows={8}
                className="min-h-[120px] text-sm"
                onChange={
                  canAct && !completed && followUpTaskEdit ?
                    (e) => setFollowUpTaskEdit({ ...followUpTaskEdit, notes: e.target.value })
                  : undefined
                }
              />
            </div>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && displayScheduleVisit ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Maintenance / service visit</p>
              <p className="text-xs text-muted-foreground">
                Edit the schedule details, then create a scheduled work order. Requires dispatch or work order
                permissions.
              </p>
            </div>
            {displayScheduleVisit.dateSuggested ? (
              <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-950 dark:text-amber-50">
                Date and time are suggested — confirm they match the customer agreement before creating the visit.
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <p className="font-medium text-foreground">{displayScheduleVisit.customer.companyName}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <p className="text-xs text-muted-foreground">{displayScheduleVisit.locationSummary}</p>
            </div>
            {displayScheduleVisit.equipment ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Equipment</Label>
                <p className="text-xs text-foreground">
                  {displayScheduleVisit.equipment.name}
                  {displayScheduleVisit.equipment.serialNumber ?
                    ` · SN ${displayScheduleVisit.equipment.serialNumber}`
                  : ""}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No specific equipment on this preview (site visit).</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Service reason</Label>
              <Textarea
                value={displayScheduleVisit.serviceReason}
                readOnly={!canAct || completed}
                rows={3}
                className="text-sm"
                onChange={
                  canAct && !completed && scheduleVisitEdit ?
                    (e) => setScheduleVisitEdit({ ...scheduleVisitEdit, serviceReason: e.target.value })
                  : undefined
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Service type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={displayScheduleVisit.serviceTypeUi}
                  disabled={!canAct || completed}
                  onChange={
                    canAct && !completed && scheduleVisitEdit ?
                      (e) =>
                        setScheduleVisitEdit({
                          ...scheduleVisitEdit,
                          serviceTypeUi: e.target.value as ScheduleMaintenanceVisitPreviewPayload["serviceTypeUi"],
                        })
                    : undefined
                  }
                >
                  {(["Repair", "PM", "Inspection", "Install", "Emergency"] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={displayScheduleVisit.priorityUi}
                  disabled={!canAct || completed}
                  onChange={
                    canAct && !completed && scheduleVisitEdit ?
                      (e) =>
                        setScheduleVisitEdit({
                          ...scheduleVisitEdit,
                          priorityUi: e.target.value as ScheduleMaintenanceVisitPreviewPayload["priorityUi"],
                        })
                    : undefined
                  }
                >
                  {(["Low", "Normal", "High", "Critical"] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {displayScheduleVisit.durationMinutes != null ? (
              <p className="text-[11px] text-muted-foreground">
                Suggested duration:{" "}
                <span className="font-medium text-foreground">{displayScheduleVisit.durationMinutes} minutes</span>{" "}
                (reference only — adjust on the work order if needed).
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Visit date</Label>
                <Input
                  type="date"
                  value={displayScheduleVisit.suggestedDate}
                  readOnly={!canAct || completed}
                  className="text-sm"
                  onChange={
                    canAct && !completed && scheduleVisitEdit ?
                      (e) =>
                        setScheduleVisitEdit({
                          ...scheduleVisitEdit,
                          suggestedDate: e.target.value,
                          dateSuggested: false,
                        })
                    : undefined
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Visit time</Label>
                <Input
                  type="time"
                  value={displayScheduleVisit.suggestedTime}
                  readOnly={!canAct || completed}
                  className="text-sm"
                  onChange={
                    canAct && !completed && scheduleVisitEdit ?
                      (e) =>
                        setScheduleVisitEdit({
                          ...scheduleVisitEdit,
                          suggestedTime: e.target.value,
                          dateSuggested: false,
                        })
                    : undefined
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Technician (suggested)</Label>
              <p className="text-xs text-muted-foreground">
                {displayScheduleVisit.technicianLabel?.trim() ||
                  "Not assigned — assign from Dispatch or the work order after creation."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Internal notes</Label>
              <Textarea
                value={displayScheduleVisit.notes}
                readOnly={!canAct || completed}
                rows={5}
                className="min-h-[80px] text-sm"
                onChange={
                  canAct && !completed && scheduleVisitEdit ?
                    (e) => setScheduleVisitEdit({ ...scheduleVisitEdit, notes: e.target.value })
                  : undefined
                }
              />
            </div>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && displayMaintenancePlan ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Maintenance plan</p>
              <p className="text-xs text-muted-foreground">
                Edit the draft plan, then create it. This saves an active maintenance plan for the equipment below.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <p className="font-medium text-foreground">{displayMaintenancePlan.customer.companyName}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Equipment</Label>
              <p className="text-xs text-foreground">
                {displayMaintenancePlan.equipment.name}
                {displayMaintenancePlan.equipment.serialNumber ?
                  ` · SN ${displayMaintenancePlan.equipment.serialNumber}`
                : ""}
              </p>
              {displayMaintenancePlan.equipment.category || displayMaintenancePlan.equipment.location ?
                <p className="text-[11px] text-muted-foreground">
                  {[displayMaintenancePlan.equipment.category, displayMaintenancePlan.equipment.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Plan name</Label>
              <Input
                value={displayMaintenancePlan.planName}
                readOnly={!canAct || completed}
                className="text-sm"
                onChange={
                  canAct && !completed && maintenancePlanEdit ?
                    (e) => setMaintenancePlanEdit({ ...maintenancePlanEdit, planName: e.target.value })
                  : undefined
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Interval</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={displayMaintenancePlan.intervalUi}
                  disabled={!canAct || completed}
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) => {
                        const v = e.target.value as CreateMaintenancePlanFromEquipmentPreviewPayload["intervalUi"]
                        setMaintenancePlanEdit({
                          ...maintenancePlanEdit,
                          intervalUi: v,
                          customIntervalDays:
                            v === "Custom" ? Math.max(1, maintenancePlanEdit.customIntervalDays || 90) : 0,
                        })
                      }
                    : undefined
                  }
                >
                  {(["Annual", "Semi-Annual", "Quarterly", "Monthly", "Custom"] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Next due</Label>
                <Input
                  type="date"
                  value={displayMaintenancePlan.nextDueDate}
                  readOnly={!canAct || completed}
                  className="text-sm"
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) => setMaintenancePlanEdit({ ...maintenancePlanEdit, nextDueDate: e.target.value })
                    : undefined
                  }
                />
              </div>
            </div>
            {displayMaintenancePlan.intervalUi === "Custom" ?
              <div className="space-y-1.5">
                <Label className="text-xs">Custom interval (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={displayMaintenancePlan.customIntervalDays || 1}
                  readOnly={!canAct || completed}
                  className="max-w-[10rem] text-sm"
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) =>
                        setMaintenancePlanEdit({
                          ...maintenancePlanEdit,
                          customIntervalDays: Math.max(1, Math.min(3650, Number.parseInt(e.target.value, 10) || 1)),
                        })
                    : undefined
                  }
                />
              </div>
            : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Last service (optional)</Label>
              <Input
                type="date"
                value={displayMaintenancePlan.lastServiceDate ?? ""}
                readOnly={!canAct || completed}
                className="max-w-[12rem] text-sm"
                onChange={
                  canAct && !completed && maintenancePlanEdit ?
                    (e) =>
                      setMaintenancePlanEdit({
                        ...maintenancePlanEdit,
                        lastServiceDate: e.target.value ? e.target.value : null,
                      })
                  : undefined
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Service scope</Label>
              <Textarea
                value={displayMaintenancePlan.serviceScope}
                readOnly={!canAct || completed}
                rows={4}
                className="min-h-[88px] text-sm"
                onChange={
                  canAct && !completed && maintenancePlanEdit ?
                    (e) => setMaintenancePlanEdit({ ...maintenancePlanEdit, serviceScope: e.target.value })
                  : undefined
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Default work order type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={displayMaintenancePlan.workOrderTypeUi}
                  disabled={!canAct || completed}
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) =>
                        setMaintenancePlanEdit({
                          ...maintenancePlanEdit,
                          workOrderTypeUi: e.target
                            .value as CreateMaintenancePlanFromEquipmentPreviewPayload["workOrderTypeUi"],
                        })
                    : undefined
                  }
                >
                  {(["Repair", "PM", "Inspection", "Install", "Emergency"] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default priority</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                  value={displayMaintenancePlan.workOrderPriorityUi}
                  disabled={!canAct || completed}
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) =>
                        setMaintenancePlanEdit({
                          ...maintenancePlanEdit,
                          workOrderPriorityUi: e.target
                            .value as CreateMaintenancePlanFromEquipmentPreviewPayload["workOrderPriorityUi"],
                        })
                    : undefined
                  }
                >
                  {(["Low", "Normal", "High", "Critical"] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Preferred service time</Label>
                <Input
                  type="time"
                  value={displayMaintenancePlan.preferredServiceTime}
                  readOnly={!canAct || completed}
                  className="text-sm"
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) =>
                        setMaintenancePlanEdit({ ...maintenancePlanEdit, preferredServiceTime: e.target.value })
                    : undefined
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated duration (minutes)</Label>
                <Input
                  type="number"
                  min={15}
                  max={960}
                  placeholder="Optional"
                  value={displayMaintenancePlan.estimatedDurationMinutes ?? ""}
                  readOnly={!canAct || completed}
                  className="text-sm"
                  onChange={
                    canAct && !completed && maintenancePlanEdit ?
                      (e) => {
                        const raw = e.target.value.trim()
                        setMaintenancePlanEdit({
                          ...maintenancePlanEdit,
                          estimatedDurationMinutes:
                            raw === "" ? null : Math.max(15, Math.min(960, Number.parseInt(raw, 10) || 60)),
                        })
                      }
                    : undefined
                  }
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-2 py-2">
              <Checkbox
                id={`aiden-mp-auto-wo-${preparedAction.id}`}
                checked={displayMaintenancePlan.autoCreateWorkOrder}
                disabled={!canAct || completed}
                onCheckedChange={
                  canAct && !completed && maintenancePlanEdit ?
                    (c) =>
                      setMaintenancePlanEdit({
                        ...maintenancePlanEdit,
                        autoCreateWorkOrder: c === true,
                      })
                  : undefined
                }
              />
              <label htmlFor={`aiden-mp-auto-wo-${preparedAction.id}`} className="text-xs leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">Automatically create work orders</span> when this plan
                comes due (same behavior as the maintenance plans page).
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Technician (suggested)</Label>
              <p className="text-xs text-muted-foreground">
                {displayMaintenancePlan.technicianLabel?.trim() ||
                  "Not assigned — assign from the plan or work order after creation."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Internal notes</Label>
              <Textarea
                value={displayMaintenancePlan.notes}
                readOnly={!canAct || completed}
                rows={3}
                className="min-h-[72px] text-sm"
                onChange={
                  canAct && !completed && maintenancePlanEdit ?
                    (e) => setMaintenancePlanEdit({ ...maintenancePlanEdit, notes: e.target.value })
                  : undefined
                }
              />
            </div>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && displayPartsReorder ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Parts reorder</p>
              <p className="text-xs text-muted-foreground">
                {displayPartsReorder.internalNotes}
              </p>
            </div>
            {displayPartsReorder.relatedWorkOrder ?
              <div className="space-y-1">
                <Label className="text-xs">Related work order</Label>
                <p className="text-xs text-foreground">
                  #{displayPartsReorder.relatedWorkOrder.number}
                  {displayPartsReorder.relatedWorkOrder.title ?
                    ` — ${displayPartsReorder.relatedWorkOrder.title}`
                  : ""}
                </p>
              </div>
            : null}
            {displayPartsReorder.relatedEquipment ?
              <div className="space-y-1">
                <Label className="text-xs">Related equipment</Label>
                <p className="text-xs text-foreground">{displayPartsReorder.relatedEquipment.name}</p>
              </div>
            : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Execution</Label>
              <select
                className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm shadow-xs"
                value={displayPartsReorder.executionMode}
                disabled={!canAct || completed}
                onChange={
                  canAct && !completed && partsReorderEdit ?
                    (e) => {
                      const v = e.target.value as CreatePartsReorderPreviewPayload["executionMode"]
                      setPartsReorderEdit({ ...partsReorderEdit, executionMode: v })
                    }
                  : undefined
                }
              >
                <option value="restock_requests">Restock / reorder ledger signals (internal)</option>
                <option
                  value="draft_purchase_order"
                  disabled={!displayPartsReorder.draftPurchaseOrderEligible}
                  title={
                    displayPartsReorder.draftPurchaseOrderEligible ?
                      undefined
                    : "Set the same catalog vendor on every line to enable a single-vendor draft PO."
                  }
                >
                  Draft internal purchase order (single vendor)
                </option>
              </select>
              {!displayPartsReorder.draftPurchaseOrderEligible ?
                <p className="text-[11px] text-muted-foreground">
                  Mixed or missing catalog vendors: execution defaults to ledger signals unless you align vendors below.
                </p>
              : null}
            </div>
            <ScrollArea className="max-h-[320px] rounded-md border border-border">
              <div className="min-w-[640px] divide-y divide-border">
                <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr_0.6fr_1fr_1.4fr] gap-2 bg-muted/40 px-2 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                  <span>Part / SKU</span>
                  <span>Stock</span>
                  <span>Qty</span>
                  <span>Vendor</span>
                  <span>Location</span>
                  <span>Reason</span>
                </div>
                {displayPartsReorder.lines.map((line) => (
                  <div
                    key={line.lineKey}
                    className="grid grid-cols-[1.4fr_0.7fr_0.6fr_0.6fr_1fr_1.4fr] gap-2 px-2 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{line.partName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[line.sku, line.partNumber].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="text-muted-foreground">{line.currentStockAvailable}</div>
                    <div>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-xs"
                        value={line.suggestedQuantity}
                        readOnly={!canAct || completed}
                        onChange={
                          canAct && !completed && partsReorderEdit ?
                            (e) => {
                              const n = Math.max(1, Math.min(1_000_000, Number.parseInt(e.target.value, 10) || 1))
                              setPartsReorderEdit({
                                ...partsReorderEdit,
                                lines: partsReorderEdit.lines.map((x) =>
                                  x.lineKey === line.lineKey ? { ...x, suggestedQuantity: n } : x,
                                ),
                              })
                            }
                          : undefined
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <select
                        className="flex h-8 w-full min-w-[7rem] rounded-md border border-input bg-background px-1 text-[11px] shadow-xs"
                        value={line.vendorId ?? ""}
                        disabled={!canAct || completed}
                        onChange={
                          canAct && !completed && partsReorderEdit ?
                            (e) => {
                              const vid = e.target.value.trim()
                              const vname =
                                displayPartsReorder.availableVendors.find((v) => v.id === vid)?.name ?? null
                              setPartsReorderEdit({
                                ...partsReorderEdit,
                                lines: partsReorderEdit.lines.map((x) =>
                                  x.lineKey === line.lineKey ?
                                    {
                                      ...x,
                                      vendorId: vid && UUID_RE.test(vid) ? vid : null,
                                      vendorName: vid && UUID_RE.test(vid) ? vname : null,
                                    }
                                  : x,
                                ),
                              })
                            }
                          : undefined
                        }
                      >
                        <option value="">—</option>
                        {displayPartsReorder.availableVendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0 text-[11px] text-muted-foreground">
                      <span className="line-clamp-2">{line.inventoryLocationLabel}</span>
                    </div>
                    <div className="min-w-0 text-[11px] text-muted-foreground">
                      <span className="line-clamp-3">{line.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        {completed && supportsCreatePartsReorderRequestUi &&
        (execPayload?.purchaseOrderId || (execPayload?.restockLedgerIds?.length ?? 0) > 0) ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium text-emerald-950 dark:text-emerald-50">Reorder request recorded</p>
                <p className="text-xs text-muted-foreground">
                  {execPayload?.purchaseOrderId ?
                    "A draft purchase order was saved internally. Nothing is transmitted to the vendor from this step."
                  : "Restock signals were written to your inventory ledger. Review the reorder center or purchasing queues as usual."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {execPayload?.purchaseOrderId ?
                    <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                      <Link href={`/purchase-orders?open=${encodeURIComponent(execPayload.purchaseOrderId)}`}>
                        Open draft purchase order
                        <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                      </Link>
                    </Button>
                  : null}
                  <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                    <Link href="/inventory">
                      Open inventory
                      <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && displayDraftMessage ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Customer</p>
              <p className="font-medium text-foreground">{displayDraftMessage.customer.companyName}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
                {displayDraftMessage.scenario.replace(/_/g, " ")}
              </span>
              {displayDraftMessage.recordSummary ? <span>{displayDraftMessage.recordSummary}</span> : null}
            </div>
            {displayDraftMessage.amountLine ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Amount / balance:</span> {displayDraftMessage.amountLine}
              </p>
            ) : null}
            {displayDraftMessage.statusLine ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Status:</span> {displayDraftMessage.statusLine}
              </p>
            ) : null}
            {displayDraftMessage.dateLine ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Date:</span> {displayDraftMessage.dateLine}
              </p>
            ) : null}
            {displayDraftMessage.paymentLinkUrl ? (
              <p className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1.5 text-[10px] text-sky-950 dark:text-sky-50">
                Payment link included in the body below (customer-facing checkout URL only).
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Textarea
                value={displayDraftMessage.subject}
                readOnly={!canAct || completed}
                rows={2}
                className="min-h-0 text-sm"
                onChange={
                  canAct && !completed && draftMessageEdit ?
                    (e) => setDraftMessageEdit({ ...draftMessageEdit, subject: e.target.value })
                  : undefined
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message body</Label>
              <Textarea
                value={displayDraftMessage.body}
                readOnly={!canAct || completed}
                rows={12}
                className="min-h-[180px] text-sm"
                onChange={
                  canAct && !completed && draftMessageEdit ?
                    (e) => setDraftMessageEdit({ ...draftMessageEdit, body: e.target.value })
                  : undefined
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void copyDraftMessage()}>
                <Copy className="size-3.5" aria-hidden />
                Copy message
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Internal invoice notes and integration IDs are not included. Sending email or SMS from Equipify is not
              available from this card — use your normal process after you copy or save the draft.
            </p>
          </div>
        ) : null}

        {!needsClarification && !failed && !canceled && paymentLinkPreview ? (
          <PreparedPaymentLinkPreview preview={paymentLinkPreview} />
        ) : null}

        {!needsClarification && !failed && !canceled && qbSyncPreview ? (
          <PreparedQuickBooksInvoiceSyncPreview preview={qbSyncPreview} />
        ) : null}

        {!needsClarification && !failed && !canceled && serverBulkInvoicePreview ? (
          <BulkPreparedInvoicePreview
            preview={serverBulkInvoicePreview}
            excludedWorkOrderIds={bulkExcludedIds}
            onExcludedChange={setBulkExcludedIds}
            editable={Boolean(canAct && !completed)}
          />
        ) : null}

        {!needsClarification && !failed && !canceled && displayInvoicePreview ? (
          <PreparedInvoicePreview
            preview={displayInvoicePreview}
            editable={Boolean(canAct && !completed && draftInvoicePreview)}
            onChange={canAct && !completed ? setDraftInvoicePreview : undefined}
            previewVariant={supportsQuoteFromWoUi ? "quote" : "invoice"}
          />
        ) : null}

        {!needsClarification &&
        !failed &&
        !canceled &&
        !invoicePreview &&
        !quotePreview &&
        !paymentLinkPreview &&
        !qbSyncPreview &&
        !displayDraftMessage &&
        !displayFollowUpTask &&
        !displayScheduleVisit &&
        !displayMaintenancePlan &&
        !customerSummaryPreview &&
        !serverBulkInvoicePreview ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Preview payload</p>
            <ScrollArea className="h-40 rounded-md border border-border bg-muted/40 p-2">
              <pre className="text-[10px] leading-relaxed text-muted-foreground">
                {JSON.stringify(preparedAction.previewPayload, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        ) : null}

        <Separator />

        <PreparedActionAuditTrail organizationId={organizationId} preparedActionId={preparedAction.id} />

        {approvalBlocked && approval ?
          <Alert variant="destructive" className="border-destructive/60">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle>Approval required</AlertTitle>
            <AlertDescription className="space-y-2 text-xs">
              <p>{approval.blockedMessage ?? "Your role or workspace policy does not allow confirming this action."}</p>
              {approval.whyApprovalRequired.length > 0 ?
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {approval.whyApprovalRequired.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              : null}
              {approval.whoCanApprove.length > 0 ?
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Who can approve:</span> {approval.whoCanApprove.join(" · ")}
                </p>
              : null}
            </AlertDescription>
          </Alert>
        : null}

        {canAct && !completed ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {supportsFinancialLinePreview && displayInvoicePreview && previewDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save preview changes
              </Button>
            ) : null}
            {supportsFinancialLinePreview && hasFinancialLinePreview ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                {supportsQuoteFromWoUi ? "Create draft quote" : "Create Draft Invoice"}
              </Button>
            ) : null}
            {supportsBulkInvoiceUi && serverBulkInvoicePreview && bulkPreviewDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save exclusions
              </Button>
            ) : null}
            {supportsBulkInvoiceUi && serverBulkInvoicePreview ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Create Draft Invoices
              </Button>
            ) : null}
            {supportsFollowUpTaskUi && displayFollowUpTask && followUpTaskDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save preview changes
              </Button>
            ) : null}
            {supportsFollowUpTaskUi && displayFollowUpTask ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Create follow-up task
              </Button>
            ) : null}
            {supportsScheduleMaintenanceVisitUi && displayScheduleVisit && scheduleVisitDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save preview changes
              </Button>
            ) : null}
            {supportsScheduleMaintenanceVisitUi && displayScheduleVisit ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Create scheduled visit
              </Button>
            ) : null}
            {supportsCreateMaintenancePlanFromEquipmentUi && displayMaintenancePlan && maintenancePlanDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save preview changes
              </Button>
            ) : null}
            {supportsCreateMaintenancePlanFromEquipmentUi && displayMaintenancePlan ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Create maintenance plan
              </Button>
            ) : null}
            {supportsCreatePartsReorderRequestUi && displayPartsReorder && partsReorderDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save preview changes
              </Button>
            ) : null}
            {supportsCreatePartsReorderRequestUi && displayPartsReorder ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Create reorder request
              </Button>
            ) : null}
            {supportsDraftMessageUi && displayDraftMessage && messagePreviewDirty ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={() => void handleSavePreview()}
              >
                Save text changes
              </Button>
            ) : null}
            {supportsDraftMessageUi && displayDraftMessage ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || approvalBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Save to Communications
              </Button>
            ) : null}
            {supportsPaymentLinkUi && paymentLinkPreview ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || paymentLinkBlocked || approvalBlocked}
                title={
                  paymentLinkBlocked ?
                    "Fix BlitzPay setup for this invoice before preparing a link."
                  : undefined
                }
                onClick={() => setConfirmOpen(true)}
              >
                Prepare payment link
              </Button>
            ) : null}
            {supportsQbSyncUi && qbSyncPreview ? (
              <Button
                type="button"
                size="sm"
                className="sm:flex-1"
                disabled={mutationBusy || qbSyncBlocked || approvalBlocked}
                title={
                  qbSyncBlocked ?
                    "Resolve QuickBooks readiness issues (see preview) before syncing this invoice."
                  : undefined
                }
                onClick={() => setConfirmOpen(true)}
              >
                Sync Invoice to QuickBooks
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="sm:flex-1"
              disabled={mutationBusy}
              onClick={() => void handleCancel()}
            >
              Cancel
            </Button>
            {supportsDraftInvoiceUi ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="sm:flex-1"
                disabled={mutationBusy}
                onClick={handleEditBeforeCreating}
              >
                Edit Before Creating
              </Button>
            ) : null}
          </div>
        ) : null}

        {canAct && supportsFinancialLinePreview && !hasFinancialLinePreview ? (
          <p className="text-[10px] text-muted-foreground">
            “Create Draft Invoice” or “Create draft quote” appears when AIden returns a structured preview (for example
            after you pick a single customer match). Open a work order or customer context and try again if the
            preview is missing.
          </p>
        ) : null}

        {canAct && supportsDraftMessageUi && !displayDraftMessage ? (
          <p className="text-[10px] text-muted-foreground">
            No message preview was returned. Open a customer, invoice, quote, work order, or equipment page and ask
            AIden again with a phrase like “draft a customer email”.
          </p>
        ) : null}

        {canAct && supportsPaymentLinkUi && !paymentLinkPreview ? (
          <p className="text-[10px] text-muted-foreground">
            “Prepare payment link” appears when the preview includes invoice and BlitzPay details. Open an invoice in
            this workspace and ask AIden again if context is missing.
          </p>
        ) : null}

        {canAct && supportsQbSyncUi && !qbSyncPreview ? (
          <p className="text-[10px] text-muted-foreground">
            Open an invoice in this workspace (invoice drawer) and ask AIden again so the preview can load QuickBooks
            readiness for that invoice.
          </p>
        ) : null}

        {canAct && supportsFollowUpTaskUi && !displayFollowUpTask ? (
          <p className="text-[10px] text-muted-foreground">
            No follow-up preview was returned. Open a customer, invoice, quote, work order, equipment, or maintenance
            plan and ask AIden again (for example “create a follow-up task”).
          </p>
        ) : null}

        {canAct && supportsScheduleMaintenanceVisitUi && !displayScheduleVisit ? (
          <p className="text-[10px] text-muted-foreground">
            No visit preview was returned. Open a customer, equipment, or maintenance plan (or include a visit date in
            your message) and try again — for example “schedule maintenance visit for tomorrow”.
          </p>
        ) : null}

        {canAct && supportsCreateMaintenancePlanFromEquipmentUi && !displayMaintenancePlan ? (
          <p className="text-[10px] text-muted-foreground">
            No maintenance plan preview was returned. Open an equipment record or try phrasing like “quarterly
            maintenance plan for Acme’s pump”.
          </p>
        ) : null}

        {canAct && supportsCreatePartsReorderRequestUi && !displayPartsReorder ? (
          <p className="text-[10px] text-muted-foreground">
            No reorder preview was returned. Open a work order with catalog parts, an equipment record, or ask about low
            stock / reorder center from inventory context.
          </p>
        ) : null}

        {(completed || canceled || failed) && onDismiss ? (
          <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={onDismiss}>
            Prepare another action
          </Button>
        ) : null}
      </div>

      <PreparedActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        riskLevel={preparedAction.riskLevel}
        actionTitle={actionTitle}
        busy={mutationBusy}
        confirmLabel={confirmPrimaryLabel}
        confirmDisabled={approvalBlocked}
        policyBlockedHint={
          approvalBlocked && approval ?
            <>
              {approval.whoCanApprove.length > 0 ?
                <span className="block font-medium">Who can approve: {approval.whoCanApprove.join(" · ")}</span>
              : null}
              {approval.whyApprovalRequired.length > 0 ?
                <ul className="mt-1 list-inside list-disc text-destructive/90">
                  {approval.whyApprovalRequired.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              : null}
            </>
          : null
        }
        financialNote={
          supportsCreatePartsReorderRequestUi ? (
            <>
              This records an internal draft purchase order or inventory restock signals from the preview. Purchase orders
              are not transmitted to vendors automatically from this step.
            </>
          ) : supportsCreateMaintenancePlanFromEquipmentUi ? (
            <>
              This creates an active maintenance plan for the equipment in the preview. Auto-generated work orders follow
              your plan settings; customers are not emailed from this step automatically.
            </>
          ) : supportsScheduleMaintenanceVisitUi ? (
            <>
              This creates a scheduled work order from the preview. Customer email is not sent automatically from this
              step unless you use your normal confirmation flow elsewhere.
            </>
          ) : supportsFollowUpTaskUi ? (
            <>
              This creates an internal follow-up task in your queue from the preview. Customers are not emailed or
              texted from this step.
            </>
          ) : supportsQuoteFromWoUi ? (
            <>
              This creates a draft quote linked to the source work order. Customers are not emailed and the quote is not
              sent automatically.
            </>
          ) : supportsQbSyncUi ? (
            <>
              This runs the same QuickBooks invoice export used elsewhere after you confirm. Nothing is sent to
              QuickBooks until you confirm here.
            </>
          ) : supportsPaymentLinkUi ? (
            <>
              A hosted BlitzPay checkout URL will be created for this invoice. Customers are not emailed or texted, and
              no saved payment method is charged — you copy and share the link when you choose.
            </>
          ) : supportsDraftMessageUi ? (
            <>
              This saves the edited text as a draft row in Communications. Customers are not emailed or texted from
              this step.
            </>
          ) : supportsBulkInvoiceUi ? (
            <>
              This creates draft invoices for each included completed work order in the preview. Customers are not
              emailed and no invoices are sent automatically.
            </>
          ) : supportsDraftInvoiceUi ? (
            <>
              This creates a draft invoice from the preview. Customers are not emailed and no payment is collected
              automatically.
            </>
          ) : undefined
        }
        requireTypedPhrase={
          supportsBulkInvoiceUi ?
            { expectedPhrase: AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE, label: "Type confirmation phrase" }
          : undefined
        }
        onConfirm={(o) => void handleCreateDraftInvoice(o)}
      >
        {supportsBulkInvoiceUi && serverBulkInvoicePreview ? (
          <p className="text-xs text-muted-foreground">
            {serverBulkInvoicePreview.summary.includedCount} draft invoice
            {serverBulkInvoicePreview.summary.includedCount === 1 ? "" : "s"} · Estimated total{" "}
            <span className="font-medium text-foreground">
              ${serverBulkInvoicePreview.summary.estimatedTotal.toFixed(2)}
            </span>
            .
          </p>
        ) : null}
        {hasFinancialLinePreview ? (
          <p className="text-xs text-muted-foreground">
            Draft total{" "}
            <span className="font-medium text-foreground">
              ${(displayInvoicePreview?.total ?? 0).toFixed(2)}
            </span>{" "}
            for {displayInvoicePreview?.customer?.companyName ?? "customer"} — work order #
            {displayInvoicePreview?.workOrder?.workOrderNumber ?? "—"}.
            {supportsQuoteFromWoUi ?
              " Recommended checklist lines may show $0 until you enter estimate pricing."
            : null}
          </p>
        ) : null}
        {paymentLinkPreview ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{paymentLinkPreview.customer.companyName}</span> · Invoice #
              {paymentLinkPreview.invoice.invoiceNumber} ({paymentLinkPreview.invoice.statusUi})
            </p>
            {paymentLinkPreview.amountDueCents != null ? (
              <p>
                Amount due:{" "}
                <span className="font-medium text-foreground">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    paymentLinkPreview.amountDueCents / 100,
                  )}
                </span>
              </p>
            ) : null}
            <p>
              Readiness: <span className="font-medium text-foreground">{paymentLinkPreview.readiness}</span>
              {paymentLinkPreview.readiness === "degraded" ?
                " — you can still prepare a link; review warnings in the preview."
              : null}
            </p>
          </div>
        ) : null}
        {displayDraftMessage ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{displayDraftMessage.customer.companyName}</span> ·{" "}
              {displayDraftMessage.recordSummary}
            </p>
            <p className="font-medium text-foreground">Subject: {displayDraftMessage.subject}</p>
          </div>
        ) : null}
        {qbSyncPreview ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{qbSyncPreview.customer.companyName}</span> · Invoice #
              {qbSyncPreview.invoice.invoiceNumber} ({qbSyncPreview.invoice.statusUi})
            </p>
            <p>
              Total:{" "}
              <span className="font-medium text-foreground">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                  qbSyncPreview.invoice.amountCents / 100,
                )}
              </span>
            </p>
            <p>
              QuickBooks:{" "}
              <span className="font-medium text-foreground">{qbSyncPreview.qbConnection.status}</span>
              {qbSyncPreview.qbConnection.connectionNeedsAttention ?
                " — connection needs attention (see preview)."
              : null}
            </p>
            <p>
              Readiness: <span className="font-medium text-foreground">{qbSyncPreview.readiness}</span>
              {qbSyncPreview.readiness === "degraded" ?
                " — you can still sync; review warnings in the preview."
              : null}
            </p>
          </div>
        ) : null}
        {displayPartsReorder ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              {displayPartsReorder.executionMode === "draft_purchase_order" ?
                "Creates one internal draft purchase order (single vendor)."
              : "Writes restock / reorder ledger signals per line."}
            </p>
            <p>
              {displayPartsReorder.lines.length} line
              {displayPartsReorder.lines.length === 1 ? "" : "s"} · Review quantities and vendors in the card before
              confirming.
            </p>
          </div>
        ) : null}
        {displayMaintenancePlan ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{displayMaintenancePlan.customer.companyName}</span>
              {" · "}
              <span className="font-medium text-foreground">{displayMaintenancePlan.equipment.name}</span>
            </p>
            <p>
              <span className="font-medium text-foreground">{displayMaintenancePlan.planName}</span>
              {" · "}
              {displayMaintenancePlan.intervalUi} · Next due{" "}
              <span className="font-medium text-foreground">{displayMaintenancePlan.nextDueDate}</span>
            </p>
          </div>
        ) : null}
        {displayScheduleVisit ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{displayScheduleVisit.customer.companyName}</span>
              {displayScheduleVisit.equipment ? ` · ${displayScheduleVisit.equipment.name}` : null}
            </p>
            <p>
              {displayScheduleVisit.serviceTypeUi} ·{" "}
              <span className="font-medium text-foreground">
                {displayScheduleVisit.suggestedDate} {displayScheduleVisit.suggestedTime}
              </span>
            </p>
          </div>
        ) : null}
        {displayFollowUpTask ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{displayFollowUpTask.title}</p>
            <p>
              Due: <span className="font-medium text-foreground">{displayFollowUpTask.dueDate}</span> ·{" "}
              {displayFollowUpTask.relatedRecord.label}
            </p>
          </div>
        ) : null}
      </PreparedActionConfirmDialog>
    </Card>
  )
}
