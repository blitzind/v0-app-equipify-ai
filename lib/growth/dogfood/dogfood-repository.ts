import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthDogfoodIssue,
  GrowthDogfoodIssueSeverity,
  GrowthDogfoodIssueStatus,
  GrowthDogfoodSubsystem,
  GrowthDogfoodValidationRun,
  GrowthDogfoodValidationStatus,
} from "@/lib/growth/dogfood/dogfood-types"

const RUN_SELECT =
  "id, subsystem, status, notes, owner_user_id, issue_count, confidence, run_at, created_at"

const ISSUE_SELECT =
  "id, title, severity, subsystem, owner_user_id, status, reproduction_notes, fixed_version, created_at, updated_at, resolved_at"

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("dogfood_validation_runs")
}

function issuesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("dogfood_issues")
}

type RunRow = {
  id: string
  subsystem: string
  status: string
  notes: string
  owner_user_id: string | null
  issue_count: number
  confidence: number
  run_at: string
  created_at: string
}

type IssueRow = {
  id: string
  title: string
  severity: string
  subsystem: string
  owner_user_id: string | null
  status: string
  reproduction_notes: string
  fixed_version: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export function mapGrowthDogfoodValidationRun(row: RunRow): GrowthDogfoodValidationRun {
  return {
    id: row.id,
    subsystem: row.subsystem as GrowthDogfoodSubsystem,
    status: row.status as GrowthDogfoodValidationStatus,
    notes: row.notes,
    ownerUserId: row.owner_user_id,
    issueCount: row.issue_count,
    confidence: row.confidence,
    runAt: row.run_at,
    createdAt: row.created_at,
  }
}

export function mapGrowthDogfoodIssue(row: IssueRow): GrowthDogfoodIssue {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity as GrowthDogfoodIssueSeverity,
    subsystem: row.subsystem as GrowthDogfoodSubsystem,
    ownerUserId: row.owner_user_id,
    status: row.status as GrowthDogfoodIssueStatus,
    reproductionNotes: row.reproduction_notes,
    fixedVersion: row.fixed_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  }
}

export async function insertGrowthDogfoodValidationRun(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthDogfoodValidationRun> {
  const { data, error } = await runsTable(admin).insert(row).select(RUN_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthDogfoodValidationRun(data as RunRow)
}

export async function listGrowthDogfoodValidationRuns(
  admin: SupabaseClient,
  input?: { subsystem?: GrowthDogfoodSubsystem | null; limit?: number },
): Promise<GrowthDogfoodValidationRun[]> {
  let query = runsTable(admin).select(RUN_SELECT)
  if (input?.subsystem) query = query.eq("subsystem", input.subsystem)
  const { data, error } = await query.order("run_at", { ascending: false }).limit(input?.limit ?? 100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthDogfoodValidationRun(row as RunRow))
}

export async function fetchLatestGrowthDogfoodRunsBySubsystem(
  admin: SupabaseClient,
): Promise<Map<GrowthDogfoodSubsystem, GrowthDogfoodValidationRun>> {
  const runs = await listGrowthDogfoodValidationRuns(admin, { limit: 500 })
  const map = new Map<GrowthDogfoodSubsystem, GrowthDogfoodValidationRun>()
  for (const run of runs) {
    if (!map.has(run.subsystem)) map.set(run.subsystem, run)
  }
  return map
}

export async function insertGrowthDogfoodIssue(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthDogfoodIssue> {
  const { data, error } = await issuesTable(admin).insert(row).select(ISSUE_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthDogfoodIssue(data as IssueRow)
}

export async function updateGrowthDogfoodIssue(
  admin: SupabaseClient,
  issueId: string,
  patch: Record<string, unknown>,
): Promise<GrowthDogfoodIssue> {
  const { data, error } = await issuesTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", issueId)
    .select(ISSUE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthDogfoodIssue(data as IssueRow)
}

export async function fetchGrowthDogfoodIssueById(
  admin: SupabaseClient,
  issueId: string,
): Promise<GrowthDogfoodIssue | null> {
  const { data, error } = await issuesTable(admin).select(ISSUE_SELECT).eq("id", issueId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthDogfoodIssue(data as IssueRow) : null
}

export async function listGrowthDogfoodIssues(
  admin: SupabaseClient,
  input?: {
    subsystem?: GrowthDogfoodSubsystem | null
    status?: GrowthDogfoodIssueStatus | GrowthDogfoodIssueStatus[] | null
    severity?: GrowthDogfoodIssueSeverity | null
    limit?: number
  },
): Promise<GrowthDogfoodIssue[]> {
  let query = issuesTable(admin).select(ISSUE_SELECT)
  if (input?.subsystem) query = query.eq("subsystem", input.subsystem)
  if (input?.severity) query = query.eq("severity", input.severity)
  if (Array.isArray(input?.status)) query = query.in("status", input.status)
  else if (input?.status) query = query.eq("status", input.status)
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(input?.limit ?? 100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthDogfoodIssue(row as IssueRow))
}

export async function countOpenGrowthDogfoodIssues(admin: SupabaseClient): Promise<{
  openBlockers: number
  criticalBlockers: number
  bySubsystem: Map<GrowthDogfoodSubsystem, { open: number; critical: number }>
}> {
  const issues = await listGrowthDogfoodIssues(admin, {
    status: ["open", "in_progress"],
    limit: 500,
  })
  const bySubsystem = new Map<GrowthDogfoodSubsystem, { open: number; critical: number }>()
  let criticalBlockers = 0
  for (const issue of issues) {
    const entry = bySubsystem.get(issue.subsystem) ?? { open: 0, critical: 0 }
    entry.open += 1
    if (issue.severity === "critical") {
      entry.critical += 1
      criticalBlockers += 1
    }
    bySubsystem.set(issue.subsystem, entry)
  }
  return { openBlockers: issues.length, criticalBlockers, bySubsystem }
}
