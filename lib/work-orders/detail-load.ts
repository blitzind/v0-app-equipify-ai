import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"
import { WO_DETAIL_SELECT, WO_DETAIL_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import {
  fetchWorkOrderTasks,
  fetchWorkOrderLineItems,
  fetchWorkOrderAttachments,
  mapLineItemRowToPart,
  signedUrlForAttachmentPath,
} from "@/lib/work-orders/work-order-tab-data"
import {
  isCalibrationRecordComplete,
  listCalibrationTemplates,
  type CalibrationTemplate,
} from "@/lib/calibration-certificates"

function formatScheduledTime(isoOrTime: string | null): string {
  if (!isoOrTime) return ""
  const t = isoOrTime.includes("T") ? isoOrTime.slice(11, 16) : isoOrTime.slice(0, 5)
  return t || ""
}

function mapDbStatus(status: string): WorkOrderStatus {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "completed_pending_signature":
      return "Completed Pending Signature"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function mapDbPriority(priority: string): WorkOrderPriority {
  switch (priority) {
    case "low":
      return "Low"
    case "normal":
      return "Normal"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return "Normal"
  }
}

function mapDbType(type: string): WorkOrderType {
  switch (type) {
    case "repair":
      return "Repair"
    case "pm":
      return "PM"
    case "inspection":
      return "Inspection"
    case "install":
      return "Install"
    case "emergency":
      return "Emergency"
    default:
      return "Repair"
  }
}

type WoRow = {
  id: string
  work_order_number?: number | null
  organization_id: string
  customer_id: string
  equipment_id: string
  title: string
  status: string
  priority: string
  type: string
  scheduled_on: string | null
  scheduled_time: string | null
  completed_at: string | null
  assigned_user_id: string | null
  created_at: string
  invoice_number: string | null
  total_labor_cents: number
  total_parts_cents: number
  notes: string | null
  repair_log: unknown
  maintenance_plan_id: string | null
  created_by_pm_automation?: boolean
  signature_url?: string | null
  signature_captured_at?: string | null
  problem_reported?: string | null
  billable_to_customer?: boolean | null
  warranty_review_required?: boolean | null
  warranty_vendor_id?: string | null
  calibration_template_id?: string | null
}

export type WorkOrderPhotoGalleryItem = {
  url: string
  attachmentId?: string
}

export type WorkOrderDocumentItem = {
  id: string
  fileName: string
  fileType: string
  url: string
  uploadedAt: string
  fileSizeBytes: number | null
}

/** Certificate lifecycle for an asset on this work order (from latest calibration_record + template). */
export type WorkOrderCertificateStatus = "not_started" | "in_progress" | "completed"

/** Equipment rows attached to the work order (`work_order_equipment`, or legacy primary only). */
export type WorkOrderEquipmentAsset = {
  id: string
  /** `work_order_equipment` row id when present; null for legacy single-asset fallback without a join row. */
  joinRowId: string | null
  name: string
  equipmentCode: string | null
  serialNumber: string | null
  category: string | null
  locationLabel: string | null
  typeLabel: WorkOrderType
  priorityLabel: WorkOrderPriority
  certificateStatus: WorkOrderCertificateStatus
  calibrationRecordId: string | null
  /** Matches `work_orders.equipment_id` (primary / header asset). */
  isPrimary: boolean
}

export type LoadedWorkOrderDetail = {
  organizationId: string
  workOrder: WorkOrder
  notes: string
  planServices: unknown[] | null
  /** Ordered gallery entries (Supabase attachment photos + legacy repair_log URLs). */
  photoGallery: WorkOrderPhotoGalleryItem[]
  documentAttachments: WorkOrderDocumentItem[]
  /** Parts / materials are loaded from `work_order_line_items`. */
  usesPartsLineItems: boolean
  /** Tasks are loaded from `work_order_tasks`. */
  usesTasksTable: boolean
  /** Assets on this job (join table, or `[work_orders.equipment_id]` when no rows yet). */
  equipmentAssets: WorkOrderEquipmentAsset[]
}

async function safeLoadTabs<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader()
  } catch {
    return fallback
  }
}

type JoinRow = {
  id: string
  equipment_id: string
  work_type: string | null
  priority: string | null
}

