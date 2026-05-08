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
 * Phases:
 * - `initial_schema_fallback` — full select failed because new intelligence columns are missing
 *   from the remote schema. We are about to retry with a backward-safe legacy select. This is
 *   expected behavior in dev/preview environments where the migration has not been applied yet,
 *   so we surface it as a `console.warn` (dev only) instead of a scary `console.error`.
 * - `legacy_fallback_failed` — both the full select AND the legacy fallback failed. Real failure.
 * - `fatal`                  — the initial select failed for a non-schema reason (RLS, network,
 *                              connection, etc.) so no fallback retry is possible.
 */
export type EquipmentListQueryPhase = "initial_schema_fallback" | "legacy_fallback_failed" | "fatal"

type NormalizedEquipmentError = {
  /** True when no recognizable diagnostic fields were present on the error object. */
  empty: boolean
  code?: string
  message?: string
  details?: string
  hint?: string
  /** Comma-joined enumerable keys when fallback fields are absent — helps identify unknown error shapes. */
  rawKeys?: string
}

/**
 * Coerce arbitrary throwables / Supabase errors into a stable diagnostic shape so the console
 * never receives an opaque `{}`. Supabase usually returns `PostgrestError` (code/message/details/hint),
 * but RLS rejections, edge fetch failures, and aborted requests can surface non-standard shapes.
 */
function normalizeEquipmentListError(error: unknown): NormalizedEquipmentError {
  if (error == null) return { empty: true }
  if (typeof error === "string") return { empty: false, message: error }
  if (typeof error !== "object") return { empty: false, message: String(error) }

  const e = error as Record<string, unknown>
  const code = typeof e.code === "string" && e.code.trim() ? e.code : undefined
  const message =
    typeof e.message === "string" && e.message.trim()
      ? e.message
      : error instanceof Error && error.message
        ? error.message
        : undefined
  const details = typeof e.details === "string" && e.details.trim() ? e.details : undefined
  const hint = typeof e.hint === "string" && e.hint.trim() ? e.hint : undefined

  if (code || message || details || hint) {
    return { empty: false, code, message, details, hint }
  }

  let rawKeys: string | undefined
  try {
    const keys = Object.keys(e)
    if (keys.length > 0) rawKeys = keys.join(",")
  } catch {
    /* defensive: some proxies throw on Object.keys */
  }

  return { empty: !rawKeys, rawKeys }
}

/**
 * Structured log for equipment list query failures.
 *
 * Behavior:
 * - Never emits an empty `{}` payload. If the underlying error has no recognizable diagnostic
 *   fields, a soft dev-only warning is emitted with explicit context.
 * - Uses `console.warn` (dev only) for `initial_schema_fallback`, since that is an expected
 *   recoverable code path; the page proceeds to retry with a legacy select.
 * - Uses `console.error` only for true unrecovered failures (`legacy_fallback_failed`, `fatal`).
 * - Never logs raw row payloads or full organization UUIDs.
 */
