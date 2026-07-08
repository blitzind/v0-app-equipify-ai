/** Phase GS-2D — Prospect recommendation certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildProspectPriorityScore, buildProspectPriorityScoreInputFromCompany } from "@/lib/growth/prospect-discovery/prospect-priority-scoring"
import { collapseProspectRecommendations, generateProspectRecommendations } from "@/lib/growth/prospect-discovery/prospect-recommendation-engine"
import {
  applyProspectRecommendationAction,
  ensureProspectRecommendationsForExecutionRun,
  loadGrowthProspectRecommendations,
  loadTopProspectOpportunityFeedItems,
  loadTopProspectOpportunitiesForCommandCenter,
  persistProspectRecommendations,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-repository"
import {
  PROSPECT_RECOMMENDATION_CONFIRM,
  PROSPECT_RECOMMENDATION_QA_MARKER,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"
import { loadProspectExecutionRunById } from "@/lib/growth/prospect-discovery/prospect-execution-results"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export { PROSPECT_RECOMMENDATION_CONFIRM }

export function assertProspectRecommendationsAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function sampleHighSignalCompany(): GrowthProspectSearchCompanyResult {
  return {
    id: "sample-company-abc-biomedical",
    source_type: "external_discovered",
    company_name: "ABC Biomedical",
    website: "https://abc-biomedical.example",
    industry: "Biomedical",
    subindustry: "Diagnostics",
    employees: "250-500",
    revenue_range: "$25M-$50M",
    location: "Boston, MA",
    intent_score: 82,
    buying_stage: "evaluation",
    buying_stage_confidence: 78,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: 88,
    lead_engine_score: 91,
    lead_engine_score_label: "High",
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    confidence: 0.91,
    company_match_confidence: 0.9,
    decision_maker_coverage: 72,
    verification_status: "verified",
    signals: ["Hiring Surge", "Funding Event", "Pricing Page Visit", "Strong Fit"],
    search_intent_category: "biomedical",
    growth_lead_id: "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56",
    prospect_id: null,
    customer_id: null,
    rank_score: 92,
    match_reasoning: ["Strong biomedical playbook fit"],
    signal_momentum_score: 88,
    signal_momentum_label: "surge",
    growth_signal_score: 86,
    growth_signal_tier: "hot",
  }
}

export async function executeProspectRecommendationsCertification(
  admin: SupabaseClient,
  input?: {
    dry_run?: boolean
    execution_run_id?: string | null
  },
) {
  const execution_id = randomUUID()
  const gateCheck = assertProspectRecommendationsAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []

  const sampleCompany = sampleHighSignalCompany()
  const scoreInput = buildProspectPriorityScoreInputFromCompany(sampleCompany, "biomedical")
  const priorityScore = buildProspectPriorityScore(scoreInput)
  checks.push({
    id: "priority_scores_generated",
    pass: priorityScore.score >= 85 && priorityScore.priority === "urgent",
    detail: priorityScore,
  })

  const generated = generateProspectRecommendations({
    execution_run_id: input?.execution_run_id ?? "cert-run",
    companies: [sampleCompany],
    qualified_company_ids: [sampleCompany.id],
    search_industry_hint: "biomedical",
  })
  checks.push({
    id: "recommendations_generated",
    pass: generated.length >= 3,
    detail: { count: generated.length, types: generated.map((r) => r.recommendation_type) },
  })

  const urgentRec = generated.find((r) => r.priority === "urgent")
  checks.push({
    id: "revenue_impact_estimated",
    pass: (urgentRec?.estimated_revenue_impact.sort_score ?? 0) >= 70,
    detail: urgentRec?.estimated_revenue_impact ?? null,
  })

  const duplicateBatch = [
    ...generated,
    ...generated.map((item) => ({ ...item, recommendation_id: randomUUID() })),
  ]
  const collapsed = collapseProspectRecommendations(duplicateBatch)
  checks.push({
    id: "duplicate_recommendations_collapse",
    pass: collapsed.items.length < duplicateBatch.length,
    detail: { before: duplicateBatch.length, after: collapsed.items.length },
  })

  checks.push({
    id: "no_automatic_enrollment",
    pass: generated.every((r) => r.enrollment_enabled === false),
    detail: { enrollment_enabled: false },
  })

  checks.push({
    id: "no_outreach_execution",
    pass: generated.every((r) => r.outreach_enabled === false),
    detail: { outreach_enabled: false },
  })

  const execution_run_id = input?.execution_run_id ?? "0f95e732-e0a7-4d84-8d1d-d7e8ea1978a0"
  const loadedRun = await loadProspectExecutionRunById(admin, execution_run_id)
  let persistedRecommendations = generated

  if (loadedRun.run?.status === "completed" && loadedRun.results) {
    const ensured = await ensureProspectRecommendationsForExecutionRun(admin, execution_run_id, "biomedical")
    checks.push({
      id: "production_execution_run_recommendations",
      pass: ensured.ok && ensured.recommendations.length > 0,
      detail: {
        execution_run_id,
        generated: ensured.generated,
        count: ensured.recommendations.length,
      },
    })
    if (ensured.recommendations.length > 0) {
      persistedRecommendations = ensured.recommendations
    }
  } else {
    const persisted = await persistProspectRecommendations(admin, generated.slice(0, 4))
    checks.push({
      id: "recommendations_persisted",
      pass: persisted.ok && persisted.persisted > 0,
      detail: persisted,
    })
  }

  const response = await loadGrowthProspectRecommendations(admin, {
    execution_run_id: persistedRecommendations[0]?.execution_run_id,
    sort: "priority",
    limit: 20,
  })
  checks.push({
    id: "command_center_integration",
    pass: response.top_opportunities.length > 0,
    detail: { top_opportunities: response.top_opportunities.length },
  })

  const commandCards = await loadTopProspectOpportunitiesForCommandCenter(admin, 5)
  checks.push({
    id: "command_center_cards",
    pass: commandCards.length > 0 && commandCards.every((c) => c.requires_human_approval === true),
    detail: { cards: commandCards.length },
  })

  const feedItems = await loadTopProspectOpportunityFeedItems(admin, 5)
  checks.push({
    id: "signal_feed_integration",
    pass: feedItems.some((item) => item.signal_type === "top_prospect_opportunity"),
    detail: { feed_items: feedItems.length },
  })

  const actionTarget = response.items.find((item) => item.audit_event_id)?.audit_event_id
  if (actionTarget) {
    const viewed = await applyProspectRecommendationAction(admin, {
      audit_event_id: actionTarget,
      action: "mark_viewed",
    })
    const acted = await applyProspectRecommendationAction(admin, {
      audit_event_id: actionTarget,
      action: "mark_acted_on",
    })
    const dismissed = await applyProspectRecommendationAction(admin, {
      audit_event_id: actionTarget,
      action: "dismiss",
    })
    checks.push({
      id: "status_actions_work",
      pass: viewed.ok && acted.ok && dismissed.ok,
      detail: { viewed: viewed.status, acted: acted.status, dismissed: dismissed.status },
    })
  } else {
    checks.push({
      id: "status_actions_work",
      pass: false,
      detail: { error: "no_audit_event_id" },
    })
  }

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    enrollment_enabled: false,
    outreach_enabled: false,
    requires_human_approval: true,
    blockers: [],
  }
}
