import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type {
  GrowthProspectIntelligenceBundle,
  GrowthResearchCoverageSummary,
  GrowthResearchRunPublicView,
  GrowthResearchSignals,
} from "@/lib/growth/research/research-types"

export const PROSPECT_RESEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

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
    researchConfidence: row.research_confidence,
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

export async function fetchActiveProspectResearchRun(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthResearchRunPublicView | null> {
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .in("status", ["queued", "running"])
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

export async function markProspectResearchRunRunning(admin: SupabaseClient, runId: string): Promise<void> {
  const { error } = await researchRunsTable(admin).update({ status: "running" }).eq("id", runId)
  if (error) throw new Error(error.message)
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
