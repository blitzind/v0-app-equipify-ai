import type { SupabaseClient } from "@supabase/supabase-js"
import type { RepairLog } from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { buildCertificatePdfHtml } from "@/lib/certificates/certificate-pdf-html"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"
import { signedUrlForAttachmentPath } from "@/lib/work-orders/work-order-tab-data"

export type CalibrationFieldType =
  | "text"
  | "number"
  | "checkbox"
  | "pass_fail"
  | "notes"
  | "section_heading"

export type CalibrationTemplateField = {
  id: string
  type: CalibrationFieldType
  label: string
  required?: boolean
  helpText?: string
  /** Shown next to number inputs in Work Order certificate UI (stored in template JSON, not a DB column). */
  unit?: string
}

export type CalibrationTemplate = {
  id: string
  organizationId: string
  name: string
  equipmentCategoryId: string | null
  fields: CalibrationTemplateField[]
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export type CalibrationRecord = {
  id: string
  organizationId: string
  workOrderId: string
  templateId: string
  values: Record<string, unknown>
  createdAt: string
}

type CalibrationTemplateRow = {
  id: string
  organization_id: string
  name: string
  equipment_category_id: string | null
  fields: unknown
  is_archived: boolean
  created_at: string
  updated_at: string
}

type CalibrationRecordRow = {
  id: string
  organization_id: string
  work_order_id: string
  template_id: string
  values: unknown
  created_at: string
}

export function defaultValueForField(type: CalibrationFieldType): string | number | boolean {
  if (type === "number") return ""
  if (type === "checkbox") return false
  if (type === "pass_fail") return "pass"
  return ""
}

/** True when all required fields are filled and non-heading inputs satisfy basic completeness. */
export function isCalibrationRecordComplete(
  template: CalibrationTemplate | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!template?.fields?.length) return true
  const fields = template.fields.filter((f) => f.type !== "section_heading")
  if (fields.length === 0) return true

  for (const field of fields) {
    const raw = values[field.id]
    const req = Boolean(field.required)

    switch (field.type) {
      case "text":
      case "notes": {
        const s = typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : ""
        if (req && !s) return false
        break
      }
      case "number": {
        if (raw === "" || raw === undefined || raw === null) {
          if (req) return false
          break
        }
        const n = typeof raw === "number" ? raw : Number(raw)
        if (!Number.isFinite(n)) return false
        break
      }
      case "checkbox":
        break
      case "pass_fail": {
        const v = raw === "fail" ? "fail" : "pass"
        if (req && v !== "pass" && v !== "fail") return false
        break
      }
      default:
        break
    }
  }
  return true
}

export function normalizeTemplateFields(raw: unknown): CalibrationTemplateField[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x): CalibrationTemplateField | null => {
      if (!x || typeof x !== "object") return null
      const row = x as Record<string, unknown>
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : crypto.randomUUID()
      const label = typeof row.label === "string" ? row.label.trim() : ""
      const type = typeof row.type === "string" ? row.type : ""
      const allowed: CalibrationFieldType[] = [
        "text",
        "number",
        "checkbox",
        "pass_fail",
        "notes",
        "section_heading",
      ]
      if (!allowed.includes(type as CalibrationFieldType)) return null
      const base: CalibrationTemplateField = {
        id,
        label: label || (type === "section_heading" ? "Section" : "Field"),
        type: type as CalibrationFieldType,
        required: Boolean(row.required),
        helpText: typeof row.helpText === "string" ? row.helpText : undefined,
      }
      if (type === "number") {
        return {
          ...base,
          unit: typeof row.unit === "string" ? row.unit : "",
        }
      }
      return base
    })
    .filter((x): x is CalibrationTemplateField => Boolean(x))
}

function mapTemplateRow(row: CalibrationTemplateRow): CalibrationTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    equipmentCategoryId: row.equipment_category_id,
    fields: normalizeTemplateFields(row.fields),
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRecordRow(row: CalibrationRecordRow): CalibrationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workOrderId: row.work_order_id,
    templateId: row.template_id,
    values: row.values && typeof row.values === "object" ? (row.values as Record<string, unknown>) : {},
    createdAt: row.created_at,
  }
}

