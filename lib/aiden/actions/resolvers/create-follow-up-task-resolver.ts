import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CreateFollowUpTaskPreviewPayload, CreateFollowUpTaskPreviewRecord } from "@/lib/aiden/actions/resolvers/create-follow-up-task-types"
import { rankCustomerMatches } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import { mergeFollowUpAutomationConfig } from "@/lib/follow-up-automation/merge-config"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"
import { quoteStatusDbToUi } from "@/lib/org-quotes-invoices/map"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CreateFollowUpTaskResolverInput = {
  organizationId: string
  userId: string
  invoiceId?: string
  quoteId?: string
  workOrderId?: string
  equipmentId?: string
  maintenancePlanId?: string
  customerId?: string
  customerReference?: string
}

export type CreateFollowUpTaskResolverResult =
  | { status: "prepared"; preview: CreateFollowUpTaskPreviewPayload }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(dt.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function todayUtcYmd(): string {
  const dt = new Date()
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(dt.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function dueDateToScheduledIso(dueDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return `${todayUtcYmd()}T12:00:00.000Z`
  return `${dueDate}T12:00:00.000Z`
}

async function loadProfileLabel(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle()
  const row = data as { full_name?: string | null; email?: string | null } | null
  if (!row) return null
  const n = row.full_name?.trim()
  if (n) return n
  return row.email?.trim() ?? null
}

async function loadAutomationDefaults(supabase: SupabaseClient, organizationId: string) {
  const { data } = await supabase.from("follow_up_automation_settings").select("config").eq("organization_id", organizationId).maybeSingle()
  return mergeFollowUpAutomationConfig((data as { config?: unknown } | null)?.config ?? {})
}

async function loadActiveCustomersForRank(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Array<{ id: string; company_name: string; billing_name: string | null }>> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name, billing_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_archived", false)
    .limit(2500)
  if (error) return []
  return (data ?? []) as Array<{ id: string; company_name: string; billing_name: string | null }>
}

export async function resolveCreateFollowUpTaskPreview(
  supabase: SupabaseClient,
  input: CreateFollowUpTaskResolverInput,
): Promise<CreateFollowUpTaskResolverResult> {
  const organizationId = input.organizationId.trim()
  if (!UUID_RE.test(organizationId)) {
    return { status: "failed", reason: "Invalid organization id." }
  }

  const invId = input.invoiceId?.trim()
  const quoteId = input.quoteId?.trim()
  const woId = input.workOrderId?.trim()
  const eqId = input.equipmentId?.trim()
  const mpId = input.maintenancePlanId?.trim()
  let custId = input.customerId?.trim()
  const ref = input.customerReference?.trim()

  const anchorOrder = [
    { key: "invoice" as const, id: invId },
    { key: "quote" as const, id: quoteId },
    { key: "work_order" as const, id: woId },
    { key: "equipment" as const, id: eqId },
    { key: "maintenance_plan" as const, id: mpId },
    { key: "customer" as const, id: custId },
  ]
  const picked = anchorOrder.find((a) => a.id && UUID_RE.test(a.id))

  if (!picked) {
    const want = ref
    if (!want) {
      return {
        status: "needs_clarification",
        reason:
          "Open a customer, work order, invoice, quote, equipment, or maintenance plan, or name the customer for this follow-up task.",
        customerCandidates: [],
      }
    }
    const rows = await loadActiveCustomersForRank(supabase, organizationId)
    const ranked = rankCustomerMatches(want, rows)
    if (ranked.length === 0) {
      return {
        status: "needs_clarification",
        reason: `No active customer matched “${want}”. Try the company name on file or open the record in the app.`,
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
    custId = ranked[0]?.id
    if (!custId) return { status: "failed", reason: "Could not resolve customer match." }
  }

  const cfg = await loadAutomationDefaults(supabase, organizationId)
  let related: CreateFollowUpTaskPreviewRecord | null = null
  let reasonParts: string[] = []
  let suggestedAssignee: string | null = null

  if (picked?.key === "invoice" && picked.id) {
    const { data, error } = await supabase
      .from("org_invoices")
      .select("id, customer_id, invoice_number, title, status, amount_cents, due_date, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const inv = data as {
      id: string
      customer_id: string
      invoice_number: string
      title: string
      status: string
      amount_cents: number
      due_date: string | null
      archived_at: string | null
    } | null
    if (!inv || inv.archived_at) return { status: "failed", reason: "Invoice was not found or is archived." }
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", inv.customer_id)
      .maybeSingle()
    const c = cust as { id: string; company_name: string } | null
    const st = invoiceStatusDbToUi(String(inv.status ?? ""))
    related = {
      entityType: "invoice",
      entityId: inv.id,
      label: `Invoice #${inv.invoice_number} — ${inv.title}`,
      customerId: inv.customer_id,
      customerName: c?.company_name ?? null,
    }
    reasonParts.push(`Status ${st}.`)
    if (inv.due_date) reasonParts.push(`Due ${inv.due_date}.`)
    suggestedAssignee = cfg.invoiceFollowUps.defaultAssigneeUserId
  } else if (picked?.key === "quote" && picked.id) {
    const { data, error } = await supabase
      .from("org_quotes")
      .select("id, customer_id, quote_number, title, status, amount_cents, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const q = data as {
      id: string
      customer_id: string
      quote_number: string
      title: string
      status: string
      amount_cents: number
      archived_at: string | null
    } | null
    if (!q || q.archived_at) return { status: "failed", reason: "Quote was not found or is archived." }
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", q.customer_id)
      .maybeSingle()
    const c = cust as { id: string; company_name: string } | null
    related = {
      entityType: "quote",
      entityId: q.id,
      label: `Quote #${q.quote_number} — ${q.title}`,
      customerId: q.customer_id,
      customerName: c?.company_name ?? null,
    }
    reasonParts.push(`Quote status ${quoteStatusDbToUi(String(q.status ?? ""))}.`)
    suggestedAssignee = cfg.invoiceFollowUps.defaultAssigneeUserId
  } else if (picked?.key === "work_order" && picked.id) {
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, customer_id, title, status, work_order_number, assigned_user_id, is_archived")
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const wo = data as {
      id: string
      customer_id: string
      title: string
      status: string
      work_order_number: number | null
      assigned_user_id: string | null
      is_archived: boolean
    } | null
    if (!wo || wo.is_archived) return { status: "failed", reason: "Work order was not found or is archived." }
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", wo.customer_id)
      .maybeSingle()
    const c = cust as { id: string; company_name: string } | null
    const num = wo.work_order_number != null ? `#${wo.work_order_number}` : "WO"
    related = {
      entityType: "work_order",
      entityId: wo.id,
      label: `Work order ${num} — ${wo.title}`,
      customerId: wo.customer_id,
      customerName: c?.company_name ?? null,
    }
    reasonParts.push(`Work order status ${String(wo.status ?? "").replace(/_/g, " ")}.`)
    suggestedAssignee = wo.assigned_user_id
  } else if (picked?.key === "equipment" && picked.id) {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, customer_id, name, status, is_archived")
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const eq = data as { id: string; customer_id: string; name: string; status: string; is_archived: boolean } | null
    if (!eq || eq.is_archived) return { status: "failed", reason: "Equipment was not found or is archived." }
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", eq.customer_id)
      .maybeSingle()
    const c = cust as { id: string; company_name: string } | null
    related = {
      entityType: "equipment",
      entityId: eq.id,
      label: `Equipment — ${eq.name}`,
      customerId: eq.customer_id,
      customerName: c?.company_name ?? null,
    }
    reasonParts.push(`Equipment status ${eq.status}.`)
  } else if (picked?.key === "maintenance_plan" && picked.id) {
    const { data, error } = await supabase
      .from("maintenance_plans")
      .select("id, customer_id, equipment_id, name, status, next_due_date, is_archived")
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const mp = data as {
      id: string
      customer_id: string
      equipment_id: string
      name: string
      status: string
      next_due_date: string | null
      is_archived: boolean
    } | null
    if (!mp || mp.is_archived) return { status: "failed", reason: "Maintenance plan was not found or is archived." }
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", mp.customer_id)
      .maybeSingle()
    const c = cust as { id: string; company_name: string } | null
    let eqName: string | null = null
    const { data: eqRow } = await supabase
      .from("equipment")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("id", mp.equipment_id)
      .maybeSingle()
    eqName = (eqRow as { name?: string } | null)?.name ?? null
    related = {
      entityType: "maintenance_plan",
      entityId: mp.id,
      label: eqName ? `Plan “${mp.name}” · ${eqName}` : `Plan “${mp.name}”`,
      customerId: mp.customer_id,
      customerName: c?.company_name ?? null,
    }
    reasonParts.push(`Plan status ${mp.status}.`)
    if (mp.next_due_date) reasonParts.push(`Next due ${mp.next_due_date}.`)
    suggestedAssignee = cfg.maintenanceReminders.defaultAssigneeUserId
  } else if (custId && UUID_RE.test(custId)) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .eq("id", custId)
      .eq("is_archived", false)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const c = data as { id: string; company_name: string } | null
    if (!c) return { status: "failed", reason: "Customer was not found." }
    related = {
      entityType: "customer",
      entityId: c.id,
      label: c.company_name,
      customerId: c.id,
      customerName: c.company_name,
    }
    reasonParts.push("General account follow-up.")
  }

  if (!related) {
    return { status: "failed", reason: "Could not resolve a target record for this follow-up task." }
  }

  const dueDate = addDaysYmd(todayUtcYmd(), 5)
  const scheduledForIso = dueDateToScheduledIso(dueDate)

  const title = `Follow up: ${related.label}`.slice(0, 200)
  const notes = [
    "Prepared by AIden — edit before creating.",
    "",
    `Related: ${related.label}`,
    related.customerName ? `Customer: ${related.customerName}` : null,
    "",
    "Next steps: confirm timing with the customer and update the work record after contact.",
  ]
    .filter(Boolean)
    .join("\n")

  let assigneeUserId = suggestedAssignee && UUID_RE.test(suggestedAssignee) ? suggestedAssignee : null
  let assigneeLabel: string | null = null
  if (assigneeUserId) {
    assigneeLabel = await loadProfileLabel(supabase, assigneeUserId)
  }
  if (!assigneeLabel && assigneeUserId) assigneeLabel = "Team member"
  if (!assigneeUserId) assigneeLabel = "Unassigned"

  const reason = reasonParts.length > 0 ? reasonParts.join(" ") : "Operational follow-up from workspace context."

  const preview: CreateFollowUpTaskPreviewPayload = {
    title,
    notes,
    dueDate,
    scheduledForIso,
    assigneeUserId,
    assigneeLabel,
    reason,
    relatedRecord: related,
  }

  return { status: "prepared", preview }
}
