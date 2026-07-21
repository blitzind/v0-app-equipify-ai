/** GE-AIOS-23 — Canonical prospect research runs (`growth.research_runs`).
 *  Single owner for website evidence (22), prospect signals, and research cache.
 *  Entry: executeGrowthLeadProspectResearch → runProspectResearch
 */
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type {
  GrowthProspectIntelligenceBundle,
  GrowthResearchCoverageSummary,
  GrowthResearchRunPublicView,
  GrowthResearchSignals,
} from "@/lib/growth/research/research-types"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import {
  GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
  type GrowthCompanyEvidenceCollectionRecord,
} from "@/lib/growth/research/company-evidence/company-evidence-types"
import { normalizeGrowthResearchConfidence } from "@/lib/growth/research/research-confidence"

export const PROSPECT_RESEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER =
  "ge-aios-hotfix-live-8b-2-stale-research-run-recovery-v1" as const

export const STALE_ACTIVE_QUEUED_THRESHOLD_MS = 60 * 60 * 1000
export const STALE_ACTIVE_RUNNING_THRESHOLD_MS = 2 * 60 * 60 * 1000
export const STALE_ABANDONED_EXECUTION_FAILED_REASON = "stale_abandoned_execution" as const

export type StaleActiveProspectResearchRunRecovery = {
  qaMarker: typeof GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER
  leadId: string
  recoveredCount: number
  recovered: Array<{
    runId: string
    priorStatus: "queued" | "running"
    ageMinutes: number
    staleThresholdMinutes: number
  }>
}

export function staleActiveRunThresholdMs(status: string): number | null {
  if (status === "queued") return STALE_ACTIVE_QUEUED_THRESHOLD_MS
  if (status === "running") return STALE_ACTIVE_RUNNING_THRESHOLD_MS
  return null
}

export function isStaleActiveProspectResearchRun(
  row: Pick<ResearchRunRow, "status" | "created_at">,
  nowMs: number = Date.now(),
): boolean {
  const thresholdMs = staleActiveRunThresholdMs(row.status)
  if (thresholdMs == null) return false
  return nowMs - Date.parse(row.created_at) > thresholdMs
}

export function staleActiveRunCutoffIso(status: string, nowMs: number = Date.now()): string | null {
  const thresholdMs = staleActiveRunThresholdMs(status)
  if (thresholdMs == null) return null
  return new Date(nowMs - thresholdMs).toISOString()
}

const RUN_SELECT =
  "id, organization_id, lead_id, status, website_url, company_name, industry_guess, employee_size_guess, revenue_size_guess, website_maturity_score, social_presence_score, reputation_score, technology_score, detected_technologies, signals, competitors, research_summary, suggested_pitch_angle, suggested_sequence, suggested_call_opening, recommended_next_action, research_confidence, input_hash, completed_at, failed_reason, created_at"

type ResearchRunRow = {
  id: string
  organization_id: string
  lead_id: string
  status: string
  website_url: string | null
  company_name: string | null
  industry_guess: string | null
  employee_size_guess: string | null
  revenue_size_guess: string | null
  website_maturity_score: number | null
  social_presence_score: number | null
  reputation_score: number | null
  technology_score: number | null
  detected_technologies: unknown
  signals: unknown
  competitors: unknown
  research_summary: string | null
  suggested_pitch_angle: string | null
  suggested_sequence: string | null
  suggested_call_opening: string | null
  recommended_next_action: string | null
  research_confidence: number | null
  input_hash: string | null
  completed_at: string | null
  failed_reason: string | null
  created_at: string
}

function researchRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("research_runs")
}

function leadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function mapCompanyEvidence(raw: unknown): GrowthCompanyEvidenceBundle | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const row = raw as Record<string, unknown>
  const qaMarker = row.qaMarker ?? row.qa_marker
  if (qaMarker !== GROWTH_COMPANY_EVIDENCE_22_QA_MARKER) return undefined
  return {
    ...(row as unknown as GrowthCompanyEvidenceBundle),
    qaMarker: GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  }
}

