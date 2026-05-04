import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminInvoice, AdminQuote, InvoiceStatus, QuoteStatus } from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import {
  mapOrgInvoiceToAdmin,
  mapOrgQuoteToAdmin,
  type OrgInvoiceRow,
  type OrgQuoteRow,
  invoiceStatusUiToDb,
  quoteStatusUiToDb,
  type LineItemJson,
} from "@/lib/org-quotes-invoices/map"

async function profileLabelsById(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return map
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids)
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    const label =
      (row.full_name && row.full_name.trim()) || (row.email && row.email.trim()) || "Team"
    map.set(row.id, label)
  }
  return map
}

export async function fetchQuotesForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ quotes: AdminQuote[]; error?: string }> {
  const { data: rows, error } = await supabase
    .from("org_quotes")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })

  if (error) return { quotes: [], error: error.message }
  const list = (rows ?? []) as OrgQuoteRow[]
  if (list.length === 0) return { quotes: [] }

  const customerIds = [...new Set(list.map((r) => r.customer_id))]
  const equipIds = [...new Set(list.map((r) => r.equipment_id).filter((id): id is string => Boolean(id)))]
  const woIds = [...new Set(list.map((r) => r.work_order_id).filter((id): id is string => Boolean(id)))]
  const creatorIds = [...new Set(list.map((r) => r.created_by).filter((id): id is string => Boolean(id)))]

  const [custRes, eqRes, woRes, profMap] = await Promise.all([
    supabase.from("customers").select("id, company_name").eq("organization_id", organizationId).in("id", customerIds),
    equipIds.length
      ? supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .in("id", equipIds)
      : Promise.resolve({ data: [] as unknown[] }),
    woIds.length
      ? (async () => {
          let w = await supabase
            .from("work_orders")
            .select("id, work_order_number")
            .eq("organization_id", organizationId)
            .in("id", woIds)
          if (w.error && missingWorkOrderNumberColumn(w.error)) {
            w = await supabase.from("work_orders").select("id").eq("organization_id", organizationId).in("id", woIds)
          }
          return w
        })()
      : Promise.resolve({ data: [] as unknown[] }),
    profileLabelsById(supabase, creatorIds),
  ])

  const custMap = new Map((custRes.data as Array<{ id: string; company_name: string }> | null)?.map((c) => [c.id, c.company_name]) ?? [])
  const eqRows = (eqRes.data ?? []) as Array<{
    id: string
    name: string
    equipment_code: string | null
    serial_number: string | null
    category: string | null
  }>
  const eqMap = new Map(
    eqRows.map((e) => [
      e.id,
      getEquipmentDisplayPrimary({
        id: e.id,
        name: e.name,
        equipment_code: e.equipment_code,
        serial_number: e.serial_number,
        category: e.category,
      }),
    ]),
  )
  const woMap = new Map<string, number | undefined>()
  for (const w of (woRes.data ?? []) as Array<{ id: string; work_order_number?: number | null }>) {
    woMap.set(w.id, w.work_order_number ?? undefined)
  }

  const quotes: AdminQuote[] = list.map((row) =>
    mapOrgQuoteToAdmin(row, {
      customerName: custMap.get(row.customer_id) ?? "Customer",
      equipmentName: row.equipment_id ? eqMap.get(row.equipment_id) ?? "" : "",
      createdByLabel: row.created_by ? profMap.get(row.created_by) ?? "Team" : "Team",
      workOrderNumber: row.work_order_id ? woMap.get(row.work_order_id) : undefined,
    }),
  )

  return { quotes }
}

