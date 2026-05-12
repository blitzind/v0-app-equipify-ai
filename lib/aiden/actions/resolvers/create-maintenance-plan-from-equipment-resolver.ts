import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { PlanInterval, WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { rankCustomerMatches, normalizeMatchKey } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import type { CreateMaintenancePlanFromEquipmentPreviewPayload } from "@/lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-types"
import { computeNextDueDate } from "@/lib/maintenance-plans/db-map"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CreateMaintenancePlanFromEquipmentResolverInput = {
  organizationId: string
  userId: string
  userMessage: string
  equipmentId?: string
  customerId?: string
  customerReference?: string
  equipmentReference?: string
}

export type CreateMaintenancePlanFromEquipmentResolverResult =
  | { status: "prepared"; preview: CreateMaintenancePlanFromEquipmentPreviewPayload }
  | {
      status: "needs_clarification"
      reason: string
      customerCandidates: Array<{ id: string; label: string }>
    }
  | { status: "failed"; reason: string }

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

function inferPlanIntervalFromMessage(normalized: string): { interval: PlanInterval; customDays: number } {
  if (/\bannual|yearly\b/.test(normalized)) return { interval: "Annual", customDays: 0 }
  if (/\bsemi-annual|semiannual|biannual\b/.test(normalized)) return { interval: "Semi-Annual", customDays: 0 }
  if (/\bquarterly|every\s+3\s*months?\b/.test(normalized)) return { interval: "Quarterly", customDays: 0 }
  if (/\bmonthly\b/.test(normalized)) return { interval: "Monthly", customDays: 0 }
  if (/\bweekly\b/.test(normalized)) return { interval: "Custom", customDays: 7 }
  return { interval: "Quarterly", customDays: 0 }
}

function inferWorkOrderTypeFromMessage(normalized: string): WorkOrderType {
  if (/\binspection\b/.test(normalized)) return "Inspection"
  return "PM"
}

function intervalShortLabel(interval: PlanInterval): string {
  switch (interval) {
    case "Annual":
      return "Annual"
    case "Semi-Annual":
      return "Semi-annual"
    case "Quarterly":
      return "Quarterly"
    case "Monthly":
      return "Monthly"
    case "Custom":
      return "Custom"
    default:
      return "PM"
  }
}

function rankEquipmentMatches(
  reference: string,
  rows: Array<{ id: string; name: string; category: string | null }>,
): Array<{ id: string; score: number; label: string }> {
  const q = normalizeMatchKey(reference)
  if (!q) return []
  const qTokens = new Set(q.split(" ").filter((t) => t.length > 0))
  const scored = rows.map((e) => {
    const name = normalizeMatchKey(e.name)
    const cat = e.category ? normalizeMatchKey(e.category) : ""
    let score = 0
    if (q === name) score = 100
    else if (name.includes(q) || (name.length >= 3 && q.includes(name))) score = 92
    else if (cat && (cat.includes(q) || (cat.length >= 3 && q.includes(cat)))) score = 78
    else {
      const nameWords = new Set(name.split(" ").filter((t) => t.length > 1))
      let overlap = 0
      for (const t of qTokens) if (nameWords.has(t)) overlap++
      const denom = Math.max(1, qTokens.size)
      const ratio = overlap / denom
      if (ratio >= 0.5 && overlap >= 1) score = 58 + Math.floor(ratio * 18)
    }
    const label = e.category?.trim() ? `${e.name} (${e.category})` : e.name
    return { id: e.id, score, label }
  })
  return scored.filter((s) => s.score >= 58).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
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

export async function resolveCreateMaintenancePlanFromEquipmentPreview(
  supabase: SupabaseClient,
  input: CreateMaintenancePlanFromEquipmentResolverInput,
): Promise<CreateMaintenancePlanFromEquipmentResolverResult> {
  const organizationId = input.organizationId.trim()
  if (!UUID_RE.test(organizationId)) {
    return { status: "failed", reason: "Invalid organization id." }
  }

  const eqIdIn = input.equipmentId?.trim()
  let custId = input.customerId?.trim()
  const custRef = input.customerReference?.trim()
  const eqRef = input.equipmentReference?.trim()
  const normalizedMsg = normalizeMessage(input.userMessage)
  const { interval, customDays } = inferPlanIntervalFromMessage(normalizedMsg)
  const workOrderTypeUi = inferWorkOrderTypeFromMessage(normalizedMsg)
  const workOrderPriorityUi: WorkOrderPriority = "Normal"
  const preferredServiceTime = "08:00"

  let resolvedEquipmentId: string | null = null

  if (eqIdIn && UUID_RE.test(eqIdIn)) {
    resolvedEquipmentId = eqIdIn
  } else if (custId && UUID_RE.test(custId) && eqRef) {
    const { data: eqRows, error: eqListErr } = await supabase
      .from("equipment")
      .select("id, name, category")
      .eq("organization_id", organizationId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .limit(500)
    if (eqListErr) return { status: "failed", reason: eqListErr.message }
    const rankedEq = rankEquipmentMatches(eqRef, (eqRows ?? []) as Array<{ id: string; name: string; category: string | null }>)
    if (rankedEq.length === 0) {
      return {
        status: "needs_clarification",
        reason: `No equipment on this customer matched “${eqRef}”. Try the exact asset name or open the equipment record.`,
        customerCandidates: [],
      }
    }
    if (rankedEq.length > 1 && rankedEq[0] && rankedEq[1] && rankedEq[0].score === rankedEq[1].score) {
      return {
        status: "needs_clarification",
        reason: "Several assets match that description. Open the equipment record or pick a clearer name.",
        customerCandidates: rankedEq.slice(0, 8).map((r) => ({ id: r.id, label: r.label })),
      }
    }
    resolvedEquipmentId = rankedEq[0]?.id ?? null
  } else if (custRef && eqRef) {
    const rows = await loadActiveCustomersForRank(supabase, organizationId)
    const ranked = rankCustomerMatches(custRef, rows)
    if (ranked.length === 0) {
      return {
        status: "needs_clarification",
        reason: `No active customer matched “${custRef}”. Try the company name on file.`,
        customerCandidates: [],
      }
    }
    if (ranked.length > 1 && ranked[0] && ranked[1] && ranked[0].score === ranked[1].score) {
      return {
        status: "needs_clarification",
        reason: "Several customers match that name. Pick one from the list or open the customer record.",
        customerCandidates: ranked.slice(0, 8).map((r) => ({ id: r.id, label: r.label })),
      }
    }
    custId = ranked[0]?.id
    if (!custId) return { status: "failed", reason: "Could not resolve customer match." }

    const { data: eqRows, error: eqListErr } = await supabase
      .from("equipment")
      .select("id, name, category")
      .eq("organization_id", organizationId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .limit(500)
    if (eqListErr) return { status: "failed", reason: eqListErr.message }
    const rankedEq = rankEquipmentMatches(eqRef, (eqRows ?? []) as Array<{ id: string; name: string; category: string | null }>)
    if (rankedEq.length === 0) {
      return {
        status: "needs_clarification",
        reason: `No equipment matched “${eqRef}” for that customer.`,
        customerCandidates: [],
      }
    }
    if (rankedEq.length > 1 && rankedEq[0] && rankedEq[1] && rankedEq[0].score === rankedEq[1].score) {
      return {
        status: "needs_clarification",
        reason: "Several assets match that description. Open the equipment record or be more specific.",
        customerCandidates: rankedEq.slice(0, 8).map((r) => ({ id: r.id, label: r.label })),
      }
    }
    resolvedEquipmentId = rankedEq[0]?.id ?? null
  } else {
    return {
      status: "needs_clarification",
      reason:
        "Open an equipment record (or name the customer and asset, for example “quarterly plan for Acme’s pump”) so AIden can build this plan.",
      customerCandidates: [],
    }
  }

  if (!resolvedEquipmentId || !UUID_RE.test(resolvedEquipmentId)) {
    return { status: "failed", reason: "Could not resolve equipment for this plan." }
  }

  const { data: eqRow, error: eqErr } = await supabase
    .from("equipment")
    .select(
      "id, name, serial_number, customer_id, category, location_label, notes, last_service_at, is_archived, archived_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", resolvedEquipmentId)
    .maybeSingle()
  if (eqErr) return { status: "failed", reason: eqErr.message }
  const eq = eqRow as {
    id: string
    name: string
    serial_number: string | null
    customer_id: string
    category: string | null
    location_label: string | null
    notes: string | null
    last_service_at: string | null
    is_archived: boolean | null
    archived_at: string | null
  } | null
  if (!eq || eq.archived_at || eq.is_archived) {
    return { status: "failed", reason: "Equipment was not found or is archived." }
  }

  custId = eq.customer_id
  if (!custId || !UUID_RE.test(custId)) {
    return { status: "failed", reason: "Equipment has no valid customer link." }
  }

  const { data: custRow, error: custErr } = await supabase
    .from("customers")
    .select("id, company_name, status, is_archived, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", custId)
    .maybeSingle()
  if (custErr) return { status: "failed", reason: custErr.message }
  const customer = custRow as {
    id: string
    company_name: string
    status: string
    is_archived: boolean | null
    archived_at: string | null
  } | null
  if (!customer || customer.archived_at || customer.is_archived || customer.status !== "active") {
    return { status: "failed", reason: "Customer was not found, is inactive, or is archived." }
  }

  let techPick: { selectionId: string | null; label: string | null } = { selectionId: null, label: null }
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

  const lastYmd =
    eq.last_service_at && /^\d{4}-\d{2}-\d{2}/.test(eq.last_service_at) ? eq.last_service_at.slice(0, 10) : null
  const baseLast = lastYmd && /^\d{4}-\d{2}-\d{2}$/.test(lastYmd) ? lastYmd : todayUtcYmd()
  const nextDueDate = computeNextDueDate(baseLast, interval, customDays)

  const ivLabel = intervalShortLabel(interval)
  const planName = `${ivLabel} — ${eq.name}`.slice(0, 500)

  const defaultScope =
    workOrderTypeUi === "Inspection" ?
      `Annual inspection and safety checks for ${eq.name}. Edit checklist details after the plan is created if needed.`
    : `Recurring preventive maintenance for ${eq.name}. Standard PM scope — adjust line items after creation if needed.`

  let serviceScope = defaultScope
  if (eq.notes?.trim()) {
    serviceScope = eq.notes.trim().slice(0, 4000)
  }

  const estimatedDurationMinutes = workOrderTypeUi === "Inspection" ? 120 : 60

  const preview: CreateMaintenancePlanFromEquipmentPreviewPayload = {
    customer: { id: customer.id, companyName: customer.company_name },
    equipment: {
      id: eq.id,
      name: eq.name,
      serialNumber: eq.serial_number,
      category: eq.category,
      location: eq.location_label,
    },
    planName,
    intervalUi: interval,
    customIntervalDays: customDays,
    nextDueDate,
    lastServiceDate: lastYmd,
    serviceScope,
    estimatedDurationMinutes,
    workOrderTypeUi,
    workOrderPriorityUi,
    preferredServiceTime,
    technicianSelectionId: techPick.selectionId,
    technicianLabel: techPick.label,
    autoCreateWorkOrder: true,
    notes: "",
  }

  return { status: "prepared", preview }
}
