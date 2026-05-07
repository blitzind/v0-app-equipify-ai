import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { applyArchivedAtScope, rowIsArchived, type ArchivedAtScope } from "@/lib/archive-scope"
import type { RepairLog } from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { buildCertificatePdfHtml } from "@/lib/certificates/certificate-pdf-html"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"
import { missingPortalReleasedAtColumn } from "@/lib/work-orders/postgrest-fallback"
import { signedUrlForAttachmentPath } from "@/lib/work-orders/work-order-tab-data"
import {
  documentBrandingFromFields,
  getOrganizationDocumentBranding,
} from "@/lib/organization/document-branding"

/**
 * Selects for `calibration_records`. The "full" select includes
 * `portal_released_at`, which only exists once
 * `20260506120000_portal_certificate_release_phase1.sql` has been applied.
 *
 * Local/dev databases may not have that migration applied yet. When the
 * column is missing, PostgREST returns `42703` ("column does not exist")
 * and we transparently retry the same query without `portal_released_at`.
 * The retried row gets `portal_released_at: null` injected at the row layer
 * so downstream mappers (`mapRecordRow`) see a uniform shape.
 *
 * Behaviour matrix:
 *  - column present → identical to the previous query (portal release works)
 *  - column missing → list still loads, portal release UI treats every row
 *    as "not released yet" (existing default behaviour)
 *  - other DB error → propagated, list does not silently empty out
 */
const CAL_RECORD_SELECT_FULL =
  "id, organization_id, work_order_id, equipment_id, template_id, values, created_at, portal_released_at"
const CAL_RECORD_SELECT_LEGACY =
  "id, organization_id, work_order_id, equipment_id, template_id, values, created_at"

function logPortalReleasedAtFallback(callsite: string, err: PostgrestError): void {
  // Dev-only diagnostic — surfaces schema drift loudly without breaking prod.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[calibration-certificates:${callsite}] calibration_records.portal_released_at missing — falling back to legacy select. ` +
        `Apply supabase/migrations/20260506120000_portal_certificate_release_phase1.sql to enable portal certificate release. ` +
        `(${err.code ?? "no-code"}: ${err.message})`,
    )
  }
}

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
  /** From AI certificate import when true. */
  aiGenerated: boolean
  aiConfidence: number | null
  humanVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Which rows to return from `listCalibrationTemplates` (default: active only). */
export type CalibrationTemplateListVisibility = "active" | "archived" | "all"

export type CalibrationRecord = {
  id: string
  organizationId: string
  workOrderId: string
  equipmentId: string
  templateId: string
  values: Record<string, unknown>
  createdAt: string
  /** When staff releases certificate under manual-release policy (portal). */
  portalReleasedAt?: string | null
}

type CalibrationTemplateRow = {
  id: string
  organization_id: string
  name: string
  equipment_category_id: string | null
  fields: unknown
  archived_at: string | null
  ai_generated?: boolean | null
  ai_confidence?: number | null
  human_verified_at?: string | null
  human_verified_by?: string | null
  created_at: string
  updated_at: string
}

type CalibrationRecordRow = {
  id: string
  organization_id: string
  work_order_id: string
  equipment_id: string
  template_id: string
  values: unknown
  created_at: string
  portal_released_at?: string | null
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

export function mapTemplateRow(row: CalibrationTemplateRow): CalibrationTemplate {
  const aiConf =
    typeof row.ai_confidence === "number" && Number.isFinite(row.ai_confidence) ? row.ai_confidence : null
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    equipmentCategoryId: row.equipment_category_id,
    fields: normalizeTemplateFields(row.fields),
    isArchived: rowIsArchived(row.archived_at),
    aiGenerated: Boolean(row.ai_generated),
    aiConfidence: aiConf,
    humanVerifiedAt: row.human_verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRecordRow(row: CalibrationRecordRow): CalibrationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workOrderId: row.work_order_id,
    equipmentId: row.equipment_id,
    templateId: row.template_id,
    values: row.values && typeof row.values === "object" ? (row.values as Record<string, unknown>) : {},
    createdAt: row.created_at,
    portalReleasedAt: row.portal_released_at ?? null,
  }
}

