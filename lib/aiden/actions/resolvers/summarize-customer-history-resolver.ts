import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapCustomerRow,
  rankCustomerMatches,
  workOrderIsAlreadyInvoiced,
} from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import type {
  SummarizeCustomerHistoryCommunicationLine,
  SummarizeCustomerHistoryEquipmentLine,
  SummarizeCustomerHistoryInvoiceLine,
  SummarizeCustomerHistoryMaintenanceLine,
  SummarizeCustomerHistoryOpenIssue,
  SummarizeCustomerHistoryPreviewPayload,
  SummarizeCustomerHistoryQuoteLine,
  SummarizeCustomerHistoryWorkOrderLine,
} from "@/lib/aiden/actions/resolvers/summarize-customer-history-types"
import { isFinancialRow } from "@/lib/communications/feed"
import { invoiceStatusDbToUi, quoteStatusDbToUi } from "@/lib/org-quotes-invoices/map"
import type { CommunicationEventRow } from "@/lib/notifications/types"
import type { OrgPermissions } from "@/lib/permissions/model"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CustomerRow = {
  id: string
  company_name: string
  billing_name: string | null
  billing_contact_name: string | null
  billing_email: string | null
  billing_contact_phone: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  tax_exempt: boolean | null
  default_tax_basis: string | null
  default_tax_category: string | null
}

export type SummarizeCustomerHistoryResolverInput = {
  organizationId: string
  userId: string
  permissions: OrgPermissions
  customerReference?: string
  customerId?: string
}

export type SummarizeCustomerHistoryResolverResult =
  | { status: "prepared"; preview: SummarizeCustomerHistoryPreviewPayload }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