export async function fetchInvoicesForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ invoices: AdminInvoice[]; error?: string }> {
  const { data: rows, error } = await supabase
    .from("org_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("issued_at", { ascending: false })

  if (error) return { invoices: [], error: error.message }
  const list = (rows ?? []) as OrgInvoiceRow[]
  if (list.length === 0) return { invoices: [] }

  const customerIds = [...new Set(list.map((r) => r.customer_id))]
  const equipIds = [...new Set(list.map((r) => r.equipment_id).filter((id): id is string => Boolean(id)))]
  const creatorIds = [...new Set(list.map((r) => r.created_by).filter((id): id is string => Boolean(id)))]

  const [custRes, eqRes, profMap] = await Promise.all([
    supabase.from("customers").select("id, company_name").eq("organization_id", organizationId).in("id", customerIds),
    equipIds.length
      ? supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .in("id", equipIds)
      : Promise.resolve({ data: [] as unknown[] }),
    profileLabelsById(supabase, creatorIds),
  ])

  const custMap = new Map((custRes.data as Array<{ id: string; company_name: string }> | null)?.map((c) => [c.id, c.company_name]) ?? [])
  const eqRows = (eqRes.data ?? []) as Array<{
    id: string
    name: string
    equipment_code: string | null
    serial_number: string | null
    category: string | null
  }>
  const eqMap = new Map(
    eqRows.map((e) => [
      e.id,
      getEquipmentDisplayPrimary({
        id: e.id,
        name: e.name,
        equipment_code: e.equipment_code,
        serial_number: e.serial_number,
        category: e.category,
      }),
    ]),
  )
  const invoices: AdminInvoice[] = list.map((row) =>
    mapOrgInvoiceToAdmin(row, {
      customerName: custMap.get(row.customer_id) ?? "Customer",
      equipmentName: row.equipment_id ? eqMap.get(row.equipment_id) ?? "" : "",
      createdByLabel: row.created_by ? profMap.get(row.created_by) ?? "Team" : "Team",
    }),
  )

  return { invoices }
}

export async function insertOrgQuote(
  supabase: SupabaseClient,
  payload: {
    organizationId: string
    customerId: string
    equipmentId: string | null
    workOrderId: string | null
    title: string
    amountCents: number
    status: QuoteStatus
    expiresAt: string
    lineItems: LineItemJson[]
    notes: string | null
    internalNotes: string | null
    sentAt: string | null
  },
): Promise<{ id?: string; error?: string }> {
  const seedKey = `live-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`

  const { data, error } = await supabase
    .from("org_quotes")
    .insert({
      organization_id: payload.organizationId,
      customer_id: payload.customerId,
      seed_key: seedKey,
      title: payload.title.trim(),
      amount_cents: payload.amountCents,
      status: quoteStatusUiToDb(payload.status),
      expires_at: payload.expiresAt || null,
      equipment_id: payload.equipmentId,
      work_order_id: payload.workOrderId,
      line_items: payload.lineItems,
      notes: payload.notes?.trim() ? payload.notes.trim() : null,
      internal_notes: payload.internalNotes?.trim() ? payload.internalNotes.trim() : null,
      sent_at: payload.sentAt,
    })
    .select("id")
    .maybeSingle()

  if (error) return { error: error.message }
  const id = (data as { id: string } | null)?.id
  return { id }
}

export async function updateOrgQuote(
  supabase: SupabaseClient,
  organizationId: string,
  quoteId: string,
  patch: Partial<{
    status: QuoteStatus
    expiresAt: string
    notes: string
    internalNotes: string | undefined
    lineItems: LineItemJson[]
    amountCents: number
    title: string
    equipmentId: string | null
    workOrderId: string | null
    sentAt: string | null
  }>,
): Promise<{ error?: string }> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = quoteStatusUiToDb(patch.status)
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt || null
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.internalNotes !== undefined)
    row.internal_notes = patch.internalNotes?.trim() ? patch.internalNotes.trim() : null
  if (patch.lineItems !== undefined) row.line_items = patch.lineItems
  if (patch.amountCents !== undefined) row.amount_cents = patch.amountCents
  if (patch.title !== undefined) row.title = patch.title.trim()
  if (patch.equipmentId !== undefined) row.equipment_id = patch.equipmentId
  if (patch.workOrderId !== undefined) row.work_order_id = patch.workOrderId || null
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt

  if (Object.keys(row).length === 0) return {}

  const { error } = await supabase
    .from("org_quotes")
    .update(row)
    .eq("id", quoteId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}

export async function archiveOrgQuote(
  supabase: SupabaseClient,
  organizationId: string,
  quoteId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("org_quotes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}

export async function insertOrgInvoice(
  supabase: SupabaseClient,
  payload: {
    organizationId: string
    customerId: string
    equipmentId: string | null
    workOrderId: string | null
    quoteId: string | null
    calibrationRecordId: string | null
    title: string
    amountCents: number
    status: InvoiceStatus
    issuedAt: string
    dueDate: string
    paidAt: string | null
    lineItems: LineItemJson[]
    notes: string | null
    internalNotes: string | null
  },
): Promise<{ id?: string; error?: string }> {
  const seedKey = `live-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`

  const { data, error } = await supabase
    .from("org_invoices")
    .insert({
      organization_id: payload.organizationId,
      customer_id: payload.customerId,
      equipment_id: payload.equipmentId,
      work_order_id: payload.workOrderId,
      quote_id: payload.quoteId,
      calibration_record_id: payload.calibrationRecordId,
      seed_key: seedKey,
      title: payload.title.trim(),
      amount_cents: payload.amountCents,
      status: invoiceStatusUiToDb(payload.status),
      issued_at: payload.issuedAt,
      due_date: payload.dueDate || null,
      paid_at: payload.paidAt,
      line_items: payload.lineItems,
      notes: payload.notes?.trim() ? payload.notes.trim() : null,
      internal_notes: payload.internalNotes?.trim() ? payload.internalNotes.trim() : null,
    })
    .select("id")
    .maybeSingle()

  if (error) return { error: error.message }
  const id = (data as { id: string } | null)?.id
  return { id }
}

export async function updateOrgInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  patch: Partial<{
    status: InvoiceStatus
    paidAt: string | null
    sentAt: string | null
    dueDate: string
    notes: string
    lineItems: LineItemJson[]
    amountCents: number
    title: string
  }>,
): Promise<{ error?: string }> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = invoiceStatusUiToDb(patch.status)
  if (patch.paidAt !== undefined) row.paid_at = patch.paidAt
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate || null
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.lineItems !== undefined) row.line_items = patch.lineItems
  if (patch.amountCents !== undefined) row.amount_cents = patch.amountCents
  if (patch.title !== undefined) row.title = patch.title.trim()

  if (Object.keys(row).length === 0) return {}

  const { error } = await supabase
    .from("org_invoices")
    .update(row)
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}

export async function archiveOrgInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("org_invoices")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}