export function logEquipmentListQueryFailure(
  phase: EquipmentListQueryPhase,
  error: unknown,
  meta?: { organizationId?: string },
): void {
  const normalized = normalizeEquipmentListError(error)
  const isDev = process.env.NODE_ENV !== "production"
  const orgPrefix = meta?.organizationId ? meta.organizationId.slice(0, 8) : undefined

  if (normalized.empty) {
    if (!isDev) return
    console.warn("[equipment list query] received empty/unknown error object", {
      phase,
      note: "Supabase returned no diagnostic fields (code/message/details/hint). Check network tab and RLS policies.",
      ...(orgPrefix ? { organizationIdPrefix: orgPrefix } : {}),
    })
    return
  }

  const payload: Record<string, unknown> = { phase }
  if (normalized.code) payload.code = normalized.code
  if (normalized.message) payload.message = normalized.message
  if (normalized.details) payload.details = normalized.details
  if (normalized.hint) payload.hint = normalized.hint
  if (normalized.rawKeys) payload.rawKeys = normalized.rawKeys
  if (orgPrefix) payload.organizationIdPrefix = orgPrefix

  if (phase === "initial_schema_fallback") {
    if (isDev) {
      console.warn(
        "[equipment list query] schema mismatch on full select — retrying with legacy column set",
        payload,
      )
    }
    return
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

    if (extra.error) return { rows: primaryRows, error: extra.error.message }
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
  linked_work_order_ids?: string[]
}

export async function fetchInvoicesForEquipmentAsset(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
  workOrderIds: string[] = [],
): Promise<{ rows: EquipmentInvoiceRow[]; error?: string }> {
  const { data: directData, error } = await supabase
    .from("org_invoices")
    .select("id, title, status, amount_cents, issued_at, invoice_number")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("archived_at", null)
    .order("issued_at", { ascending: false })
    .limit(150)

  if (error) return { rows: [], error: error.message }

  const rowsById = new Map<string, EquipmentInvoiceRow>()
  for (const inv of (directData ?? []) as EquipmentInvoiceRow[]) {
    rowsById.set(inv.id, { ...inv, linked_work_order_ids: [] })
  }

  if (workOrderIds.length > 0) {
    const { data: linkRows, error: linkErr } = await supabase
      .from("invoice_work_order_links")
      .select("invoice_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", workOrderIds)

    if (!linkErr) {
      const byInvoice = new Map<string, string[]>()
      for (const link of (linkRows ?? []) as Array<{ invoice_id: string; work_order_id: string }>) {
        const list = byInvoice.get(link.invoice_id) ?? []
        list.push(link.work_order_id)
        byInvoice.set(link.invoice_id, list)
      }
      const missingInvoiceIds = [...byInvoice.keys()].filter((invoiceId) => !rowsById.has(invoiceId))
      if (missingInvoiceIds.length > 0) {
        const { data: linkedData } = await supabase
          .from("org_invoices")
          .select("id, title, status, amount_cents, issued_at, invoice_number")
          .eq("organization_id", organizationId)
          .in("id", missingInvoiceIds)
          .is("archived_at", null)
        for (const inv of (linkedData ?? []) as EquipmentInvoiceRow[]) {
          rowsById.set(inv.id, inv)
        }
      }
      for (const [invoiceId, linked] of byInvoice) {
        const inv = rowsById.get(invoiceId)
        if (inv) inv.linked_work_order_ids = [...new Set([...(inv.linked_work_order_ids ?? []), ...linked])]
      }
    }
  }

  const rows = [...rowsById.values()].sort(
    (a, b) => new Date(b.issued_at ?? 0).getTime() - new Date(a.issued_at ?? 0).getTime(),
  )
  return { rows }
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

export type EquipmentDocumentAttachmentRow = {
  id: string
  attachment_type: string
  file_name: string
  uploaded_at: string
  related_entity_type: string
  related_entity_id: string
  portal_release_status: string
  metadata_json: unknown
}

export async function fetchDocumentAttachmentsForEquipmentHistory(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
  relatedIds: { workOrderIds?: string[]; calibrationRecordIds?: string[] } = {},
): Promise<{ rows: EquipmentDocumentAttachmentRow[]; error?: string }> {
  const targets = [
    { type: "equipment", ids: [equipmentId] },
    { type: "work_order", ids: relatedIds.workOrderIds ?? [] },
    { type: "calibration_record", ids: relatedIds.calibrationRecordIds ?? [] },
  ].filter((target) => target.ids.length > 0)

  const out: EquipmentDocumentAttachmentRow[] = []
  for (const target of targets) {
    const { data, error } = await supabase
      .from("org_document_attachments")
      .select("id, attachment_type, file_name, uploaded_at, related_entity_type, related_entity_id, portal_release_status, metadata_json")
      .eq("organization_id", organizationId)
      .eq("related_entity_type", target.type)
      .in("related_entity_id", target.ids)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(150)
    if (error) return { rows: out, error: error.message }
    out.push(...((data ?? []) as EquipmentDocumentAttachmentRow[]))
  }

  return {
    rows: uniqueById(out).sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    ),
  }
}

export type EquipmentCertificateAttachmentRow = {
  id: string
  file_name: string
  uploaded_at: string
  work_order_id: string
  calibration_record_id: string | null
  equipment_id: string | null
}

export async function fetchCertificateAttachmentsForEquipmentHistory(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
  workOrderIds: string[],
): Promise<{ rows: EquipmentCertificateAttachmentRow[]; error?: string }> {
  const out: EquipmentCertificateAttachmentRow[] = []

  const { data: scoped, error: scopedErr } = await supabase
    .from("certificate_attachments")
    .select("id, file_name, uploaded_at, work_order_id, calibration_record_id, equipment_id")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .order("uploaded_at", { ascending: false })
    .limit(100)
  if (scopedErr) return { rows: [], error: scopedErr.message }
  out.push(...((scoped ?? []) as EquipmentCertificateAttachmentRow[]))

  if (workOrderIds.length > 0) {
    const { data: woScoped, error: woErr } = await supabase
      .from("certificate_attachments")
      .select("id, file_name, uploaded_at, work_order_id, calibration_record_id, equipment_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", workOrderIds)
      .order("uploaded_at", { ascending: false })
      .limit(100)
    if (woErr) return { rows: out, error: woErr.message }
    out.push(...((woScoped ?? []) as EquipmentCertificateAttachmentRow[]).filter((row) => !row.equipment_id || row.equipment_id === equipmentId))
  }

  return {
    rows: uniqueById(out).sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    ),
  }
}