async function loadActiveCustomers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: CustomerRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, company_name, billing_name, billing_contact_name, billing_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_exempt, default_tax_basis, default_tax_category",
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_archived", false)
    .limit(2500)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as CustomerRow[] }
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function titleCaseStatus(db: string): string {
  return db.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function intervalLabel(value: number, unit: string): string {
  const u = unit.trim().toLowerCase()
  const plural = value === 1 ? "" : "s"
  return `Every ${value} ${u}${plural}`
}

function isInvoiceOpenDb(status: string): boolean {
  const s = status.trim().toLowerCase()
  return s !== "paid" && s !== "void"
}

export async function resolveSummarizeCustomerHistoryPreview(
  supabase: SupabaseClient,
  input: SummarizeCustomerHistoryResolverInput,
): Promise<SummarizeCustomerHistoryResolverResult> {
  const organizationId = input.organizationId.trim()
  if (!UUID_RE.test(organizationId)) {
    return { status: "failed", reason: "Invalid organization id." }
  }

  const canViewFinancials = Boolean(input.permissions.canViewFinancials)
  const canViewQuotes = Boolean(input.permissions.canViewQuotes)
  const canEditInvoices = Boolean(input.permissions.canEditInvoices)

  let customerId = input.customerId?.trim()
  const ref = input.customerReference?.trim()

  if (customerId && !UUID_RE.test(customerId)) {
    customerId = undefined
  }

  let customerRow: CustomerRow | null = null

  if (customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_name, billing_name, billing_contact_name, billing_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, tax_exempt, default_tax_basis, default_tax_category",
      )
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .eq("is_archived", false)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    customerRow = (data ?? null) as CustomerRow | null
    if (!customerRow) {
      return { status: "failed", reason: "Customer was not found for this workspace." }
    }
  } else {
    const want = ref?.trim()
    if (!want) {
      return {
        status: "needs_clarification",
        reason: "Which customer should I summarize? Name the account or open a customer page and try again.",
        customerCandidates: [],
      }
    }
    const { rows, error } = await loadActiveCustomers(supabase, organizationId)
    if (error) return { status: "failed", reason: error }
    const ranked = rankCustomerMatches(want, rows)
    if (ranked.length === 0) {
      return {
        status: "needs_clarification",
        reason: `No active customer matched “${want}”. Try the company name on file or open the customer in the app.`,
        customerCandidates: [],
      }
    }
    if (ranked.length > 1 && ranked[0] && ranked[1] && ranked[0].score === ranked[1].score) {
      return {
        status: "needs_clarification",
        reason: "Several customers match that name. Pick one from the list or open the customer record and try again.",
        customerCandidates: ranked.slice(0, 8).map((r) => ({ id: r.id, label: r.label })),
      }
    }
    const pickId = ranked[0]?.id
    if (!pickId) {
      return { status: "failed", reason: "Could not resolve a customer match." }
    }
    customerRow = rows.find((r) => r.id === pickId) ?? null
    if (!customerRow) {
      return { status: "failed", reason: "Matched customer row was not found." }
    }
    customerId = pickId
  }

  if (!customerId || !customerRow) {
    return { status: "failed", reason: "Customer could not be resolved." }
  }

  const mapped = mapCustomerRow(customerRow)

  const [woRes, eqRes, mpRes, invRes, quoteRes, commRes] = await Promise.all([
    supabase
      .from("work_orders")
      .select("id, work_order_number, title, status, completed_at, updated_at, billable_to_customer")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("equipment")
      .select("id, name, status, serial_number")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("maintenance_plans")
      .select("id, name, status, next_due_date, interval_value, interval_unit, equipment_id, is_archived")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("is_archived", false)
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .limit(15),
    canViewFinancials ?
      supabase
        .from("org_invoices")
        .select("id, invoice_number, title, status, amount_cents, due_date, issued_at, archived_at")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("issued_at", { ascending: false })
        .limit(12)
    : Promise.resolve({ data: [] as unknown[], error: null }),
    canViewQuotes ?
      supabase
        .from("org_quotes")
        .select("id, quote_number, title, status, amount_cents, archived_at, expires_at")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(8)
    : Promise.resolve({ data: [] as unknown[], error: null }),
    supabase
      .from("communication_events")
      .select("id, created_at, channel, direction, title, summary, delivery_status, metadata, event_type")
      .eq("organization_id", organizationId)
      .eq("recipient_customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  if (woRes.error) return { status: "failed", reason: woRes.error.message }
  if (eqRes.error) return { status: "failed", reason: eqRes.error.message }
  if (mpRes.error) return { status: "failed", reason: mpRes.error.message }
  if (invRes.error) return { status: "failed", reason: invRes.error.message }
  if (quoteRes.error) return { status: "failed", reason: quoteRes.error.message }
  if (commRes.error) return { status: "failed", reason: commRes.error.message }

  const workOrdersRaw = (woRes.data ?? []) as Array<{
    id: string
    work_order_number: number | null
    title: string
    status: string
    completed_at: string | null
    updated_at: string | null
    billable_to_customer: boolean | null
  }>

  const equipmentRows = (eqRes.data ?? []) as Array<{
    id: string
    name: string
    status: string
    serial_number: string | null
  }>

  const mpRows = (mpRes.data ?? []) as Array<{
    id: string
    name: string
    status: string
    next_due_date: string | null
    interval_value: number
    interval_unit: string
    equipment_id: string
  }>

  const equipmentNameById = new Map<string, string>()
  for (const e of equipmentRows) equipmentNameById.set(e.id, e.name)

  const recentWorkOrders: SummarizeCustomerHistoryWorkOrderLine[] = workOrdersRaw.map((w) => ({
    id: w.id,
    workOrderNumber: w.work_order_number,
    title: w.title,
    status: w.status,
    completedAt: w.completed_at,
    updatedAt: w.updated_at,
  }))

  const equipment: SummarizeCustomerHistoryEquipmentLine[] = equipmentRows.map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    serialNumber: e.serial_number,
  }))

  const maintenancePlans: SummarizeCustomerHistoryMaintenanceLine[] = mpRows.map((m) => ({
    id: m.id,
    name: m.name,
    equipmentName: equipmentNameById.get(m.equipment_id) ?? null,
    status: m.status,
    nextDueDate: m.next_due_date,
    intervalLabel: intervalLabel(m.interval_value, m.interval_unit),
  }))

  const openIssueStatuses = new Set(["open", "scheduled", "in_progress", "completed_pending_signature"])
  const openIssuesList: SummarizeCustomerHistoryOpenIssue[] = []

  for (const w of workOrdersRaw) {
    if (!openIssueStatuses.has(w.status)) continue
    const num = w.work_order_number != null ? `#${w.work_order_number}` : "—"
    openIssuesList.push({
      kind: "work_order",
      id: w.id,
      label: `Work order ${num} — ${w.title}`,
      detail: titleCaseStatus(w.status),
    })
  }

  let openInvoices: SummarizeCustomerHistoryInvoiceLine[] | null = null
  let quotes: SummarizeCustomerHistoryQuoteLine[] | null = null
  let financialStatus: string | null = null

  if (canViewFinancials) {
    const invRows = (invRes.data ?? []) as Array<{
      id: string
      invoice_number: string
      title: string
      status: string
      amount_cents: number
      due_date: string | null
    }>
    openInvoices =
      invRows.length === 0 ?
        []
      : invRows
          .filter((r) => isInvoiceOpenDb(String(r.status ?? "")))
          .slice(0, 8)
          .map((r) => ({
            id: r.id,
            invoiceNumber: String(r.invoice_number ?? ""),
            title: String(r.title ?? ""),
            statusUi: invoiceStatusDbToUi(String(r.status ?? "")),
            amountCents: Math.round(Number(r.amount_cents) || 0),
            dueDate: r.due_date,
          }))

    for (const inv of openInvoices) {
      const overdue =
        inv.dueDate && inv.statusUi !== "Paid" && inv.statusUi !== "Void" ?
          new Date(inv.dueDate).getTime() < Date.now()
        : false
      if (overdue) {
        openIssuesList.push({
          kind: "invoice",
          id: inv.id,
          label: `Invoice #${inv.invoiceNumber} — ${inv.title}`,
          detail: `Balance ${fmtMoney(inv.amountCents)} · due ${fmtShortDate(inv.dueDate) ?? "—"}`,
        })
      }
    }

    if (invRows.length === 0) {
      financialStatus = "No recent invoices were returned for this customer in the bounded snapshot."
    } else if (openInvoices.length === 0) {
      financialStatus =
        "No open invoice balances were found among the most recent invoice rows for this customer (they may already be paid or void)."
    } else {
      const totalOpenCents = openInvoices.reduce((s, r) => s + r.amountCents, 0)
      financialStatus = `Open invoices: ${openInvoices.length} (${fmtMoney(totalOpenCents)} total on listed rows). Review billing for current balances before collection outreach.`
    }
  }

  if (canViewQuotes) {
    const qRows = (quoteRes.data ?? []) as Array<{
      id: string
      quote_number: string
      title: string
      status: string
      amount_cents: number
      expires_at: string | null
    }>
    quotes =
      qRows.length === 0 ?
        []
      : qRows.map((q) => ({
          id: q.id,
          quoteNumber: String(q.quote_number ?? ""),
          title: String(q.title ?? ""),
          statusUi: quoteStatusDbToUi(String(q.status ?? "")),
          amountCents: Math.round(Number(q.amount_cents) || 0),
        }))

    const pendingQuoteStatuses = new Set(["draft", "sent", "pending_approval", "approved"])
    for (const q of qRows) {
      const st = String(q.status ?? "").toLowerCase()
      if (!pendingQuoteStatuses.has(st)) continue
      openIssuesList.push({
        kind: "quote",
        id: q.id,
        label: `Quote #${q.quote_number} — ${q.title}`,
        detail: `${quoteStatusDbToUi(st)} · ${fmtMoney(Math.round(Number(q.amount_cents) || 0))}`,
      })
    }
  }

  let recentCommunications: SummarizeCustomerHistoryCommunicationLine[] | null = null
  if (commRes.data && commRes.data.length > 0) {
    let commRows = commRes.data as CommunicationEventRow[]
    if (!canViewFinancials) {
      commRows = commRows.filter((r) => !isFinancialRow(r))
    }
    recentCommunications = commRows.slice(0, 8).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      channel: r.channel ?? null,
      direction: r.direction ?? null,
      title: r.title,
      summary: r.summary ?? null,
    }))
  }

  let latestCompletedBillableWorkOrderId: string | null = null
  let latestCompletedBillableWorkOrderNumber: number | null = null
  for (const w of workOrdersRaw) {
    if (w.status !== "completed" && w.status !== "completed_pending_signature") continue
    if (!w.completed_at) continue
    if (w.billable_to_customer === false) continue
    if (await workOrderIsAlreadyInvoiced(supabase, organizationId, w.id)) continue
    latestCompletedBillableWorkOrderId = w.id
    latestCompletedBillableWorkOrderNumber = w.work_order_number
    break
  }

  const showCreateInvoiceFromLatestWorkOrder =
    Boolean(canEditInvoices) && Boolean(latestCompletedBillableWorkOrderId)

  const loc =
    [customerRow.billing_city, customerRow.billing_state].filter(Boolean).join(", ") ||
    (customerRow.billing_address_line1 ? String(customerRow.billing_address_line1) : null)

  const contactBits: string[] = []
  if (mapped.billingEmail) contactBits.push(mapped.billingEmail)
  if (mapped.billingContactPhone) contactBits.push(mapped.billingContactPhone)
  const contactLine = contactBits.length > 0 ? ` Primary contacts on file: ${contactBits.join(" · ")}.` : ""

  const customerOverview = `${mapped.companyName}${loc ? ` (${loc})` : ""} — ${equipment.length} equipment record${equipment.length === 1 ? "" : "s"}, ${mpRows.filter((m) => m.status === "active").length} active maintenance plan${mpRows.filter((m) => m.status === "active").length === 1 ? "" : "s"}.${canViewFinancials ? "" : " Financial totals are hidden because this role cannot view financials."}${contactLine}`

  const completedRecent = workOrdersRaw.filter((w) => w.status === "completed" || w.status === "invoiced").slice(0, 5)
  const recentWorkPerformed =
    completedRecent.length === 0 ?
      "No recently completed or invoiced work orders showed up in the last few records. Check open jobs or broaden your review in Work Orders."
    : `Recent closed work includes: ${completedRecent
        .map((w) => {
          const num = w.work_order_number != null ? `#${w.work_order_number}` : "WO"
          const when = fmtShortDate(w.completed_at) ?? "date n/a"
          return `${num} “${w.title}” (${titleCaseStatus(w.status)}, ${when})`
        })
        .join("; ")}.`

  const openIssues =
    openIssuesList.length === 0 ?
      "No open work orders, overdue invoices, or pending quotes were detected in the bounded snapshot."
    : `${openIssuesList.length} open item(s): ${openIssuesList
        .slice(0, 6)
        .map((i) => i.label + (i.detail ? ` (${i.detail})` : ""))
        .join("; ")}${openIssuesList.length > 6 ? "…" : "."}`

  const upcoming = maintenancePlans.filter((m) => m.status === "active" && m.nextDueDate)
  const upcomingMaintenance =
    upcoming.length === 0 ?
      "No upcoming due dates on active maintenance plans in this snapshot (plans may be paused, expired, or undated)."
    : `Next maintenance touchpoints: ${upcoming
        .slice(0, 5)
        .map((m) => {
          const eq = m.equipmentName ? ` · ${m.equipmentName}` : ""
          return `“${m.name}”${eq} due ${fmtShortDate(m.nextDueDate) ?? "—"} (${m.intervalLabel})`
        })
        .join("; ")}.`

  const recommendedNextActions: string[] = []
  if (workOrdersRaw.some((w) => openIssueStatuses.has(w.status))) {
    recommendedNextActions.push("Close or schedule remaining open work orders and capture signatures where needed.")
  }
  if (canViewFinancials && openInvoices && openInvoices.some((i) => i.dueDate && new Date(i.dueDate) < new Date())) {
    recommendedNextActions.push("Follow up on overdue invoices before starting new major work.")
  }
  if (canViewQuotes && quotes && quotes.some((q) => /sent|pending/i.test(q.statusUi))) {
    recommendedNextActions.push("Review sent/pending quotes and update customers on approval status.")
  }
  if (upcoming.length > 0) {
    recommendedNextActions.push("Confirm upcoming PM windows with the customer and assigned technicians.")
  }
  if (recommendedNextActions.length === 0) {
    recommendedNextActions.push("Send a short recap to the customer and log the next touchpoint in Communications.")
  }

  const preview: SummarizeCustomerHistoryPreviewPayload = {
    customer: {
      id: customerId,
      companyName: mapped.companyName,
      billingCity: customerRow.billing_city,
      billingState: customerRow.billing_state,
    },
    financialsRedacted: !canViewFinancials,
    customerOverview,
    recentWorkPerformed,
    openIssues,
    upcomingMaintenance,
    financialStatus: canViewFinancials ? financialStatus : null,
    recommendedNextActions,
    recentWorkOrders,
    equipment,
    openIssuesList: openIssuesList.slice(0, 12),
    maintenancePlans,
    openInvoices,
    quotes,
    recentCommunications,
    latestCompletedBillableWorkOrderId,
    latestCompletedBillableWorkOrderNumber,
    showCreateInvoiceFromLatestWorkOrder,
  }

  return { status: "prepared", preview }
}
