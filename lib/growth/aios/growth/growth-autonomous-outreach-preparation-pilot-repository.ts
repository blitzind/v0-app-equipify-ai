/** GE-AVA-PERSISTENCE-1 — Supabase repository for outreach preparation pilot store (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUNS_TABLE,
  GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUN_RETENTION_LIMIT,
  GROWTH_AVA_OUTREACH_PREPARATION_PILOT_STATE_TABLE,
  GROWTH_AVA_PERSISTENCE_1_QA_MARKER,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-persistence-types"
import type {
  GrowthAutonomousOutreachApprovalPackage,
  GrowthAutonomousOutreachPreparationPilotControlState,
  GrowthAutonomousOutreachPreparationRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"

type PilotStateRow = {
  organization_id: string
  control_state: GrowthAutonomousOutreachPreparationPilotControlState
  updated_at: string
  qa_marker: string
}

type PilotRunRow = {
  id: string
  organization_id: string
  run_id: string
  lead_id: string
  company_name: string | null
  wake_condition: GrowthAutonomousOutreachPreparationRunRecord["wakeCondition"]
  outcome: GrowthAutonomousOutreachPreparationRunRecord["outcome"]
  started_at: string
  completed_at: string
  duration_ms: number
  package_id: string | null
  workflow_type: string | null
  confidence: number | null
  skip_reason: string | null
  block_reason: string | null
  revenue_operator_handoff: string | null
  approval_package: GrowthAutonomousOutreachApprovalPackage | null
  qa_marker: string
  created_at: string
}

function pilotStateTable(admin: SupabaseClient) {
  return admin.schema("growth").from(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_STATE_TABLE)
}

function pilotRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUNS_TABLE)
}

function mapRunRowToRecord(row: PilotRunRow): GrowthAutonomousOutreachPreparationRunRecord {
  return {
    runId: row.run_id,
    leadId: row.lead_id,
    companyName: row.company_name,
    wakeCondition: row.wake_condition,
    outcome: row.outcome,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    packageId: row.package_id,
    workflowType: row.workflow_type,
    confidence: row.confidence,
    skipReason: row.skip_reason,
    blockReason: row.block_reason,
    revenueOperatorHandoff: row.revenue_operator_handoff,
    approvalPackage: row.approval_package,
  }
}

function mapRunRecordToInsert(input: {
  organizationId: string
  run: GrowthAutonomousOutreachPreparationRunRecord
}): Omit<PilotRunRow, "id" | "created_at"> {
  return {
    organization_id: input.organizationId,
    run_id: input.run.runId,
    lead_id: input.run.leadId,
    company_name: input.run.companyName,
    wake_condition: input.run.wakeCondition,
    outcome: input.run.outcome,
    started_at: input.run.startedAt,
    completed_at: input.run.completedAt,
    duration_ms: input.run.durationMs,
    package_id: input.run.packageId,
    workflow_type: input.run.workflowType,
    confidence: input.run.confidence,
    skip_reason: input.run.skipReason,
    block_reason: input.run.blockReason,
    revenue_operator_handoff: input.run.revenueOperatorHandoff,
    approval_package: input.run.approvalPackage,
    qa_marker: GROWTH_AVA_PERSISTENCE_1_QA_MARKER,
  }
}

export async function fetchOutreachPreparationPilotControlState(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ controlState: GrowthAutonomousOutreachPreparationPilotControlState; updatedAt: string }> {
  const { data, error } = await pilotStateTable(admin)
    .select("control_state, updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return { controlState: "disabled", updatedAt: new Date().toISOString() }
  }

  return {
    controlState: data.control_state as GrowthAutonomousOutreachPreparationPilotControlState,
    updatedAt: data.updated_at,
  }
}

export async function upsertOutreachPreparationPilotControlState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    controlState: GrowthAutonomousOutreachPreparationPilotControlState
    now: string
  },
): Promise<{ controlState: GrowthAutonomousOutreachPreparationPilotControlState; updatedAt: string }> {
  const row: PilotStateRow = {
    organization_id: input.organizationId,
    control_state: input.controlState,
    updated_at: input.now,
    qa_marker: GROWTH_AVA_PERSISTENCE_1_QA_MARKER,
  }

  const { data, error } = await pilotStateTable(admin)
    .upsert(row, { onConflict: "organization_id" })
    .select("control_state, updated_at")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    controlState: data.control_state as GrowthAutonomousOutreachPreparationPilotControlState,
    updatedAt: data.updated_at,
  }
}

export async function listOutreachPreparationPilotRuns(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAutonomousOutreachPreparationRunRecord[]> {
  const { data, error } = await pilotRunsTable(admin)
    .select("*")
    .eq("organization_id", organizationId)
    .order("completed_at", { ascending: false })
    .limit(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUN_RETENTION_LIMIT)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as PilotRunRow[]
  return rows.reverse().map(mapRunRowToRecord)
}

/** GE-AIOS-OPERATOR-UX-1A — lead-scoped runs for cancel/archive propagation. */
export async function listOutreachPreparationPilotRunsForLead(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; limit?: number },
): Promise<GrowthAutonomousOutreachPreparationRunRecord[]> {
  const { data, error } = await pilotRunsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("lead_id", input.leadId)
    .order("completed_at", { ascending: false })
    .limit(input.limit ?? 25)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as PilotRunRow[]).map(mapRunRowToRecord)
}

export async function insertOutreachPreparationPilotRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    run: GrowthAutonomousOutreachPreparationRunRecord
  },
): Promise<void> {
  const { error } = await pilotRunsTable(admin).upsert(mapRunRecordToInsert(input), {
    onConflict: "organization_id,run_id",
  })

  if (error) {
    throw new Error(error.message)
  }

  await pruneOutreachPreparationPilotRuns(admin, input.organizationId)
}

async function pruneOutreachPreparationPilotRuns(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { data, error } = await pilotRunsTable(admin)
    .select("id")
    .eq("organization_id", organizationId)
    .order("completed_at", { ascending: false })
    .range(GROWTH_AVA_OUTREACH_PREPARATION_PILOT_RUN_RETENTION_LIMIT, 4999)

  if (error || !data?.length) return

  const staleIds = data.map((row) => row.id as string)
  const { error: deleteError } = await pilotRunsTable(admin).delete().in("id", staleIds)
  if (deleteError) {
    throw new Error(deleteError.message)
  }
}

export async function findOutreachPreparationRunByPackageId(
  admin: SupabaseClient,
  input: { organizationId: string; packageId: string },
): Promise<GrowthAutonomousOutreachPreparationRunRecord | null> {
  const { data: byPackageId, error: packageError } = await pilotRunsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("package_id", input.packageId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (packageError) {
    throw new Error(packageError.message)
  }

  if (byPackageId) {
    return mapRunRowToRecord(byPackageId as PilotRunRow)
  }

  const { data: byApprovalPackage, error: approvalError } = await pilotRunsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .filter("approval_package->>packageId", "eq", input.packageId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (approvalError) {
    throw new Error(approvalError.message)
  }

  return byApprovalPackage ? mapRunRowToRecord(byApprovalPackage as PilotRunRow) : null
}

/** GE-AIOS-MASTER-KNOWLEDGE-1C — replace approval_package body on an existing run row. */
export async function updateOutreachPreparationPilotRunApprovalPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    approvalPackage: GrowthAutonomousOutreachApprovalPackage
    confidence?: number | null
    now?: string
  },
): Promise<void> {
  const { error } = await pilotRunsTable(admin)
    .update({
      approval_package: input.approvalPackage,
      package_id: input.approvalPackage.packageId,
      confidence: input.confidence ?? input.approvalPackage.confidence,
      qa_marker: GROWTH_AVA_PERSISTENCE_1_QA_MARKER,
      completed_at: input.now ?? input.approvalPackage.preparedAt,
    })
    .eq("organization_id", input.organizationId)
    .eq("run_id", input.runId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function markOutreachPreparationPackageApprovalDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    decision: "approved" | "rejected"
    executionRequestId?: string | null
    now: string
  },
): Promise<GrowthAutonomousOutreachPreparationRunRecord | null> {
  const existing = await findOutreachPreparationRunByPackageId(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
  })

  if (!existing?.approvalPackage) {
    return null
  }

  const approvalPackage: GrowthAutonomousOutreachApprovalPackage = {
    ...existing.approvalPackage,
    packageApprovalDecision: input.decision,
    executionRequestId: input.executionRequestId ?? null,
    pendingHumanApproval: input.decision === "approved" ? false : existing.approvalPackage.pendingHumanApproval,
  }

  const updatedRun: GrowthAutonomousOutreachPreparationRunRecord = {
    ...existing,
    approvalPackage,
  }

  const { error } = await pilotRunsTable(admin)
    .update({
      approval_package: approvalPackage,
      qa_marker: GROWTH_AVA_PERSISTENCE_1_QA_MARKER,
    })
    .eq("organization_id", input.organizationId)
    .eq("run_id", existing.runId)

  if (error) {
    throw new Error(error.message)
  }

  if (existing.approvalPackage.leadId) {
    invalidateCanonicalDecisionCacheForLead(
      existing.approvalPackage.leadId,
      `package_${input.decision}`,
    )
  }

  return updatedRun
}

export async function resetOutreachPreparationPilotOrgState(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { error: runsError } = await pilotRunsTable(admin).delete().eq("organization_id", organizationId)
  if (runsError) {
    throw new Error(runsError.message)
  }

  const { error: stateError } = await pilotStateTable(admin).delete().eq("organization_id", organizationId)
  if (stateError) {
    throw new Error(stateError.message)
  }
}