function mapCompanyEvidenceCollection(raw: unknown): GrowthCompanyEvidenceCollectionRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const row = raw as Record<string, unknown>
  const qaMarker = row.qaMarker ?? row.qa_marker
  if (qaMarker !== GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER) return undefined
  const status = row.status
  if (status !== "collected" && status !== "skipped" && status !== "failed") return undefined
  return {
    qaMarker: GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
    status,
    reason: typeof row.reason === "string" ? row.reason : undefined,
    warnings: Array.isArray(row.warnings)
      ? (row.warnings as string[]).filter(Boolean).slice(0, 4)
      : undefined,
    collectedAt: typeof row.collectedAt === "string" ? row.collectedAt : typeof row.collected_at === "string" ? row.collected_at : new Date(0).toISOString(),
  }
}

function mapSignals(raw: unknown): GrowthResearchSignals {
  if (!raw || typeof raw !== "object") return { painSignals: [] }
  const row = raw as Record<string, unknown>
  const painSignals = Array.isArray(row.painSignals)
    ? (row.painSignals as string[]).filter(Boolean)
    : Array.isArray(row.pain_signals)
      ? (row.pain_signals as string[]).filter(Boolean)
      : []
  return {
    painSignals: painSignals as GrowthResearchSignals["painSignals"],
    maturityBreakdown:
      row.maturityBreakdown && typeof row.maturityBreakdown === "object"
        ? (row.maturityBreakdown as Record<string, number>)
        : undefined,
    hasSsl: row.hasSsl === true || row.has_ssl === true,
    hasMobileViewport: row.hasMobileViewport === true || row.has_mobile_viewport === true,
    hasOnlineBooking: row.hasOnlineBooking === true || row.has_online_booking === true,
    hasCustomerPortal: row.hasCustomerPortal === true || row.has_customer_portal === true,
    hasChatWidget: row.hasChatWidget === true || row.has_chat_widget === true,
    hasFinancing: row.hasFinancing === true || row.has_financing === true,
    hasSocialLinks: row.hasSocialLinks === true || row.has_social_links === true,
    hasReviewLinks: row.hasReviewLinks === true || row.has_review_links === true,
    companyEvidence_v22:
      mapCompanyEvidence(row.companyEvidence_v22) ??
      mapCompanyEvidence(row.company_evidence_v22),
    companyEvidenceCollection_v22:
      mapCompanyEvidenceCollection(row.companyEvidenceCollection_v22) ??
      mapCompanyEvidenceCollection(row.company_evidence_collection_v22),
  }
}

export function mapProspectResearchRunRow(row: ResearchRunRow): GrowthResearchRunPublicView {
  return {
    id: row.id,
    leadId: row.lead_id,
    status: row.status as GrowthResearchRunPublicView["status"],
    websiteUrl: row.website_url,
    companyName: row.company_name,
    industryGuess: row.industry_guess,
    employeeSizeGuess: row.employee_size_guess,
    revenueSizeGuess: row.revenue_size_guess,
    websiteMaturityScore: row.website_maturity_score,
    socialPresenceScore: row.social_presence_score,
    reputationScore: row.reputation_score,
    technologyScore: row.technology_score,
    detectedTechnologies: Array.isArray(row.detected_technologies) ? (row.detected_technologies as string[]) : [],
    signals: mapSignals(row.signals),
    competitors: Array.isArray(row.competitors)
      ? (row.competitors as GrowthResearchRunPublicView["competitors"])
      : [],
    researchSummary: row.research_summary,
    suggestedPitchAngle: row.suggested_pitch_angle,
    suggestedSequence: row.suggested_sequence,
    suggestedCallOpening: row.suggested_call_opening,
    recommendedNextAction: row.recommended_next_action,
    researchConfidence: normalizeGrowthResearchConfidence(row.research_confidence),
    completedAt: row.completed_at,
    failedReason: row.failed_reason,
    createdAt: row.created_at,
  }
}

export async function loadProspectIntelligenceBundle(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthProspectIntelligenceBundle> {
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) throw new Error(error.message)

  const runs = ((data ?? []) as ResearchRunRow[]).map(mapProspectResearchRunRow)
  const latestRun = runs.find((run) => run.status === "completed") ?? runs[0] ?? null

  return { leadId, latestRun, runs }
}

