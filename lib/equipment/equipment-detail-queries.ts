import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const m = new Map<string, T>()
  for (const r of rows) m.set(r.id, r)
  return [...m.values()]
}

/** Equipment list on `/equipment` — includes Phase 1 intelligence columns when present in DB. */
export const EQUIPMENT_PAGE_SELECT_FULL =
  "id, customer_id, equipment_code, name, manufacturer, category, subcategory, serial_number, status, last_service_at, next_due_at, next_calibration_due_at, warranty_expires_at, location_label, archived_at"

/** Same list without migration `20260720120000_equipment_intelligence_phase1` columns (PostgREST fails whole select if any column is unknown). */
export const EQUIPMENT_PAGE_SELECT_LEGACY =
  "id, customer_id, equipment_code, name, manufacturer, category, serial_number, status, last_service_at, next_due_at, warranty_expires_at, location_label, archived_at"

/**
 * True when the equipment list query likely failed because intelligence columns are missing from the remote schema.
 */
export function isEquipmentListSchemaMismatchError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  if (error.code === "42703") return true
  const m = (error.message ?? "").toLowerCase()
  const colHint =
    m.includes("subcategory") ||
    m.includes("next_calibration_due_at") ||
    m.includes("calibration_interval_months")
  if (!colHint) return false
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("undefined column") ||
    m.includes("schema cache")
  )
}

/**
 * Structured log for equipment list failures (browser or server caller). Does not log raw row payloads.
 */
export function logEquipmentListQueryFailure(
  phase: "initial" | "legacy_fallback" | "fatal",
  error: PostgrestError,
  meta?: { organizationId?: string },
): void {
  const payload = {
    phase,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    ...(meta?.organizationId ? { organizationIdPrefix: meta.organizationId.slice(0, 8) } : {}),
  }
  console.error("[equipment list query]", payload)
}

/**
 * Work orders touching an asset: primary `work_orders.equipment_id` plus `work_order_equipment` joins.
 */
export async function fetchWorkOrdersLinkedToEquipment(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const { data: joinRows, error: joinErr } = await supabase
    .from("work_order_equipment")
    .select("work_order_id")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)

  if (joinErr) return { rows: [], error: joinErr.message }

  const joinIds = [...new Set((joinRows ?? []).map((r) => (r as { work_order_id: string }).work_order_id))]

  let primary = await supabase
    .from("work_orders")
    .select(WO_LIST_SELECT_WITH_NUM)
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (primary.error && missingWorkOrderNumberColumn(primary.error)) {
    primary = await supabase
      .from("work_orders")
      .select(WO_LIST_SELECT)
      .eq("organization_id", organizationId)
      .eq("equipment_id", equipmentId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200)
  }

  if (primary.error) return { rows: [], error: primary.error.message }

  const primaryRows = (primary.data ?? []) as Record<string, unknown>[]
  const primaryIds = new Set(primaryRows.map((r) => r.id as string))
  const onlyJoin = joinIds.filter((id) => !primaryIds.has(id))

  let extraRows: Record<string, unknown>[] = []
  if (onlyJoin.length > 0) {
    let extra = await supabase
      .from("work_orders")
      .select(WO_LIST_SELECT_WITH_NUM)
      .eq("organization_id", organizationId)
      .in("id", onlyJoin)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200)

    if (extra.error && missingWorkOrderNumberColumn(extra.error)) {
      extra = await supabase
        .from("work_orders")
        .select(WO_LIST_SELECT)
        .eq("organization_id", organizationId)
        .in("id", onlyJoin)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
    }

    if (extra.error) return { rows: primaryRows, error: extra.message }
    extraRows = (extra.data ?? []) as Record<string, unknown>[]
  }

  const merged = uniqueById([...primaryRows, ...extraRows] as Array<{ id: string }>).sort(
    (a, b) =>
      new Date((b as { created_at?: string }).created_at ?? 0).getTime() -
      new Date((a as { created_at?: string }).created_at ?? 0).getTime(),
  ) as Record<string, unknown>[]

  return { rows: merged }
}

export type EquipmentInvoiceRow = {
  id: string
  title: string | null
  status: string | null
  amount_cents: number | null
  issued_at: string | null
  invoice_number: string | null
}

export async function fetchInvoicesForEquipmentAsset(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
): Promise<{ rows: EquipmentInvoiceRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("org_invoices")
    .select("id, title, status, amount_cents, issued_at, invoice_number")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("archived_at", null)
    .order("issued_at", { ascending: false })
    .limit(150)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as EquipmentInvoiceRow[] }
}

export type EquipmentCertRow = {
  id: string
  created_at: string
  work_order_id: string
  template_id: string
}

export async function fetchCalibrationRecordsForEquipment(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
): Promise<{ rows: EquipmentCertRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("calibration_records")
    .select("id, created_at, work_order_id, template_id")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as EquipmentCertRow[] }
}
