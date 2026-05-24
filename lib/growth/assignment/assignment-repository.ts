import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAssignmentRunRecord,
  GrowthLeadAssignmentSource,
  GrowthSalesOwnershipDashboard,
} from "@/lib/growth/assignment/assignment-types"
import { GROWTH_LEAD_ASSIGNMENT_QA_MARKER } from "@/lib/growth/assignment/assignment-types"
import { listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"

type RunRow = {
  id: string
  run_mode: string
  scanned: number
  assigned: number
  skipped_manual: number
  skipped_capacity: number
  skipped_no_rep: number
  failed: number
  qa_marker: string
  started_at: string
  finished_at: string | null
  created_by: string | null
}

type LeadRow = {
  id: string
  company_name: string
  assigned_to: string | null
  assigned_at: string | null
  assignment_source: string | null
  status: string
  next_best_action: string | null
  call_priority_tier: string | null
  executive_priority_tier: string | null
  score: number | null
}

function leadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("assignment_runs")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_timeline_events")
}

function mapRunRow(row: RunRow): GrowthAssignmentRunRecord {
  return {
    id: row.id,
    runMode: row.run_mode as "live" | "dry_run",
    scanned: row.scanned,
    assigned: row.assigned,
    skippedManual: row.skipped_manual,
    skippedCapacity: row.skipped_capacity,
    skippedNoRep: row.skipped_no_rep,
    failed: row.failed,
    qaMarker: row.qa_marker,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdBy: row.created_by,
  }
}

const ACTIVE_STATUSES = ["archived", "converted", "disqualified"]

function isActiveLead(status: string): boolean {
  return !ACTIVE_STATUSES.includes(status)
}

function needsAction(lead: LeadRow): boolean {
  const nba = lead.next_best_action ?? ""
  return (
    nba.startsWith("call_") ||
    nba.startsWith("owner_") ||
    nba.startsWith("immediate_") ||
    nba === "manual_review" ||
    nba === "retry_call"
  )
}

function isHighPriorityUnassigned(lead: LeadRow): boolean {
  if (lead.assigned_to) return false
  if (lead.executive_priority_tier === "executive_now" || lead.executive_priority_tier === "priority") return true
  if (lead.call_priority_tier === "critical" || lead.call_priority_tier === "high") return true
  return (lead.score ?? 0) >= 70
}

export async function listUnassignedGrowthLeads(
  admin: SupabaseClient,
  limit: number,
): Promise<LeadRow[]> {
  const { data, error } = await leadsTable(admin)
    .select(
      "id, company_name, assigned_to, assigned_at, assignment_source, status, next_best_action, call_priority_tier, executive_priority_tier, score, state, city, crm_detected, field_service_stack_detected, source_kind",
    )
    .is("assigned_to", null)
    .not("status", "in", '("archived","converted","disqualified")')
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as LeadRow[]
}

