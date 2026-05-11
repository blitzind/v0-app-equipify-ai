import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminInvoice, AdminQuote, InvoiceStatus, QuoteStatus } from "@/lib/mock-data"
import { applyArchivedAtScope, type ArchivedAtScope } from "@/lib/archive-scope"
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
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
  type InvoicePaymentMethodDb,
} from "@/lib/billing/invoice-payment-allocation"
/** Default lists hide archived rows; use `archived` or `all` for recovery views. */
export type RecordArchiveVisibility = ArchivedAtScope

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

/** Client-safe hook: server QuickBooks code runs in the API route (no server-only imports here). */
function queueQuickBooksInvoiceAutoSync(organizationId: string, invoiceId: string): void {
  void fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/integrations/quickbooks/invoice-auto-sync`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
      credentials: "include",
    },
  ).catch(() => {})
}

export async function fetchQuotesForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { visibility?: RecordArchiveVisibility },
): Promise<{ quotes: AdminQuote[]; error?: string }> {
  const visibility = options?.visibility ?? "active"
  let q = supabase
    .from("org_quotes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (visibility === "active") q = q.is("archived_at", null)
  else if (visibility === "archived") q = q.not("archived_at", "is", null)

  const { data: rows, error } = await q

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

async function hydrateAdminInvoicesFromRows(
  supabase: SupabaseClient,
  organizationId: string,
  list: OrgInvoiceRow[],
): Promise<AdminInvoice[]> {
  if (list.length === 0) return []

  const customerIds = [...new Set(list.map((r) => r.customer_id))]
  const equipIds = [...new Set(list.map((r) => r.equipment_id).filter((id): id is string => Boolean(id)))]
  const creatorIds = [...new Set(list.map((r) => r.created_by).filter((id): id is string => Boolean(id)))]
  const invoiceIds = list.map((r) => r.id)

  const [custRes, eqRes, profMap, linkRes, payRes, refundRes] = await Promise.all([
    supabase.from("customers").select("id, company_name").eq("organization_id", organizationId).in("id", customerIds),
    equipIds.length
      ? supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .in("id", equipIds)
      : Promise.resolve({ data: [] as unknown[] }),
    profileLabelsById(supabase, creatorIds),
    invoiceIds.length
      ? supabase
          .from("invoice_work_order_links")
          .select("invoice_id, work_order_id")
          .eq("organization_id", organizationId)
          .in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as unknown[] }),
    invoiceIds.length
      ? supabase
          .from("org_invoice_payments")
          .select("invoice_id, amount_cents")
          .eq("organization_id", organizationId)
          .in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as unknown[] }),
    invoiceIds.length
      ? supabase
          .from("blitzpay_invoice_refunds")
          .select("org_invoice_id, amount_cents")
          .eq("organization_id", organizationId)
          .in("org_invoice_id", invoiceIds)
          .eq("status", "succeeded")
      : Promise.resolve({ data: [] as unknown[] }),
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

  const linkMap = new Map<string, string[]>()
  for (const r of (linkRes.data ?? []) as Array<{ invoice_id: string; work_order_id: string }>) {
    const cur = linkMap.get(r.invoice_id) ?? []
    cur.push(r.work_order_id)
    linkMap.set(r.invoice_id, cur)
  }

  const payTotals = new Map<string, number>()
  if (!payRes.error) {
    for (const p of (payRes.data ?? []) as Array<{ invoice_id: string; amount_cents: number }>) {
      payTotals.set(p.invoice_id, (payTotals.get(p.invoice_id) ?? 0) + Math.round(Number(p.amount_cents)))
    }
  }

  const refundTotals = new Map<string, number>()
  if (!refundRes.error) {
    for (const p of (refundRes.data ?? []) as Array<{ org_invoice_id: string; amount_cents: number }>) {
      refundTotals.set(
        p.org_invoice_id,
        (refundTotals.get(p.org_invoice_id) ?? 0) + Math.round(Number(p.amount_cents)),
      )
    }
  }

  return list.map((row) => {
    const fromLinks = linkMap.get(row.id) ?? []
    const merged = [...new Set([...fromLinks, ...(row.work_order_id ? [row.work_order_id] : [])])]
    const totalDue = invoiceGrandTotalCents(row)
    const grossPaid = payTotals.get(row.id) ?? 0
    const refunded = refundTotals.get(row.id) ?? 0
    const sumPaid = Math.max(0, grossPaid - refunded)
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: totalDue,
      paymentsTotalCents: sumPaid,
      dbInvoiceStatus: row.status,
    })
    return mapOrgInvoiceToAdmin(row, {
      customerName: custMap.get(row.customer_id) ?? "Customer",
      equipmentName: row.equipment_id ? eqMap.get(row.equipment_id) ?? "" : "",
      createdByLabel: row.created_by ? profMap.get(row.created_by) ?? "Team" : "Team",
      linkedWorkOrderIds: merged.length ? merged : undefined,
      paymentAllocation: {
        invoiceTotalCents: totalDue,
        totalPaidCents: alloc.totalPaidCents,
        balanceDueCents: alloc.balanceDueCents,
        allocationState: alloc.allocationState,
      },
    })
  })
}

/** Updates linked work orders’ billing_state for lifecycle visibility (Phase 1). */
async function syncLinkedWorkOrdersBillingState(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  billingState: "invoiced" | "paid",
): Promise<void> {
  const { data: linkRows } = await supabase
    .from("invoice_work_order_links")
    .select("work_order_id")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)

  const { data: invRow } = await supabase
    .from("org_invoices")
    .select("work_order_id")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  const ids = new Set<string>()
  for (const r of (linkRows ?? []) as Array<{ work_order_id: string }>) {
    if (r.work_order_id) ids.add(r.work_order_id)
  }
  const legacyWo = (invRow as { work_order_id?: string | null } | null)?.work_order_id
  if (legacyWo) ids.add(legacyWo)

  if (ids.size === 0) return

  await supabase
    .from("work_orders")
    .update({ billing_state: billingState, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .in("id", [...ids])
}

export async function reconcileOrgInvoiceFromPayments(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<void> {
  const { data: inv, error: invErr } = await supabase
    .from("org_invoices")
    .select("amount_cents, tax_amount_cents, status, paid_at")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invErr || !inv) return

  const row = inv as {
    amount_cents: number
    tax_amount_cents?: number | null
    status: string
    paid_at?: string | null
  }

  const st = String(row.status || "")
  if (st === "void" || st === "draft") return

  const { data: payments, error: payErr } = await supabase
    .from("org_invoice_payments")
    .select("amount_cents, paid_on")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)

  if (payErr) return

  const grossPay = (payments ?? []).reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )

  const { data: refundRows, error: refErr } = await supabase
    .from("blitzpay_invoice_refunds")
    .select("amount_cents")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", invoiceId)
    .eq("status", "succeeded")

  if (refErr) return

  const refundSum = (refundRows ?? []).reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
  const sumPay = Math.max(0, grossPay - refundSum)
  if (sumPay === 0 && grossPay === 0) return

  const totalDue = invoiceGrandTotalCents(row)

  const updates: Record<string, unknown> = {}
  if (sumPay >= totalDue) {
    updates.status = "paid"
    let maxPaidOn = ""
    for (const p of payments ?? []) {
      const d = String((p as { paid_on: string }).paid_on).slice(0, 10)
      if (d > maxPaidOn) maxPaidOn = d
    }
    updates.paid_at = maxPaidOn || new Date().toISOString().slice(0, 10)
  } else {
    updates.paid_at = null
    if (st === "paid") updates.status = "unpaid"
  }

  const prevPaid = st === "paid"
  const nextPaid = updates.status === "paid"

  const { error: upErr } = await supabase
    .from("org_invoices")
    .update(updates)
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)

  if (upErr) return

  if (nextPaid && !prevPaid) {
    await syncLinkedWorkOrdersBillingState(supabase, organizationId, invoiceId, "paid")
  } else if (prevPaid && updates.status === "unpaid") {
    await syncLinkedWorkOrdersBillingState(supabase, organizationId, invoiceId, "invoiced")
  }

  queueQuickBooksInvoiceAutoSync(organizationId, invoiceId)
}

/**
 * Phase 40: apply QuickBooks inbound “fully paid” only when there are no Equipify payment rows
 * (caller must run reconcile and confirm apply_available first).
 */
export async function markOrgInvoicePaidFromQuickBooksInbound(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  paidOn: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const paidDate = paidOn.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    return { ok: false, error: "Invalid paid date." }
  }

  const { data: inv, error: invErr } = await supabase
    .from("org_invoices")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invErr || !inv) return { ok: false, error: "Invoice not found." }
  const st = String((inv as { status: string }).status)
  if (st === "void" || st === "draft") {
    return { ok: false, error: "This invoice cannot be marked paid." }
  }

  const { count, error: cErr } = await supabase
    .from("org_invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)

  if (cErr) return { ok: false, error: cErr.message }
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Invoice has recorded payments; reconcile manually before applying." }
  }

  const { error: upErr } = await supabase
    .from("org_invoices")
    .update({
      status: "paid",
      paid_at: paidDate,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)

  if (upErr) return { ok: false, error: upErr.message }

  await syncLinkedWorkOrdersBillingState(supabase, organizationId, invoiceId, "paid")
  queueQuickBooksInvoiceAutoSync(organizationId, invoiceId)

  return { ok: true }
}

/** Staff UI path (uses auth user as created_by). */
export async function insertOrgInvoicePayment(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    invoiceId: string
    amountCents: number
    paidOn: string
    paymentMethod: InvoicePaymentMethodDb
    reference?: string | null
    note?: string | null
  },
): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return insertOrgInvoicePaymentWithActor(supabase, {
    ...args,
    createdByUserId: user?.id ?? null,
  })
}

/**
 * Webhooks / automation: insert a payment row with an explicit actor (null for system).
 * Reuses the same reconcile path as staff-recorded payments.
 */
export async function insertOrgInvoicePaymentWithActor(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    invoiceId: string
    amountCents: number
    paidOn: string
    paymentMethod: InvoicePaymentMethodDb
    reference?: string | null
    note?: string | null
    createdByUserId: string | null
  },
): Promise<{ error?: string }> {
  if (!Number.isFinite(args.amountCents) || args.amountCents <= 0) {
    return { error: "Payment amount must be greater than zero." }
  }

  const { data: invRow } = await supabase
    .from("org_invoices")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("id", args.invoiceId)
    .maybeSingle()

  if (!invRow) return { error: "Invoice not found." }

  const { error } = await supabase.from("org_invoice_payments").insert({
    organization_id: args.organizationId,
    invoice_id: args.invoiceId,
    amount_cents: Math.round(args.amountCents),
    paid_on: args.paidOn.slice(0, 10),
    payment_method: args.paymentMethod,
    reference: args.reference?.trim() ? args.reference.trim() : null,
    note: args.note?.trim() ? args.note.trim() : null,
    created_by: args.createdByUserId,
  })

  if (error) return { error: error.message }

  await reconcileOrgInvoiceFromPayments(supabase, args.organizationId, args.invoiceId)
  return {}
}

export async function fetchInvoicesForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { visibility?: RecordArchiveVisibility },
): Promise<{ invoices: AdminInvoice[]; error?: string }> {
  const visibility = options?.visibility ?? "active"
  let q = supabase
    .from("org_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: false })

  q = applyArchivedAtScope(q, visibility)

  const { data: rows, error } = await q

  if (error) return { invoices: [], error: error.message }
  const list = (rows ?? []) as OrgInvoiceRow[]
  const invoices = await hydrateAdminInvoicesFromRows(supabase, organizationId, list)

  return { invoices }
}

/** Invoices linked to a work order (legacy column + junction table). */
export async function fetchInvoicesForWorkOrder(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<{ invoices: AdminInvoice[]; error?: string }> {
  const [directRes, linkRes] = await Promise.all([
    supabase.from("org_invoices").select("id").eq("organization_id", organizationId).eq("work_order_id", workOrderId),
    supabase
      .from("invoice_work_order_links")
      .select("invoice_id")
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId),
  ])

  const ids = new Set<string>()
  for (const r of (directRes.data ?? []) as Array<{ id: string }>) ids.add(r.id)
  for (const r of (linkRes.data ?? []) as Array<{ invoice_id: string }>) ids.add(r.invoice_id)

  if (ids.size === 0) return { invoices: [] }

  const { data: rows, error } = await supabase
    .from("org_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", [...ids])
    .order("issued_at", { ascending: false })

  if (error) return { invoices: [], error: error.message }
  const list = (rows ?? []) as OrgInvoiceRow[]
  const invoices = await hydrateAdminInvoicesFromRows(supabase, organizationId, list)

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
  options?: { archiveReason?: string | null },
): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const archivedAt = new Date().toISOString()
  const { error } = await supabase
    .from("org_quotes")
    .update({
      archived_at: archivedAt,
      archived_by: user?.id ?? null,
      archive_reason: options?.archiveReason?.trim() ? options.archiveReason.trim() : null,
    })
    .eq("id", quoteId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}

export async function restoreOrgQuote(
  supabase: SupabaseClient,
  organizationId: string,
  quoteId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("org_quotes")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
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
    /** DB terms_code — drives due dates & QB alignment */
    termsCode?: string | null
    termsCustomDays?: number | null
    paymentTermsKey?: string | null
    paymentTermsDays?: number | null
    paymentTermsLabel?: string | null
    dueDateOverridden?: boolean
    billingCustomerId?: string | null
    billingName?: string | null
    billingContactName?: string | null
    billingContactEmail?: string | null
    billingContactPhone?: string | null
    billingAddressLine1?: string | null
    billingAddressLine2?: string | null
    billingCity?: string | null
    billingState?: string | null
    billingPostalCode?: string | null
    billingCountry?: string | null
    poNumber?: string | null
    invoiceInstructions?: string | null
    taxCalculationMode?: string | null
    taxBasis?: string | null
    taxJurisdictionLabel?: string | null
    taxRatePercent?: number | null
    taxAmount?: number | null
    taxableSubtotal?: number | null
    nonTaxableSubtotal?: number | null
    taxExemptionApplied?: boolean | null
    taxExemptionReason?: string | null
    taxProvider?: string | null
    taxProviderReference?: string | null
    taxSnapshotJson?: unknown
  },
): Promise<{ id?: string; error?: string }> {
  const seedKey = `live-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const insertRow: Record<string, unknown> = {
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
  }
  if (payload.termsCode !== undefined) insertRow.terms_code = payload.termsCode
  if (payload.termsCustomDays !== undefined) insertRow.terms_custom_days = payload.termsCustomDays
  if (payload.paymentTermsKey !== undefined) insertRow.payment_terms_key = payload.paymentTermsKey
  if (payload.paymentTermsDays !== undefined) insertRow.payment_terms_days = payload.paymentTermsDays
  if (payload.paymentTermsLabel !== undefined) insertRow.payment_terms_label = payload.paymentTermsLabel?.trim() || null
  if (payload.dueDateOverridden !== undefined) insertRow.due_date_overridden = payload.dueDateOverridden
  if (payload.billingCustomerId !== undefined) insertRow.billing_customer_id = payload.billingCustomerId
  if (payload.billingName !== undefined) insertRow.billing_name = payload.billingName?.trim() || null
  if (payload.billingContactName !== undefined) insertRow.billing_contact_name = payload.billingContactName?.trim() || null
  if (payload.billingContactEmail !== undefined) insertRow.billing_contact_email = payload.billingContactEmail?.trim() || null
  if (payload.billingContactPhone !== undefined) insertRow.billing_contact_phone = payload.billingContactPhone?.trim() || null
  if (payload.billingAddressLine1 !== undefined) insertRow.billing_address_line1 = payload.billingAddressLine1?.trim() || null
  if (payload.billingAddressLine2 !== undefined) insertRow.billing_address_line2 = payload.billingAddressLine2?.trim() || null
  if (payload.billingCity !== undefined) insertRow.billing_city = payload.billingCity?.trim() || null
  if (payload.billingState !== undefined) insertRow.billing_state = payload.billingState?.trim() || null
  if (payload.billingPostalCode !== undefined) insertRow.billing_postal_code = payload.billingPostalCode?.trim() || null
  if (payload.billingCountry !== undefined) insertRow.billing_country = payload.billingCountry?.trim() || null
  if (payload.poNumber !== undefined) insertRow.po_number = payload.poNumber?.trim() || null
  if (payload.invoiceInstructions !== undefined) insertRow.invoice_instructions = payload.invoiceInstructions?.trim() || null
  if (payload.taxCalculationMode !== undefined) insertRow.tax_calculation_mode = payload.taxCalculationMode
  if (payload.taxBasis !== undefined) insertRow.tax_basis = payload.taxBasis
  if (payload.taxJurisdictionLabel !== undefined) insertRow.tax_jurisdiction_label = payload.taxJurisdictionLabel?.trim() || null
  if (payload.taxRatePercent !== undefined) insertRow.tax_rate_percent = payload.taxRatePercent
  if (payload.taxAmount !== undefined) insertRow.tax_amount_cents = payload.taxAmount == null ? null : Math.round(payload.taxAmount * 100)
  if (payload.taxableSubtotal !== undefined) insertRow.taxable_subtotal_cents = payload.taxableSubtotal == null ? null : Math.round(payload.taxableSubtotal * 100)
  if (payload.nonTaxableSubtotal !== undefined) insertRow.non_taxable_subtotal_cents = payload.nonTaxableSubtotal == null ? null : Math.round(payload.nonTaxableSubtotal * 100)
  if (payload.taxExemptionApplied !== undefined) insertRow.tax_exemption_applied = payload.taxExemptionApplied
  if (payload.taxExemptionReason !== undefined) insertRow.tax_exemption_reason = payload.taxExemptionReason?.trim() || null
  if (payload.taxProvider !== undefined) insertRow.tax_provider = payload.taxProvider?.trim() || null
  if (payload.taxProviderReference !== undefined) insertRow.tax_provider_reference = payload.taxProviderReference?.trim() || null
  if (payload.taxSnapshotJson !== undefined) insertRow.tax_snapshot_json = payload.taxSnapshotJson

  const { data, error } = await supabase.from("org_invoices").insert(insertRow).select("id").maybeSingle()

  if (error) return { error: error.message }
  const id = (data as { id: string } | null)?.id
  if (id) {
    if (payload.workOrderId) {
      const { error: linkErr } = await supabase.from("invoice_work_order_links").insert({
        organization_id: payload.organizationId,
        invoice_id: id,
        work_order_id: payload.workOrderId,
        linked_by: user?.id ?? null,
        linked_at: new Date().toISOString(),
        sort_order: 0,
      })
      if (linkErr && !String(linkErr.message).includes("duplicate")) {
        return { error: linkErr.message }
      }
      await syncLinkedWorkOrdersBillingState(supabase, payload.organizationId, id, "invoiced")
    }
    queueQuickBooksInvoiceAutoSync(payload.organizationId, id)
  }
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
    dueDateOverridden?: boolean
    notes: string
    lineItems: LineItemJson[]
    amountCents: number
    title: string
    portalCertificateReleaseOverride: string | null
  }>,
): Promise<{ error?: string }> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = invoiceStatusUiToDb(patch.status)
  if (patch.paidAt !== undefined) row.paid_at = patch.paidAt
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt
  if (patch.dueDate !== undefined) {
    row.due_date = patch.dueDate || null
    row.due_date_overridden = patch.dueDateOverridden ?? true
  }
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.lineItems !== undefined) row.line_items = patch.lineItems
  if (patch.amountCents !== undefined) row.amount_cents = patch.amountCents
  if (patch.title !== undefined) row.title = patch.title.trim()
  if (patch.portalCertificateReleaseOverride !== undefined) {
    row.portal_certificate_release_override = patch.portalCertificateReleaseOverride
  }

  if (Object.keys(row).length === 0) return {}

  const { error } = await supabase
    .from("org_invoices")
    .update(row)
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  if (patch.status === "Paid") {
    await syncLinkedWorkOrdersBillingState(supabase, organizationId, invoiceId, "paid")
  }
  queueQuickBooksInvoiceAutoSync(organizationId, invoiceId)
  return {}
}

export async function archiveOrgInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  options?: { archiveReason?: string | null },
): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const archivedAt = new Date().toISOString()
  const { error } = await supabase
    .from("org_invoices")
    .update({
      archived_at: archivedAt,
      archived_by: user?.id ?? null,
      archive_reason: options?.archiveReason?.trim() ? options.archiveReason.trim() : null,
    })
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}

export async function restoreOrgInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("org_invoices")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (error) return { error: error.message }
  return {}
}