function resolveCertificateStatus(
  template: CalibrationTemplate | null | undefined,
  values: Record<string, unknown>,
  hasRecord: boolean,
): WorkOrderCertificateStatus {
  if (!hasRecord) return "not_started"
  if (isCalibrationRecordComplete(template, values)) return "completed"
  return "in_progress"
}

async function fetchWorkOrderEquipmentAssets(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  fallback: { equipmentId: string; typeDb: string; priorityDb: string },
): Promise<WorkOrderEquipmentAsset[]> {
  const { data: joinRows, error: joinErr } = await supabase
    .from("work_order_equipment")
    .select("id, equipment_id, work_type, priority, created_at")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true })

  const normalizedJoin = (!joinErr && joinRows && joinRows.length > 0 ? joinRows : null) as JoinRow[] | null

  const slotRows: Array<{
    joinRowId: string | null
    equipmentId: string
    typeDb: string
    priorityDb: string
  }> =
    normalizedJoin?.map((r) => ({
      joinRowId: r.id,
      equipmentId: r.equipment_id,
      typeDb: (r.work_type ?? fallback.typeDb).trim() || fallback.typeDb,
      priorityDb: (r.priority ?? fallback.priorityDb).trim() || fallback.priorityDb,
    })) ?? [
      {
        joinRowId: null,
        equipmentId: fallback.equipmentId,
        typeDb: fallback.typeDb,
        priorityDb: fallback.priorityDb,
      },
    ]

  const ids = [...new Set(slotRows.map((s) => s.equipmentId))]

  const [{ data: eqRows }, { data: certRows }, templates] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, name, equipment_code, serial_number, category, location_label")
      .eq("organization_id", organizationId)
      .in("id", ids),
    supabase
      .from("calibration_records")
      .select("id, equipment_id, template_id, values, created_at")
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false }),
    listCalibrationTemplates(supabase, organizationId).catch(() => [] as CalibrationTemplate[]),
  ])

  const templateById = new Map(templates.map((t) => [t.id, t]))

  const latestRecordByEquipment = new Map<
    string,
    { id: string; templateId: string; values: Record<string, unknown> }
  >()
  for (const row of (certRows ?? []) as Array<{
    id: string
    equipment_id: string
    template_id: string
    values: unknown
    created_at: string
  }>) {
    if (latestRecordByEquipment.has(row.equipment_id)) continue
    const vals =
      row.values && typeof row.values === "object" && !Array.isArray(row.values)
        ? (row.values as Record<string, unknown>)
        : {}
    latestRecordByEquipment.set(row.equipment_id, {
      id: row.id,
      templateId: row.template_id,
      values: vals,
    })
  }

  const byId = new Map(
    (eqRows ?? []).map(
      (e: {
        id: string
        name: string
        equipment_code: string | null
        serial_number: string | null
        category: string | null
        location_label: string | null
      }) => [e.id, e],
    ),
  )

  return slotRows.map((slot) => {
    const e = byId.get(slot.equipmentId)
    const rec = latestRecordByEquipment.get(slot.equipmentId)
    const tmpl = rec ? templateById.get(rec.templateId) ?? null : null
    const certStatus = resolveCertificateStatus(tmpl, rec?.values ?? {}, Boolean(rec))

    return {
      id: slot.equipmentId,
      joinRowId: slot.joinRowId,
      name: e?.name?.trim() || "Equipment",
      equipmentCode: e?.equipment_code ?? null,
      serialNumber: e?.serial_number ?? null,
      category: e?.category ?? null,
      locationLabel: e?.location_label?.trim() || null,
      typeLabel: mapDbType(slot.typeDb),
      priorityLabel: mapDbPriority(slot.priorityDb),
      certificateStatus: certStatus,
      calibrationRecordId: rec?.id ?? null,
      isPrimary: slot.equipmentId === fallback.equipmentId,
    }
  })
}

export async function loadWorkOrderDetailForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<
  | { ok: true; data: LoadedWorkOrderDetail }
  | { ok: false; notFound?: boolean; message?: string }