export async function reconcileStaleActiveProspectResearchRuns(
  admin: SupabaseClient,
  leadId: string,
  options?: { nowMs?: number },
): Promise<StaleActiveProspectResearchRunRecovery> {
  const nowMs = options?.nowMs ?? Date.now()
  const nowIso = new Date(nowMs).toISOString()

  const { data, error } = await researchRunsTable(admin)
    .select("id, organization_id, lead_id, status, created_at")
    .eq("lead_id", leadId)
    .in("status", ["queued", "running"])

  if (error) throw new Error(error.message)

  const recovered: StaleActiveProspectResearchRunRecovery["recovered"] = []

  for (const row of (data ?? []) as Pick<
    ResearchRunRow,
    "id" | "organization_id" | "lead_id" | "status" | "created_at"
  >[]) {
    if (!isStaleActiveProspectResearchRun(row, nowMs)) continue

    const priorStatus = row.status as "queued" | "running"
    const cutoffIso = staleActiveRunCutoffIso(priorStatus, nowMs)
    if (!cutoffIso) continue

    const ageMinutes = Math.round((nowMs - Date.parse(row.created_at)) / (60 * 1000))
    const staleThresholdMinutes = Math.round(
      (staleActiveRunThresholdMs(priorStatus) ?? 0) / (60 * 1000),
    )

    const { data: updated, error: updateError } = await researchRunsTable(admin)
      .update({
        status: "failed",
        failed_reason: STALE_ABANDONED_EXECUTION_FAILED_REASON,
        completed_at: nowIso,
      })
      .eq("id", row.id)
      .eq("status", priorStatus)
      .lt("created_at", cutoffIso)
      .select("id")
      .maybeSingle()

    if (updateError) throw new Error(updateError.message)
    if (!updated) continue

    recovered.push({
      runId: row.id,
      priorStatus,
      ageMinutes,
      staleThresholdMinutes,
    })

    logProspectResearch("stale_recovered", {
      qa_marker: GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
      organization_id: row.organization_id,
      lead_id: leadId,
      run_id: row.id,
      prior_status: priorStatus,
      age_minutes: ageMinutes,
      stale_threshold_minutes: staleThresholdMinutes,
      failed_reason: STALE_ABANDONED_EXECUTION_FAILED_REASON,
    })
  }

  return {
    qaMarker: GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
    leadId,
    recoveredCount: recovered.length,
    recovered,
  }
}