export async function listCalibrationTemplates(
  supabase: SupabaseClient,
  organizationId: string,
  visibility: CalibrationTemplateListVisibility = "active",
): Promise<CalibrationTemplate[]> {
  let q = supabase
    .from("calibration_templates")
    .select(
      "id, organization_id, name, equipment_category_id, fields, archived_at, ai_generated, ai_confidence, human_verified_at, human_verified_by, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
  q = applyArchivedAtScope(q, visibility)

  const { data, error } = await q
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
      .select(
        "id, organization_id, name, equipment_category_id, fields, archived_at, ai_generated, ai_confidence, human_verified_at, human_verified_by, created_at, updated_at",
      )
      .single()
    if (error) throw new Error(error.message)
    return mapTemplateRow(data as CalibrationTemplateRow)
  }

  const { data, error } = await supabase
    .from("calibration_templates")
    .insert(row)
    .select(
      "id, organization_id, name, equipment_category_id, fields, archived_at, ai_generated, ai_confidence, human_verified_at, human_verified_by, created_at, updated_at",
    )
    .single()
  if (error) throw new Error(error.message)
  return mapTemplateRow(data as CalibrationTemplateRow)
}

export async function archiveCalibrationTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  templateId: string,
  archivedBy?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("calibration_templates")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: archivedBy ?? null,
    })
    .eq("id", templateId)
    .eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
}

