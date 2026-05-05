import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ArchivedRecordType } from "@/lib/archived-center/types"

type TenantArchiveTable =
  | "customers"
  | "equipment"
  | "work_orders"
  | "org_quotes"
  | "org_invoices"
  | "maintenance_plans"
  | "calibration_templates"
  | "calibration_records"
  | "org_vendors"

async function rowExists(
  admin: SupabaseClient,
  table: TenantArchiveTable,
  organizationId: string,
  recordId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", recordId)
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}

export async function restoreArchivedRecord(
  admin: SupabaseClient,
  organizationId: string,
  recordType: ArchivedRecordType,
  recordId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  switch (recordType) {
    case "customer": {
      if (!(await rowExists(admin, "customers", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("customers")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "equipment": {
      if (!(await rowExists(admin, "equipment", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("equipment")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "work_order": {
      if (!(await rowExists(admin, "work_orders", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("work_orders")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "quote": {
      if (!(await rowExists(admin, "org_quotes", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("org_quotes")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "invoice": {
      if (!(await rowExists(admin, "org_invoices", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("org_invoices")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "maintenance_plan": {
      if (!(await rowExists(admin, "maintenance_plans", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("maintenance_plans")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "calibration_template": {
      if (!(await rowExists(admin, "calibration_templates", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("calibration_templates")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "calibration_record": {
      if (!(await rowExists(admin, "calibration_records", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("calibration_records")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
    case "vendor": {
      if (!(await rowExists(admin, "org_vendors", organizationId, recordId)))
        return { ok: false, message: "Record not found." }
      const { error } = await admin
        .from("org_vendors")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", recordId)
      return error ? { ok: false, message: error.message } : { ok: true }
    }
  }
}