export async function countUnassignedGrowthLeads(admin: SupabaseClient): Promise<number> {
  const { count, error } = await leadsTable(admin)
    .select("id", { count: "exact", head: true })
    .is("assigned_to", null)
    .not("status", "in", '("archived","converted","disqualified")')

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function insertGrowthAssignmentRun(
  admin: SupabaseClient,
  input: {
    runMode: "live" | "dry_run"
    scanned: number
    assigned: number
    skippedManual: number
    skippedCapacity: number
    skippedNoRep: number
    failed: number
    createdBy: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthAssignmentRunRecord> {
  const { data, error } = await runsTable(admin)
    .insert({
      run_mode: input.runMode,
      scanned: input.scanned,
      assigned: input.assigned,
      skipped_manual: input.skippedManual,
      skipped_capacity: input.skippedCapacity,
      skipped_no_rep: input.skippedNoRep,
      failed: input.failed,
      qa_marker: GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
      finished_at: new Date().toISOString(),
      created_by: input.createdBy,
      metadata: input.metadata ?? { qaMarker: GROWTH_LEAD_ASSIGNMENT_QA_MARKER },
    })
    .select(
      "id, run_mode, scanned, assigned, skipped_manual, skipped_capacity, skipped_no_rep, failed, qa_marker, started_at, finished_at, created_by",
    )
    .single()

  if (error) throw new Error(error.message)
  return mapRunRow(data as RunRow)
}

export async function fetchLatestGrowthAssignmentRun(
  admin: SupabaseClient,
): Promise<GrowthAssignmentRunRecord | null> {
  const { data, error } = await runsTable(admin)
    .select(
      "id, run_mode, scanned, assigned, skipped_manual, skipped_capacity, skipped_no_rep, failed, qa_marker, started_at, finished_at, created_by",
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRunRow(data as RunRow) : null
}

export async function fetchGrowthSalesOwnershipDashboard(
  admin: SupabaseClient,
): Promise<GrowthSalesOwnershipDashboard> {
  const [reps, lastRun, leadsResult, activityResult] = await Promise.all([
    listGrowthRepRoster(admin),
    fetchLatestGrowthAssignmentRun(admin),
    leadsTable(admin)
      .select(
        "id, company_name, assigned_to, assigned_at, assignment_source, status, next_best_action, call_priority_tier, executive_priority_tier, score",
      )
      .not("status", "in", '("archived","converted","disqualified")')
      .limit(500),
    timelineTable(admin)
      .select("lead_id, event_type, summary, occurred_at")
      .in("event_type", [
        "lead_assigned",
        "lead_reassigned",
        "lead_unassigned",
        "assignment_rule_applied",
        "assignment_skipped",
      ])
      .order("occurred_at", { ascending: false })
      .limit(20),
  ])

  if (leadsResult.error) throw new Error(leadsResult.error.message)
  if (activityResult.error) throw new Error(activityResult.error.message)

  const leads = (leadsResult.data ?? []) as LeadRow[]
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))

  let unassignedCount = 0
  let highPriorityUnassignedCount = 0
  const ownerCounts = new Map<string, { leadCount: number; needsActionCount: number }>()

  for (const lead of leads) {
    if (!lead.assigned_to) {
      unassignedCount += 1
      if (isHighPriorityUnassigned(lead)) highPriorityUnassignedCount += 1
      continue
    }
    const bucket = ownerCounts.get(lead.assigned_to) ?? { leadCount: 0, needsActionCount: 0 }
    bucket.leadCount += 1
    if (needsAction(lead)) bucket.needsActionCount += 1
    ownerCounts.set(lead.assigned_to, bucket)
  }

  const leadsByOwner = reps.map((rep) => {
    const counts = ownerCounts.get(rep.userId) ?? { leadCount: 0, needsActionCount: 0 }
    return {
      userId: rep.userId,
      email: rep.email,
      displayName: rep.displayName,
      status: rep.status,
      leadCount: counts.leadCount,
      needsActionCount: counts.needsActionCount,
      isOverCapacity: rep.isOverCapacity,
    }
  })

  const recentActivity = (activityResult.data ?? []).map((event) => {
    const lead = leadById.get(event.lead_id as string)
    return {
      leadId: event.lead_id as string,
      companyName: lead?.company_name ?? "Lead",
      eventType: event.event_type as string,
      summary: (event.summary as string | null) ?? null,
      occurredAt: event.occurred_at as string,
    }
  })

  return {
    qaMarker: GROWTH_LEAD_ASSIGNMENT_QA_MARKER,
    totalLeads: leads.length,
    unassignedCount,
    highPriorityUnassignedCount,
    overCapacityRepCount: reps.filter((rep) => rep.isOverCapacity).length,
    leadsByOwner,
    recentActivity,
    lastRun,
  }
}

export async function listGrowthLeadsByAssignmentFilter(
  admin: SupabaseClient,
  input: {
    assignedTo?: string | null
    unassigned?: boolean
    assignmentSource?: GrowthLeadAssignmentSource
    limit?: number
    offset?: number
  },
): Promise<LeadRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)

  let query = leadsTable(admin)
    .select(
      "id, company_name, assigned_to, assigned_at, assignment_source, status, next_best_action, call_priority_tier, executive_priority_tier, score",
    )
    .order("updated_at", { ascending: false })

  if (input.unassigned) {
    query = query.is("assigned_to", null)
  } else if (input.assignedTo) {
    query = query.eq("assigned_to", input.assignedTo)
  }

  if (input.assignmentSource) {
    query = query.eq("assignment_source", input.assignmentSource)
  }

  const { data, error } = await query.range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return (data ?? []) as LeadRow[]
}
