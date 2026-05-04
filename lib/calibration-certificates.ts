import type { SupabaseClient } from "@supabase/supabase-js"

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
      return {
        id,
        label: label || (type === "section_heading" ? "Section" : "Field"),
        type: type as CalibrationFieldType,
        required: Boolean(row.required),
        helpText: typeof row.helpText === "string" ? row.helpText : undefined,
      }
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