export async function fetchActiveProspectResearchRun(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthResearchRunPublicView | null> {
  await reconcileStaleActiveProspectResearchRuns(admin, leadId)

  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .in("status", ["queued", "running"])
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapProspectResearchRunRow(data as ResearchRunRow) : null
}

export async function fetchProspectResearchRunById(
  admin: SupabaseClient,
  runId: string,
): Promise<GrowthResearchRunPublicView | null> {
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("id", runId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapProspectResearchRunRow(data as ResearchRunRow) : null
}

export async function fetchCachedProspectResearchRun(
  admin: SupabaseClient,
  leadId: string,
  inputHash: string,
): Promise<GrowthResearchRunPublicView | null> {
  const cutoff = new Date(Date.now() - PROSPECT_RESEARCH_CACHE_TTL_MS).toISOString()
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .eq("status", "completed")
    .eq("input_hash", inputHash)
    .gte("completed_at", cutoff)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapProspectResearchRunRow(data as ResearchRunRow) : null
}

export async function insertProspectResearchRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string
    websiteUrl: string | null
    inputHash: string
  },
): Promise<GrowthResearchRunPublicView> {
  const { data, error } = await researchRunsTable(admin)
    .insert({
      organization_id: input.organizationId,
      lead_id: input.leadId,
      status: "queued",
      company_name: input.companyName,
      website_url: input.websiteUrl,
      input_hash: input.inputHash,
    })
    .select(RUN_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapProspectResearchRunRow(data as ResearchRunRow)
}

export async function markProspectResearchRunRunning(admin: SupabaseClient, runId: string): Promise<boolean> {
  const { data, error } = await researchRunsTable(admin)
    .update({ status: "running" })
    .eq("id", runId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data != null
}

export async function countOrganizationActiveProspectResearchRuns(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await researchRunsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["queued", "running"])
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function finishProspectResearchRun(
  admin: SupabaseClient,
  runId: string,
  patch: {
    status: "completed" | "failed"
    websiteUrl?: string | null
    industryGuess?: string | null
    employeeSizeGuess?: string | null
    revenueSizeGuess?: string | null
    websiteMaturityScore?: number | null
    socialPresenceScore?: number | null
    reputationScore?: number | null
    technologyScore?: number | null
    detectedTechnologies?: string[]
    signals?: GrowthResearchSignals
    competitors?: GrowthResearchRunPublicView["competitors"]
    researchSummary?: string | null
    suggestedPitchAngle?: string | null
    suggestedSequence?: string | null
    suggestedCallOpening?: string | null
    recommendedNextAction?: string | null
    researchConfidence?: number | null
    failedReason?: string | null
  },
): Promise<GrowthResearchRunPublicView> {
  const { data, error } = await researchRunsTable(admin)
    .update({
      status: patch.status,
      website_url: patch.websiteUrl,
      industry_guess: patch.industryGuess,
      employee_size_guess: patch.employeeSizeGuess,
      revenue_size_guess: patch.revenueSizeGuess,
      website_maturity_score: patch.websiteMaturityScore,
      social_presence_score: patch.socialPresenceScore,
      reputation_score: patch.reputationScore,
      technology_score: patch.technologyScore,
      detected_technologies: patch.detectedTechnologies ?? [],
      signals: patch.signals ?? { painSignals: [] },
      competitors: patch.competitors ?? [],
      research_summary: patch.researchSummary,
      suggested_pitch_angle: patch.suggestedPitchAngle,
      suggested_sequence: patch.suggestedSequence,
      suggested_call_opening: patch.suggestedCallOpening,
      recommended_next_action: patch.recommendedNextAction,
      research_confidence: patch.researchConfidence,
      completed_at: new Date().toISOString(),
      failed_reason: patch.failedReason ?? null,
    })
    .eq("id", runId)
    .select(RUN_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapProspectResearchRunRow(data as ResearchRunRow)
}

export async function markLeadProspectResearchCompleted(
  admin: SupabaseClient,
  leadId: string,
  run: GrowthResearchRunPublicView,
): Promise<void> {
  const { error } = await leadsTable(admin)
    .update({
      latest_prospect_research_run_id: run.id,
      last_prospect_researched_at: run.completedAt ?? new Date().toISOString(),
      prospect_recommended_next_action: run.recommendedNextAction,
    })
    .eq("id", leadId)

  if (error) throw new Error(error.message)
}

export async function fetchProspectResearchCoverageSummary(
  admin: SupabaseClient,
): Promise<GrowthResearchCoverageSummary> {
  const [{ count: totalLeads }, { data: leadRows }, { data: runRows }] = await Promise.all([
    leadsTable(admin).select("id", { count: "exact", head: true }).neq("status", "archived"),
    leadsTable(admin).select("id, latest_prospect_research_run_id").neq("status", "archived").limit(500),
    researchRunsTable(admin)
      .select("industry_guess, website_maturity_score, signals, status")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(500),
  ])

  const researchedLeads = (leadRows ?? []).filter((row) => row.latest_prospect_research_run_id).length
  const total = totalLeads ?? leadRows?.length ?? 0
  const painCounts = new Map<string, number>()
  const industryCounts = new Map<string, number>()
  let weakWebsiteOpportunities = 0

  for (const row of runRows ?? []) {
    const industry = String(row.industry_guess ?? "Unknown")
    industryCounts.set(industry, (industryCounts.get(industry) ?? 0) + 1)
    const maturity = Number(row.website_maturity_score ?? 0)
    if (maturity > 0 && maturity < 45) weakWebsiteOpportunities += 1

    const signals = mapSignals(row.signals)
    for (const signal of signals.painSignals) {
      painCounts.set(signal, (painCounts.get(signal) ?? 0) + 1)
    }
  }

  const topPainSignals = [...painCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal, count]) => ({ signal, count }))

  const topIndustries = [...industryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([industry, count]) => ({ industry, count }))

  return {
    totalLeads: total,
    researchedLeads,
    researchCompletePercent: total > 0 ? Math.round((researchedLeads / total) * 100) : 0,
    unresearchedLeads: Math.max(0, total - researchedLeads),
    weakWebsiteOpportunities,
    topPainSignals,
    topIndustries,
  }
}

export async function fetchLatestCompletedProspectResearchRun(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthResearchRunPublicView | null> {
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapProspectResearchRunRow(data as ResearchRunRow) : null
}

export function logProspectResearch(event: string, details: Record<string, unknown>): void {
  logGrowthEngine(`prospect_research_${event}`, details)
}
