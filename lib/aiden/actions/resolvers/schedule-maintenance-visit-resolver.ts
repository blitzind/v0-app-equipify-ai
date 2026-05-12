import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { rankCustomerMatches } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import type { ScheduleMaintenanceVisitPreviewPayload } from "@/lib/aiden/actions/resolvers/schedule-maintenance-visit-types"
import { parseServicesJsonb } from "@/lib/maintenance-plans/db-map"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ScheduleMaintenanceVisitResolverInput = {
  organizationId: string
  userId: string
  userMessage: string
  maintenancePlanId?: string
  equipmentId?: string
  customerId?: string
  customerReference?: string
}

export type ScheduleMaintenanceVisitResolverResult =
  | { status: "prepared"; preview: ScheduleMaintenanceVisitPreviewPayload }
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

function normalizeMessage(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase()
}

/** Best-effort date/time hints from the user utterance (no locale intelligence). */
function extractScheduleDateHint(normalizedMessage: string): { dateYmd: string; timeHhMm: string } | null {
  const iso = normalizedMessage.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso?.[1]) return { dateYmd: iso[1], timeHhMm: "08:00" }

  if (/\btomorrow\b/.test(normalizedMessage)) {
    return { dateYmd: addDaysYmd(todayUtcYmd(), 1), timeHhMm: "08:00" }
  }
  if (/\btoday\b/.test(normalizedMessage)) {
    return { dateYmd: todayUtcYmd(), timeHhMm: "09:00" }
  }

  const mdy = normalizedMessage.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/)
  if (mdy) {
    const mo = Number.parseInt(mdy[1] ?? "1", 10)
    const da = Number.parseInt(mdy[2] ?? "1", 10)
    let yr = Number.parseInt(mdy[3] ?? "0", 10)
    if (yr < 100) yr += 2000
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31 && yr >= 2000 && yr <= 2100) {
      const dt = new Date(Date.UTC(yr, mo - 1, da))
      if (!Number.isNaN(dt.getTime())) {
        const yy = dt.getUTCFullYear()
        const mm = String(dt.getUTCMonth() + 1).padStart(2, "0")
        const dd = String(dt.getUTCDate()).padStart(2, "0")
        return { dateYmd: `${yy}-${mm}-${dd}`, timeHhMm: "08:00" }
      }
    }
  }

  const t24 = normalizedMessage.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (t24) {
    return { dateYmd: todayUtcYmd(), timeHhMm: `${t24[1]!.padStart(2, "0")}:${t24[2]}` }
  }

  return null
}