export async function restoreCalibrationTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  templateId: string,
): Promise<void> {
  const { error } = await supabase
    .from("calibration_templates")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
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

/** Latest saved certificate for one equipment asset on a work order (history: most recent `created_at`). */
export async function loadLatestCalibrationRecordForEquipment(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  equipmentId: string,
): Promise<CalibrationRecord | null> {
  const runSelect = (select: string) =>
    supabase
      .from("calibration_records")
      .select(select)
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId)
      .eq("equipment_id", equipmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

  let { data, error } = await runSelect(CAL_RECORD_SELECT_FULL)

  if (error && missingPortalReleasedAtColumn(error)) {
    logPortalReleasedAtFallback("loadLatestCalibrationRecordForEquipment", error)
    const retry = await runSelect(CAL_RECORD_SELECT_LEGACY)
    error = retry.error
    data = retry.data
      ? ({ ...(retry.data as Record<string, unknown>), portal_released_at: null } as typeof data)
      : retry.data
  }

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRecordRow(data as CalibrationRecordRow)
}

/** Latest certificate for the work order primary equipment (`work_orders.equipment_id`). */
export async function loadLatestCalibrationRecord(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<CalibrationRecord | null> {
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select("equipment_id")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()
  if (woErr) throw new Error(woErr.message)
  const eqId = (wo as { equipment_id?: string } | null)?.equipment_id
  if (!eqId) return null
  return loadLatestCalibrationRecordForEquipment(supabase, organizationId, workOrderId, eqId)
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
  assigned_technician_id?: string | null
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
  const selectAttempts = [
    "id, work_order_number, customer_id, equipment_id, title, status, completed_at, scheduled_on, assigned_user_id, assigned_technician_id, repair_log, signature_url, signature_captured_at",
    "id, work_order_number, customer_id, equipment_id, title, status, completed_at, scheduled_on, assigned_user_id, repair_log, signature_url, signature_captured_at",
    "id, customer_id, equipment_id, title, status, completed_at, scheduled_on, assigned_user_id, assigned_technician_id, repair_log, signature_url, signature_captured_at",
    "id, customer_id, equipment_id, title, status, completed_at, scheduled_on, assigned_user_id, repair_log, signature_url, signature_captured_at",
  ]

  let rowList: WoCertListRow[] = []
  let lastErr: { message: string } | null = null
  for (const sel of selectAttempts) {
    const res = await supabase
      .from("work_orders")
      .select(sel)
      .eq("organization_id", organizationId)
      .in("id", workOrderIds)
    if (!res.error) {
      rowList = (res.data ?? []) as unknown as WoCertListRow[]
      lastErr = null
      break
    }
    lastErr = res.error
  }
  if (lastErr) throw new Error(lastErr.message)

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
  /** Storage path inside `equipify-signatures` bucket when the assigned technician has a stored signature on file. */
  technicianSignaturePath?: string | null
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

  const runListSelect = (select: string) =>
    supabase
      .from("calibration_records")
      .select(select)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit)

  let firstAttempt = await runListSelect(CAL_RECORD_SELECT_FULL)
  let recErr = firstAttempt.error
  let recordsRaw: Array<Record<string, unknown>> = (firstAttempt.data ?? []) as Array<Record<string, unknown>>

  if (recErr && missingPortalReleasedAtColumn(recErr)) {
    logPortalReleasedAtFallback("listCompletedCertificatesForOrg", recErr)
    const retry = await runListSelect(CAL_RECORD_SELECT_LEGACY)
    recErr = retry.error
    recordsRaw = ((retry.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      portal_released_at: null,
    }))
  }

  // Important: do NOT silently return `[]` on a real error — bubble it up so
  // the page surfaces an actionable message instead of an empty list.
  if (recErr) throw new Error(recErr.message)
  if (!recordsRaw.length) return []
  const records = recordsRaw as unknown as CalibrationRecordRow[]

  const woIds = [...new Set(records.map((r) => (r as CalibrationRecordRow).work_order_id))]
  const templateIds = [...new Set(records.map((r) => (r as CalibrationRecordRow).template_id))]

  const [woMap, tmplRes] = await Promise.all([
    fetchWorkOrdersForCertificateList(supabase, organizationId, woIds),
    supabase
      .from("calibration_templates")
      .select(
        "id, organization_id, name, equipment_category_id, fields, archived_at, ai_generated, ai_confidence, human_verified_at, human_verified_by, created_at, updated_at",
      )
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
  const assignedTechnicianRowIds = new Set<string>()

  for (const r of records as CalibrationRecordRow[]) {
    const wo = woMap.get(r.work_order_id)
    if (!wo) continue
    customerIds.add(wo.customer_id)
    equipmentIds.add(r.equipment_id ?? wo.equipment_id)
    if (wo.assigned_user_id) assigneeIds.add(wo.assigned_user_id)
    if (wo.assigned_technician_id) assignedTechnicianRowIds.add(wo.assigned_technician_id)
  }

  const emptyProfiles: { id: string; full_name: string | null; email: string | null }[] = []
  const emptyTechRows: { id: string; full_name: string | null }[] = []

  const [custRes, eqRes, profRes, techRes] = await Promise.all([
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
    assignedTechnicianRowIds.size
      ? supabase
          .from("technicians")
          .select("id, full_name")
          .eq("organization_id", organizationId)
          .in("id", [...assignedTechnicianRowIds])
      : Promise.resolve({ data: emptyTechRows, error: null }),
  ])

  if (custRes.error) throw new Error(custRes.error.message)
  if (eqRes.error) throw new Error(eqRes.error.message)
  if (profRes.error) throw new Error(profRes.error.message)
  if (techRes.error) throw new Error(techRes.error.message)

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
  const techProfMap = new Map(
    (techRes.data ?? []).map((t) => [
      t.id,
      (t.full_name && t.full_name.trim()) || null,
    ]),
  )

  for (const r of records as CalibrationRecordRow[]) {
    const tmpl = tmplMap.get(r.template_id)
    if (!tmpl) continue
    const wo = woMap.get(r.work_order_id)
    if (!wo) continue

    const eqKey = (r as CalibrationRecordRow).equipment_id ?? wo.equipment_id
    const eqRow = eqMap.get(eqKey)
    const equipmentLabel = eqRow
      ? getEquipmentDisplayPrimary({
          id: eqKey,
          name: eqRow.name,
          equipment_code: eqRow.equipment_code,
          serial_number: eqRow.serial_number,
          category: eqRow.category,
        })
      : "Equipment"
    const customerName = custMap.get(wo.customer_id)?.trim() || "Unknown customer"
    const serviceLocation = eqRow?.location_label?.trim() ?? ""
    const technicianName = wo.assigned_technician_id
      ? techProfMap.get(wo.assigned_technician_id) ?? null
      : wo.assigned_user_id
        ? profMap.get(wo.assigned_user_id) ?? null
        : null
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

/** Load one saved certificate row with the same enrichment as list exports (for portal download). */
export async function loadCompletedCertificateItemByRecordId(
  supabase: SupabaseClient,
  organizationId: string,
  recordId: string,
): Promise<CompletedCertificateListItem | null> {
  const runByIdSelect = (select: string) =>
    supabase
      .from("calibration_records")
      .select(select)
      .eq("organization_id", organizationId)
      .eq("id", recordId)
      .maybeSingle()

  let { data: rec, error } = await runByIdSelect(CAL_RECORD_SELECT_FULL)

  if (error && missingPortalReleasedAtColumn(error)) {
    logPortalReleasedAtFallback("loadCompletedCertificateItemByRecordId", error)
    const retry = await runByIdSelect(CAL_RECORD_SELECT_LEGACY)
    error = retry.error
    rec = retry.data
      ? ({ ...(retry.data as Record<string, unknown>), portal_released_at: null } as typeof rec)
      : retry.data
  }

  if (error) throw new Error(error.message)
  if (!rec) return null

  const r = rec as CalibrationRecordRow
  const woMap = await fetchWorkOrdersForCertificateList(supabase, organizationId, [r.work_order_id])
  const wo = woMap.get(r.work_order_id)
  if (!wo) return null

  const { data: tmplRow } = await supabase
    .from("calibration_templates")
    .select(
      "id, organization_id, name, equipment_category_id, fields, archived_at, ai_generated, ai_confidence, human_verified_at, human_verified_by, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", r.template_id)
    .maybeSingle()

  if (!tmplRow) return null
  const tmpl = mapTemplateRow(tmplRow as CalibrationTemplateRow)

  const eqKey = r.equipment_id ?? wo.equipment_id
  const { data: eqRow } = await supabase
    .from("equipment")
    .select("id, name, location_label, equipment_code, serial_number, category")
    .eq("organization_id", organizationId)
    .eq("id", eqKey)
    .maybeSingle()

  const { data: custRow } = await supabase
    .from("customers")
    .select("company_name")
    .eq("organization_id", organizationId)
    .eq("id", wo.customer_id)
    .maybeSingle()

  let technicianName: string | null = null
  let technicianSignaturePath: string | null = null
  if (wo.assigned_technician_id) {
    // Schema-drift safe: Phase 2 added `signature_url`; legacy DBs return null.
    let tRow: { full_name?: string | null; signature_url?: string | null } | null = null
    const tFull = await supabase
      .from("technicians")
      .select("full_name, signature_url")
      .eq("organization_id", organizationId)
      .eq("id", wo.assigned_technician_id)
      .maybeSingle()
    if (tFull.error) {
      const tLegacy = await supabase
        .from("technicians")
        .select("full_name")
        .eq("organization_id", organizationId)
        .eq("id", wo.assigned_technician_id)
        .maybeSingle()
      tRow = (tLegacy.data as { full_name?: string | null } | null) ?? null
    } else {
      tRow = tFull.data as { full_name?: string | null; signature_url?: string | null } | null
    }
    technicianName = tRow?.full_name?.trim() || null
    technicianSignaturePath = tRow?.signature_url?.trim() || null
  } else if (wo.assigned_user_id) {
    const { data: pr } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", wo.assigned_user_id)
      .maybeSingle()
    technicianName =
      ((pr as { full_name?: string; email?: string } | null)?.full_name?.trim() ||
        (pr as { email?: string } | null)?.email?.trim()) ||
      null
  }

  const equipmentLabel = eqRow
    ? getEquipmentDisplayPrimary({
        id: eqKey,
        name: eqRow.name,
        equipment_code: eqRow.equipment_code,
        serial_number: eqRow.serial_number,
        category: eqRow.category,
      })
    : "Equipment"

  const repairLog = parseRepairLog(wo.repair_log)

  return {
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
    customerName: (custRow as { company_name?: string } | null)?.company_name?.trim() || "Unknown customer",
    serviceLocation: eqRow?.location_label?.trim() ?? "",
    equipmentLabel,
    equipmentCode: eqRow?.equipment_code ?? null,
    equipmentSerialNumber: eqRow?.serial_number ?? null,
    technicianName,
    technicianSignaturePath,
    repairLog,
    customerSignaturePath: wo.signature_url,
    customerSignatureCapturedAt: wo.signature_captured_at,
  }
}

/** Build print-ready HTML for a saved certificate (matches Work Order certificate PDF content). */
export async function buildCompletedCertificatePdfHtml(
  supabase: SupabaseClient,
  item: CompletedCertificateListItem,
  options?: { companyName?: string; logoUrl?: string | null },
): Promise<string> {
  const baseBranding = await getOrganizationDocumentBranding(supabase, item.template.organizationId)
  const companyNameRaw =
    options?.companyName !== undefined ? options.companyName : baseBranding.organizationName
  const companyName = (companyNameRaw ?? "").trim() || "Organization"
  const branding = documentBrandingFromFields({
    name: companyName,
    documentLogoUrl: options?.logoUrl !== undefined ? options.logoUrl : baseBranding.documentLogoUrl,
    logoUrl: options?.logoUrl !== undefined ? options.logoUrl : baseBranding.appLogoUrl,
    primaryColor: baseBranding.accentColor,
    companyEmail: baseBranding.companyEmail,
    companyPhone: baseBranding.companyPhone,
    companyWebsite: baseBranding.companyWebsite,
    companyAddress: baseBranding.companyAddress,
  })

  let customerSignatureUrl: string | null = null
  if (item.customerSignaturePath) {
    customerSignatureUrl = await signedUrlForAttachmentPath(supabase, item.customerSignaturePath)
  }
  const sig = item.repairLog.signatureDataUrl
  let techSig: string | null =
    sig && (sig.startsWith("data:") || sig.startsWith("http")) ? sig : null
  // Phase 2 fallback: when no fresh visit signature was captured, render the
  // technician's stored signature image from the `equipify-signatures` bucket.
  if (!techSig && item.technicianSignaturePath?.trim()) {
    const { data: signed } = await supabase.storage
      .from("equipify-signatures")
      .createSignedUrl(item.technicianSignaturePath, 3600)
    if (signed?.signedUrl) techSig = signed.signedUrl
  }

  const completedDate = item.workOrderCompletedAt
  const scheduledDate = item.workOrderScheduledOn

  return buildCertificatePdfHtml({
    companyName,
    logoUrl: branding.preferredLogoUrl,
    branding,
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
  equipmentId: string,
  templateId: string,
  values: Record<string, unknown>,
): Promise<CalibrationRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const insertPayload = {
    organization_id: organizationId,
    work_order_id: workOrderId,
    equipment_id: equipmentId,
    template_id: templateId,
    values,
    created_by: user?.id ?? null,
  }

  const runInsertSelect = (select: string) =>
    supabase.from("calibration_records").insert(insertPayload).select(select).single()

  let { data, error } = await runInsertSelect(CAL_RECORD_SELECT_FULL)

  if (error && missingPortalReleasedAtColumn(error)) {
    logPortalReleasedAtFallback("createCalibrationRecord", error)
    const retry = await runInsertSelect(CAL_RECORD_SELECT_LEGACY)
    error = retry.error
    data = retry.data
      ? ({ ...(retry.data as Record<string, unknown>), portal_released_at: null } as typeof data)
      : retry.data
  }

  if (error) throw new Error(error.message)
  return mapRecordRow(data as CalibrationRecordRow)
}
