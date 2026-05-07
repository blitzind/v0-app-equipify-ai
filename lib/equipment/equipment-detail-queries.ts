import type { SupabaseClient } from "@supabase/supabase-js"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const m = new Map<string, T>()
  for (const r of rows) m.set(r.id, r)
  return [...m.values()]
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