function formatLocationSummary(c: {
  billing_address_line1: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
}): string {
  const parts = [
    c.billing_address_line1?.trim(),
    [c.billing_city, c.billing_state].filter(Boolean).join(", ") || null,
    c.billing_postal_code?.trim(),
  ].filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(" · ") : "Service address on file (see customer profile)."
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

async function loadTechnicianLabel(
  supabase: SupabaseClient,
  organizationId: string,
  assignedTechnicianId: string | null,
  assignedUserId: string | null,
): Promise<{ selectionId: string | null; label: string | null }> {
  if (assignedTechnicianId && UUID_RE.test(assignedTechnicianId)) {
    const { data } = await supabase
      .from("technicians")
      .select("full_name")
      .eq("organization_id", organizationId)
      .eq("id", assignedTechnicianId)
      .maybeSingle()
    const nm = (data as { full_name?: string | null } | null)?.full_name?.trim()
    return { selectionId: assignedTechnicianId, label: nm ?? "Assigned technician" }
  }
  if (assignedUserId && UUID_RE.test(assignedUserId)) {
    const { data } = await supabase.from("profiles").select("full_name, email").eq("id", assignedUserId).maybeSingle()
    const row = data as { full_name?: string | null; email?: string | null } | null
    const n = row?.full_name?.trim() || row?.email?.trim()
    return { selectionId: assignedUserId, label: n ?? "Assigned user" }
  }
  return { selectionId: null, label: null }
}

export async function resolveScheduleMaintenanceVisitPreview(
  supabase: SupabaseClient,
  input: ScheduleMaintenanceVisitResolverInput,
): Promise<ScheduleMaintenanceVisitResolverResult> {
  const organizationId = input.organizationId.trim()
  if (!UUID_RE.test(organizationId)) {
    return { status: "failed", reason: "Invalid organization id." }
  }

  const mpId = input.maintenancePlanId?.trim()
  const eqId = input.equipmentId?.trim()
  let custId = input.customerId?.trim()
  const ref = input.customerReference?.trim()
  const normalizedMsg = normalizeMessage(input.userMessage)

  const anchorOrder = [
    { key: "maintenance_plan" as const, id: mpId },
    { key: "equipment" as const, id: eqId },
    { key: "customer" as const, id: custId },
  ]
  const picked = anchorOrder.find((a) => a.id && UUID_RE.test(a.id!))

  if (!picked) {
    if (!ref) {
      return {
        status: "needs_clarification",
        reason:
          "Open a customer, equipment, or maintenance plan (or name the customer) so AIden can prepare this visit.",
        customerCandidates: [],
      }
    }
    const rows = await loadActiveCustomersForRank(supabase, organizationId)
    const ranked = rankCustomerMatches(ref, rows)
    if (ranked.length === 0) {
      return {
        status: "needs_clarification",
        reason: `No active customer matched “${ref}”. Try the company name on file or open the customer record.`,
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

  let resolvedPlanId: string | null = null
  let resolvedEquipmentId: string | null = null
  let serviceTypeUi: WorkOrderType = "PM"
  let priorityUi: WorkOrderPriority = "Normal"
  let preferredTime = "08:00"
  let planName: string | null = null
  let techPick: { selectionId: string | null; label: string | null } = { selectionId: null, label: null }
  let nextDue: string | null = null

  if (picked?.key === "maintenance_plan" && picked.id) {
    resolvedPlanId = picked.id
    const { data, error } = await supabase
      .from("maintenance_plans")
      .select(
        "id, customer_id, equipment_id, name, next_due_date, assigned_technician_id, assigned_user_id, services, archived_at",
      )
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const plan = data as {
      id: string
      customer_id: string
      equipment_id: string | null
      name: string
      next_due_date: string | null
      assigned_technician_id: string | null
      assigned_user_id: string | null
      services: unknown
      archived_at: string | null
    } | null
    if (!plan || plan.archived_at) {
      return { status: "failed", reason: "Maintenance plan was not found or is archived." }
    }
    custId = plan.customer_id
    resolvedEquipmentId = plan.equipment_id
    planName = plan.name?.trim() || "Maintenance plan"
    const svc = parseServicesJsonb(plan.services)
    serviceTypeUi = svc.workOrderType
    priorityUi = svc.workOrderPriority
    preferredTime = svc.preferredServiceTime?.trim() || "08:00"
    nextDue = plan.next_due_date
    techPick = await loadTechnicianLabel(
      supabase,
      organizationId,
      plan.assigned_technician_id,
      plan.assigned_user_id,
    )
  } else if (picked?.key === "equipment" && picked.id) {
    resolvedEquipmentId = picked.id
    const { data, error } = await supabase
      .from("equipment")
      .select("id, name, serial_number, customer_id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", picked.id)
      .maybeSingle()
    if (error) return { status: "failed", reason: error.message }
    const eq = data as {
      id: string
      name: string
      serial_number: string | null
      customer_id: string
      archived_at: string | null
    } | null
    if (!eq || eq.archived_at) return { status: "failed", reason: "Equipment was not found or is archived." }
    custId = eq.customer_id

    const { data: lastWo } = await supabase
      .from("work_orders")
      .select("assigned_technician_id, assigned_user_id")
      .eq("organization_id", organizationId)
      .eq("equipment_id", eq.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const wo = lastWo as { assigned_technician_id?: string | null; assigned_user_id?: string | null } | null
    if (wo?.assigned_technician_id || wo?.assigned_user_id) {
      techPick = await loadTechnicianLabel(
        supabase,
        organizationId,
        wo.assigned_technician_id ?? null,
        wo.assigned_user_id ?? null,
      )
    }

    const { data: planRow } = await supabase
      .from("maintenance_plans")
      .select("id, assigned_technician_id, assigned_user_id, next_due_date, name, services")
      .eq("organization_id", organizationId)
      .eq("equipment_id", eq.id)
      .eq("customer_id", custId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (planRow) {
      const pr = planRow as {
        id: string
        assigned_technician_id: string | null
        assigned_user_id: string | null
        next_due_date: string | null
        name: string
        services: unknown
      }
      resolvedPlanId = pr.id
      planName = pr.name?.trim() || null
      nextDue = pr.next_due_date
      if (!techPick.selectionId) {
        techPick = await loadTechnicianLabel(supabase, organizationId, pr.assigned_technician_id, pr.assigned_user_id)
      }
      const svc = parseServicesJsonb(pr.services)
      serviceTypeUi = svc.workOrderType
      priorityUi = svc.workOrderPriority
      preferredTime = svc.preferredServiceTime?.trim() || preferredTime
    }
  }

  if (!custId || !UUID_RE.test(custId)) {
    return { status: "failed", reason: "Could not resolve customer for this visit." }
  }

  const { data: custRow, error: custErr } = await supabase
    .from("customers")
    .select(
      "id, company_name, billing_address_line1, billing_city, billing_state, billing_postal_code, status, is_archived, archived_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", custId)
    .maybeSingle()
  if (custErr) return { status: "failed", reason: custErr.message }
  const customer = custRow as {
    id: string
    company_name: string
    billing_address_line1: string | null
    billing_city: string | null
    billing_state: string | null
    billing_postal_code: string | null
    status: string
    is_archived: boolean | null
    archived_at: string | null
  } | null
  if (!customer || customer.archived_at || customer.is_archived || customer.status !== "active") {
    return { status: "failed", reason: "Customer was not found, is inactive, or is archived." }
  }

  let equipment: ScheduleMaintenanceVisitPreviewPayload["equipment"] = null
  if (resolvedEquipmentId && UUID_RE.test(resolvedEquipmentId)) {
    const { data: eqData, error: eqErr } = await supabase
      .from("equipment")
      .select("id, name, serial_number, customer_id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", resolvedEquipmentId)
      .maybeSingle()
    if (!eqErr && eqData) {
      const er = eqData as {
        id: string
        name: string
        serial_number: string | null
        customer_id: string
        archived_at: string | null
      }
      if (!er.archived_at && er.customer_id === custId) {
        equipment = { id: er.id, name: er.name, serialNumber: er.serial_number }
      }
    }
  }

  const dateFromMessage = extractScheduleDateHint(normalizedMsg)
  let suggestedDate: string
  let suggestedTime: string
  let dateSuggested: boolean

  if (dateFromMessage) {
    suggestedDate = dateFromMessage.dateYmd
    suggestedTime = dateFromMessage.timeHhMm
    dateSuggested = false
  } else if (nextDue && /^\d{4}-\d{2}-\d{2}$/.test(nextDue)) {
    suggestedDate = nextDue
    suggestedTime = preferredTime.length >= 4 ? preferredTime.slice(0, 5) : "08:00"
    dateSuggested = true
  } else if (picked?.key === "equipment" || picked?.key === "maintenance_plan") {
    suggestedDate = addDaysYmd(todayUtcYmd(), 7)
    suggestedTime = preferredTime.length >= 4 ? preferredTime.slice(0, 5) : "08:00"
    dateSuggested = true
  } else {
    return {
      status: "needs_clarification",
      reason:
        "Pick a visit date in your message (for example “tomorrow” or “2026-06-15”), or open equipment or a maintenance plan so AIden can suggest the next due date.",
      customerCandidates: [],
    }
  }

  const serviceReason =
    planName ?
      `${planName}: scheduled maintenance / service visit.`
    : equipment ?
      `Service visit for ${equipment.name}.`
    : `Scheduled service visit for ${customer.company_name}.`

  const preview: ScheduleMaintenanceVisitPreviewPayload = {
    customer: {
      id: customer.id,
      companyName: customer.company_name,
      billingAddressLine1: customer.billing_address_line1,
      billingCity: customer.billing_city,
      billingState: customer.billing_state,
      billingPostalCode: customer.billing_postal_code,
    },
    locationSummary: formatLocationSummary(customer),
    equipment,
    serviceTypeUi,
    priorityUi,
    serviceReason,
    durationMinutes: serviceTypeUi === "PM" ? 60 : 120,
    suggestedDate,
    suggestedTime,
    dateSuggested,
    technicianSelectionId: techPick.selectionId,
    technicianLabel: techPick.label,
    notes: `AIDEN_PREPARED_ACTION=schedule_maintenance_visit\n${planName ? `Plan: ${planName}\n` : ""}`.trim(),
    maintenancePlanId: resolvedPlanId,
  }

  return { status: "prepared", preview }
}