> {
  let woRes = await supabase
    .from("work_orders")
    .select(WO_DETAIL_SELECT_WITH_NUM)
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .maybeSingle()

  if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
    woRes = await supabase
      .from("work_orders")
      .select(WO_DETAIL_SELECT)
      .eq("id", workOrderId)
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .maybeSingle()
  }

  const { data: row, error } = woRes
  if (error) return { ok: false, message: error.message }
  if (!row) return { ok: false, notFound: true }

  const w = row as WoRow

  const [{ data: cust }, { data: eq }, { data: assigneeProf }, planRes] = await Promise.all([
    supabase
      .from("customers")
      .select("company_name")
      .eq("id", w.customer_id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("equipment")
      .select("name, location_label, equipment_code, serial_number, category, warranty_start_date, warranty_expiration_date, warranty_expires_at")
      .eq("id", w.equipment_id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    w.assigned_user_id
      ? supabase
          .from("profiles")
          .select("full_name, email, avatar_url")
          .eq("id", w.assigned_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    w.maintenance_plan_id
      ? supabase
          .from("maintenance_plans")
          .select("name, services")
          .eq("id", w.maintenance_plan_id)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const customerName = (cust as { company_name: string } | null)?.company_name ?? "Unknown Customer"
  const eqRow = eq as {
    name: string
    location_label: string | null
    equipment_code: string | null
    serial_number: string | null
    category: string | null
    warranty_start_date?: string | null
    warranty_expiration_date?: string | null
    warranty_expires_at?: string | null
  } | null
  const equipmentName = eqRow
    ? getEquipmentDisplayPrimary({
        id: w.equipment_id,
        name: eqRow.name,
        equipment_code: eqRow.equipment_code,
        serial_number: eqRow.serial_number,
        category: eqRow.category,
      })
    : "Equipment"
  const location = eqRow?.location_label ?? ""
  const warrantyStart = eqRow?.warranty_start_date ?? null
  const warrantyExp = eqRow?.warranty_expiration_date ?? eqRow?.warranty_expires_at ?? null
  const todayIso = new Date().toISOString().slice(0, 10)
  const equipmentWarrantyActive = Boolean(
    warrantyExp &&
      warrantyExp >= todayIso &&
      (!warrantyStart || warrantyStart <= todayIso),
  )
  const ap = assigneeProf as {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  const techName = w.assigned_user_id
    ? (ap?.full_name && ap.full_name.trim()) || (ap?.email && ap.email.trim()) || "Unknown"
    : "Unassigned"
  const techId = w.assigned_user_id ?? "unassigned"

  const planRow = planRes.data as { name: string; services: unknown } | null
  const planName = w.maintenance_plan_id ? (planRow?.name ?? null) : null
  let planServices: unknown[] | null = null
  if (w.maintenance_plan_id && planRow && Array.isArray(planRow.services)) {
    planServices = planRow.services
  }

  const [dbTasks, dbLineItems, dbAttachments] = await Promise.all([
    safeLoadTabs(() => fetchWorkOrderTasks(supabase, organizationId, workOrderId), []),
    safeLoadTabs(() => fetchWorkOrderLineItems(supabase, organizationId, workOrderId), []),
    safeLoadTabs(() => fetchWorkOrderAttachments(supabase, organizationId, workOrderId), []),
  ])

  const parsedBase = parseRepairLog(w.repair_log)
  const usesTasksTable = dbTasks.length > 0
  const usesPartsLineItems = dbLineItems.length > 0

  const mergedTasks = usesTasksTable
    ? dbTasks.map((t) => ({
        id: t.id,
        label: t.title,
        done: t.completed,
        description: t.description?.trim() || undefined,
      }))
    : (parsedBase.tasks ?? [])

  const mergedParts = usesPartsLineItems
    ? dbLineItems.map(mapLineItemRowToPart)
    : parsedBase.partsUsed

  const photoRows = dbAttachments.filter((a) => a.category === "photo")
  const docRows = dbAttachments.filter((a) => a.category === "document")

  const photoGalleryFromDb: WorkOrderPhotoGalleryItem[] = []
  for (const row of photoRows) {
    const url = await signedUrlForAttachmentPath(supabase, row.storage_path)
    if (url) {
      photoGalleryFromDb.push({ url, attachmentId: row.id })
    }
  }

  const legacyPhotos = (parsedBase.photos ?? []).filter(
    (u) => typeof u === "string" && u.length > 0,
  )
  const legacyGallery: WorkOrderPhotoGalleryItem[] = legacyPhotos.map((url) => ({
    url,
    attachmentId: undefined,
  }))

  const photoGallery: WorkOrderPhotoGalleryItem[] = [...photoGalleryFromDb, ...legacyGallery]

  const documentAttachments: WorkOrderDocumentItem[] = []
  for (const row of docRows) {
    const url = await signedUrlForAttachmentPath(supabase, row.storage_path)
    if (url) {
      documentAttachments.push({
        id: row.id,
        fileName: row.file_name,
        fileType: row.file_type,
        url,
        uploadedAt: row.uploaded_at,
        fileSizeBytes: row.file_size_bytes,
      })
    }
  }

  const columnProblem = typeof w.problem_reported === "string" ? w.problem_reported.trim() : ""
  const mergedProblemReported =
    columnProblem !== "" ? columnProblem : (parsedBase.problemReported ?? "")

  const mergedRepairLog = {
    ...parsedBase,
    problemReported: mergedProblemReported,
    tasks: mergedTasks,
    partsUsed: mergedParts,
    /** Legacy-only; Supabase photos use `photoGallery` + attachment rows. */
    photos: legacyPhotos,
  }

  let customerSignaturePreviewUrl: string | null = null
  const sigPath = w.signature_url ?? null
  if (sigPath) {
    customerSignaturePreviewUrl = await signedUrlForAttachmentPath(supabase, sigPath)
  }

  let warrantyVendorName: string | null = null
  if (w.warranty_vendor_id) {
    const { data: vendorRow } = await supabase
      .from("org_vendors")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("id", w.warranty_vendor_id)
      .maybeSingle()
    warrantyVendorName = (vendorRow as { name?: string } | null)?.name?.trim() || null
  }

  const equipmentAssets = await fetchWorkOrderEquipmentAssets(supabase, organizationId, workOrderId, {
    equipmentId: w.equipment_id,
    typeDb: w.type,
    priorityDb: w.priority,
  })

  const mapped: WorkOrder = {
    id: w.id,
    workOrderNumber: w.work_order_number ?? undefined,
    customerId: w.customer_id,
    customerName,
    equipmentId: w.equipment_id,
    equipmentName,
    location,
    type: mapDbType(w.type),
    status: mapDbStatus(w.status),
    priority: mapDbPriority(w.priority),
    technicianId: techId,
    technicianName: techName,
    technicianAvatarUrl: w.assigned_user_id ? ap?.avatar_url?.trim() || null : null,
    scheduledDate: w.scheduled_on ?? "",
    scheduledTime: formatScheduledTime(w.scheduled_time),
    completedDate: w.completed_at ? w.completed_at.slice(0, 10) : "",
    createdAt: w.created_at,
    createdBy: "",
    description: w.title,
    repairLog: mergedRepairLog,
    totalLaborCost: w.total_labor_cents / 100,
    totalPartsCost: w.total_parts_cents / 100,
    invoiceNumber: w.invoice_number ?? "",
    maintenancePlanId: w.maintenance_plan_id,
    maintenancePlanName: planName,
    calibrationTemplateId: w.calibration_template_id ?? null,
    equipmentCategory: eqRow?.category ?? null,
    createdByPmAutomation: Boolean(w.created_by_pm_automation),
    customerSignaturePreviewUrl,
    customerSignatureCapturedAt: w.signature_captured_at ?? null,
    billableToCustomer: w.billable_to_customer ?? true,
    warrantyReviewRequired: w.warranty_review_required ?? false,
    warrantyVendorId: w.warranty_vendor_id ?? null,
    warrantyVendorName,
    equipmentWarrantyActive,
    equipmentCode: eqRow?.equipment_code?.trim() || null,
    equipmentSerialNumber: eqRow?.serial_number?.trim() || null,
  }

  return {
    ok: true,
    data: {
      organizationId,
      workOrder: mapped,
      notes: w.notes ?? "",
      planServices,
      photoGallery,
      documentAttachments,
      usesPartsLineItems,
      usesTasksTable,
      equipmentAssets,
    },
  }
}