export async function listCalibrationTemplates(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CalibrationTemplate[]> {
  const { data, error } = await supabase
    .from("calibration_templates")
    .select("id, organization_id, name, equipment_category_id, fields, is_archived, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .order("name", { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as CalibrationTemplateRow[]).map(mapTemplateRow)
}

export async function upsertCalibrationTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  payload: {
    id?: string
    name: string
    equipmentCategoryId?: string | null
    fields: CalibrationTemplateField[]
  },
): Promise<CalibrationTemplate> {
  const row = {
    organization_id: organizationId,
    name: payload.name.trim(),
    equipment_category_id: payload.equipmentCategoryId?.trim() || null,
    fields: payload.fields,
  }

  if (payload.id) {
    const { data, error } = await supabase
      .from("calibration_templates")
      .update(row)
      .eq("id", payload.id)
      .eq("organization_id", organizationId)
      .select("id, organization_id, name, equipment_category_id, fields, is_archived, created_at, updated_at")
      .single()
    if (error) throw new Error(error.message)
    return mapTemplateRow(data as CalibrationTemplateRow)
  }

  const { data, error } = await supabase
    .from("calibration_templates")
    .insert(row)
    .select("id, organization_id, name, equipment_category_id, fields, is_archived, created_at, updated_at")
    .single()
  if (error) throw new Error(error.message)
  return mapTemplateRow(data as CalibrationTemplateRow)
}

export async function archiveCalibrationTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  templateId: string,
): Promise<void> {
  const { error } = await supabase
    .from("calibration_templates")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
}

export async function assignTemplateToWorkOrder(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  templateId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("work_orders")
    .update({ calibration_template_id: templateId, updated_at: new Date().toISOString() })
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
}

export async function loadLatestCalibrationRecord(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<CalibrationRecord | null> {
  const { data, error } = await supabase
    .from("calibration_records")
    .select("id, organization_id, work_order_id, template_id, values, created_at")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRecordRow(data as CalibrationRecordRow)
}

function formatWorkOrderStatusLabel(raw: string): string {
  switch (raw) {
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
      return raw
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

function fmtPdfDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type WoCertListRow = {
  id: string
  work_order_number?: number | null
  customer_id: string
  equipment_id: string
  title: string
  status: string
  completed_at: string | null
  scheduled_on: string | null
  assigned_user_id: string | null
  repair_log: unknown
  signature_url: string | null
  signature_captured_at: string | null
}

async function fetchWorkOrdersForCertificateList(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderIds: string[],
): Promise<Map<string, WoCertListRow>> {
  if (workOrderIds.length === 0) return new Map()
  const baseFields =
    "id, work_order_number, customer_id, equipment_id, title, status, completed_at, scheduled_on, assigned_user_id, repair_log, signature_url, signature_captured_at"
  const withNum = baseFields
  const withoutNum = baseFields.replace("work_order_number, ", "")

  const first = await supabase
    .from("work_orders")
    .select(withNum)
    .eq("organization_id", organizationId)
    .in("id", workOrderIds)

  let rowList: WoCertListRow[] = (first.data ?? []) as unknown as WoCertListRow[]
  let err = first.error
  if (err && missingWorkOrderNumberColumn(err)) {
    const second = await supabase
      .from("work_orders")
      .select(withoutNum)
      .eq("organization_id", organizationId)
      .in("id", workOrderIds)
    rowList = (second.data ?? []) as unknown as WoCertListRow[]
    err = second.error
  }

  if (err) throw new Error(err.message)
  const map = new Map<string, WoCertListRow>()
  for (const row of rowList) {
    const r = row as WoCertListRow
    map.set(r.id, r)
  }
  return map
}

/** Row for Certificates → Completed Certificates (saved calibration_records). */
export type CompletedCertificateListItem = {
  recordId: string
  savedAt: string
  template: CalibrationTemplate
  values: Record<string, unknown>
  workOrderId: string
  workOrderLabel: string
  workOrderTitle: string
  workOrderStatusLabel: string
  workOrderCompletedAt: string | null
  workOrderScheduledOn: string | null
  customerName: string
  serviceLocation: string
  equipmentLabel: string
  equipmentCode: string | null
  equipmentSerialNumber: string | null
  technicianName: string | null
  repairLog: RepairLog
  customerSignaturePath: string | null
  customerSignatureCapturedAt: string | null
}

export async function listCompletedCertificatesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { limit?: number },
): Promise<CompletedCertificateListItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 1000)

  const { data: records, error: recErr } = await supabase
    .from("calibration_records")
    .select("id, organization_id, work_order_id, template_id, values, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (recErr) throw new Error(recErr.message)
  if (!records?.length) return []

  const woIds = [...new Set(records.map((r) => (r as CalibrationRecordRow).work_order_id))]
  const templateIds = [...new Set(records.map((r) => (r as CalibrationRecordRow).template_id))]

  const [woMap, tmplRes] = await Promise.all([
    fetchWorkOrdersForCertificateList(supabase, organizationId, woIds),
    supabase
      .from("calibration_templates")
      .select("id, organization_id, name, equipment_category_id, fields, is_archived, created_at, updated_at")
      .eq("organization_id", organizationId)
      .in("id", templateIds),
  ])

  if (tmplRes.error) throw new Error(tmplRes.error.message)
  const tmplMap = new Map(
    ((tmplRes.data ?? []) as CalibrationTemplateRow[]).map((t) => [t.id, mapTemplateRow(t)]),
  )

  const rows: CompletedCertificateListItem[] = []
  const customerIds = new Set<string>()
  const equipmentIds = new Set<string>()
  const assigneeIds = new Set<string>()

  for (const r of records as CalibrationRecordRow[]) {
    const wo = woMap.get(r.work_order_id)
    if (!wo) continue
    customerIds.add(wo.customer_id)
    equipmentIds.add(wo.equipment_id)
    if (wo.assigned_user_id) assigneeIds.add(wo.assigned_user_id)
  }

  const emptyProfiles: { id: string; full_name: string | null; email: string | null }[] = []

  const [custRes, eqRes, profRes] = await Promise.all([
    customerIds.size
      ? supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", organizationId)
          .in("id", [...customerIds])
      : Promise.resolve({ data: [] as { id: string; company_name: string }[], error: null }),
    equipmentIds.size
      ? supabase
          .from("equipment")
          .select("id, name, location_label, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .in("id", [...equipmentIds])
      : Promise.resolve({
          data: [] as {
            id: string
            name: string
            location_label: string | null
            equipment_code: string | null
            serial_number: string | null
            category: string | null
          }[],
          error: null,
        }),
    assigneeIds.size
      ? supabase.from("profiles").select("id, full_name, email").in("id", [...assigneeIds])
      : Promise.resolve({ data: emptyProfiles, error: null }),
  ])

  if (custRes.error) throw new Error(custRes.error.message)
  if (eqRes.error) throw new Error(eqRes.error.message)
  if (profRes.error) throw new Error(profRes.error.message)

  const custMap = new Map((custRes.data ?? []).map((c) => [c.id, c.company_name]))
  const eqMap = new Map(
    (eqRes.data ?? []).map((e) => [
      e.id,
      {
        name: e.name,
        location_label: e.location_label,
        equipment_code: e.equipment_code,
        serial_number: e.serial_number,
        category: e.category,
      },
    ]),
  )
  const profMap = new Map(
    (profRes.data ?? []).map((p) => [
      p.id,
      (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || null,
    ]),
  )

  for (const r of records as CalibrationRecordRow[]) {
    const tmpl = tmplMap.get(r.template_id)
    if (!tmpl) continue
    const wo = woMap.get(r.work_order_id)
    if (!wo) continue

    const eqRow = eqMap.get(wo.equipment_id)
    const equipmentLabel = eqRow
      ? getEquipmentDisplayPrimary({
          id: wo.equipment_id,
          name: eqRow.name,
          equipment_code: eqRow.equipment_code,
          serial_number: eqRow.serial_number,
          category: eqRow.category,
        })
      : "Equipment"
    const customerName = custMap.get(wo.customer_id)?.trim() || "Unknown customer"
    const serviceLocation = eqRow?.location_label?.trim() ?? ""
    const technicianName = wo.assigned_user_id ? profMap.get(wo.assigned_user_id) ?? null : null
    const repairLog = parseRepairLog(wo.repair_log)

    rows.push({
      recordId: r.id,
      savedAt: r.created_at,
      template: tmpl,
      values: r.values && typeof r.values === "object" ? (r.values as Record<string, unknown>) : {},
      workOrderId: wo.id,
      workOrderLabel: getWorkOrderDisplay({
        id: wo.id,
        workOrderNumber: wo.work_order_number ?? null,
      }),
      workOrderTitle: wo.title?.trim() || "",
      workOrderStatusLabel: formatWorkOrderStatusLabel(wo.status),
      workOrderCompletedAt: wo.completed_at,
      workOrderScheduledOn: wo.scheduled_on,
      customerName,
      serviceLocation,
      equipmentLabel,
      equipmentCode: eqRow?.equipment_code ?? null,
      equipmentSerialNumber: eqRow?.serial_number ?? null,
      technicianName,
      repairLog,
      customerSignaturePath: wo.signature_url,
      customerSignatureCapturedAt: wo.signature_captured_at,
    })
  }

  return rows
}

/** Build print-ready HTML for a saved certificate (matches Work Order certificate PDF content). */
export async function buildCompletedCertificatePdfHtml(
  supabase: SupabaseClient,
  item: CompletedCertificateListItem,
  options?: { companyName?: string },
): Promise<string> {
  const companyName = options?.companyName ?? "Equipify Service Co."
  let customerSignatureUrl: string | null = null
  if (item.customerSignaturePath) {
    customerSignatureUrl = await signedUrlForAttachmentPath(supabase, item.customerSignaturePath)
  }
  const sig = item.repairLog.signatureDataUrl
  const techSig =
    sig && (sig.startsWith("data:") || sig.startsWith("http")) ? sig : null

  const completedDate = item.workOrderCompletedAt
  const scheduledDate = item.workOrderScheduledOn

  return buildCertificatePdfHtml({
    companyName,
    templateName: item.template.name,
    template: item.template,
    values: item.values,
    workOrderLabel: item.workOrderLabel,
    workOrderDescription: item.workOrderTitle || undefined,
    customerName: item.customerName,
    serviceLocation: item.serviceLocation || undefined,
    equipmentName: item.equipmentLabel,
    equipmentCode: item.equipmentCode,
    equipmentSerialNumber: item.equipmentSerialNumber,
    calibrationRecordId: item.recordId,
    completedAtLabel: completedDate ? fmtPdfDate(completedDate) : undefined,
    serviceDateLabel: completedDate
      ? fmtPdfDate(completedDate)
      : scheduledDate
        ? fmtPdfDate(scheduledDate)
        : undefined,
    technicianName: item.technicianName?.trim() || "Unassigned",
    technicianSignatureDataUrl: techSig,
    customerSignatureUrl,
    customerSignedBy: item.repairLog.signedBy?.trim() || null,
    technicianSignedDateLabel: item.repairLog.signedAt?.trim()
      ? fmtPdfDate(item.repairLog.signedAt.slice(0, 10))
      : completedDate
        ? fmtPdfDate(completedDate)
        : undefined,
    customerSignedDateLabel: item.customerSignatureCapturedAt
      ? fmtPdfDate(item.customerSignatureCapturedAt.slice(0, 10))
      : undefined,
    technicianNotes: item.repairLog.technicianNotes?.trim() || undefined,
  })
}

export async function createCalibrationRecord(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  templateId: string,
  values: Record<string, unknown>,
): Promise<CalibrationRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("calibration_records")
    .insert({
      organization_id: organizationId,
      work_order_id: workOrderId,
      template_id: templateId,
      values,
      created_by: user?.id ?? null,
    })
    .select("id, organization_id, work_order_id, template_id, values, created_at")
    .single()
  if (error) throw new Error(error.message)
  return mapRecordRow(data as CalibrationRecordRow)
}
