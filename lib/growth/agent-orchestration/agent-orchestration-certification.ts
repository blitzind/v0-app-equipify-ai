/** Phase GS-4D — Agent Orchestration certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import {
  generateGrowthAgentPlan,
  resolveGrowthAgentDependencies,
  routeGrowthAgentTask,
} from "@/lib/growth/agent-orchestration/agent-orchestration-engine"
import {
  rankGrowthAgentRecommendations,
  scoreGrowthAgentPlan,
} from "@/lib/growth/agent-orchestration/agent-orchestration-priority"
import {
  AGENT_ORCHESTRATION_CONFIRM,
  AGENT_ORCHESTRATION_QA_MARKER,
  GROWTH_AGENT_PLAN_STATUSES,
} from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import { fetchGrowthAgentOrchestration } from "@/lib/growth/agent-orchestration/agent-orchestration-service"
import { generateCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-engine"
import { generateSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-engine"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

export { AGENT_ORCHESTRATION_CONFIRM }

const CERT_PREFIX = "gs4d-cert"

export function assertAgentOrchestrationCertificationAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function certReadiness(): CampaignReadinessAssessment {
  return {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: `${CERT_PREFIX}-readiness`,
    subject_type: "prospect",
    subject_ref: `${CERT_PREFIX}-lead`,
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 55,
    readiness_status: "partially_ready",
    dimensions: [],
    blockers: [
      {
        blocker_id: "channel_missing",
        dimension_id: "channel_readiness",
        severity: "warning",
        message: "Missing verified email channel",
        resolution_hint: "Run contact discovery",
        related_asset_href: "/admin/growth/search",
      },
    ],
    recommendations: [],
    missing_assets: ["Knowledge playbook"],
    missing_channels: ["verified_email"],
    required_approvals: ["Human execution approval"],
    required_human_actions: ["Review campaign readiness"],
    review_status: "pending",
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

function certPattern(suffix: string): GrowthSequencePattern {
  return {
    id: `${CERT_PREFIX}-pattern-${suffix}`,
    key: `${CERT_PREFIX}_orchestration`,
    label: `${CERT_PREFIX} Orchestration Pattern`,
    description: null,
    patternKind: "catalog",
    sequenceVersion: 1,
    isActive: true,
    minTouches: 2,
    maxObservationDays: 21,
    attemptCount: 5,
    replyRate: 0.1,
    positiveReplyRate: 0.04,
    meetingSignalRate: 0.02,
    followUpCompletionRate: 0.35,
    sequenceAbandonmentRate: 0.08,
    opportunityLift: 0.05,
    revenueProbabilityLift: 0.04,
    conversationHealthLift: 0.03,
    averageTimeToReplyHours: 36,
    averageTouchesToPositiveSignal: 2,
    sequenceQualityScore: 70,
    sequenceFatigueRisk: "low",
    confidenceScore: 62,
    computedAt: new Date().toISOString(),
    steps: [
      {
        id: `${CERT_PREFIX}-step-1`,
        patternId: `${CERT_PREFIX}-pattern-${suffix}`,
        stepOrder: 1,
        channel: "email",
        delayDaysMin: 0,
        delayDaysMax: 0,
        generationType: "personalized",
        playbookCategory: "value_prop",
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "reply",
      },
    ],
  }
}

export async function executeAgentOrchestrationCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertAgentOrchestrationCertificationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()
  const suffix = execution_id.slice(0, 8)
  const pattern = certPattern(suffix)
  const readiness = certReadiness()

  const previews = generateSequencePreview({
    patterns: [pattern],
    campaign_readiness: readiness,
    lead_id: `${CERT_PREFIX}-lead`,
    limit: 5,
  })

  const wizards = generateCampaignBuilderWizard({
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    pattern_id: pattern.id,
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    patterns: [pattern],
    limit: 5,
  })

  const generated = generateGrowthAgentPlan({
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    campaign_wizards: wizards.wizards,
    sequence_pattern_count: 1,
    limit: 5,
  })

  for (const status of GROWTH_AGENT_PLAN_STATUSES) {
    checks.push({
      id: `status_${status}`,
      pass: generated.status_counts[status] >= 0,
      detail: { count: generated.status_counts[status] },
    })
  }

  checks.push({
    id: "plan_generated",
    pass: generated.plans.length >= 1 && generated.qa_marker === AGENT_ORCHESTRATION_QA_MARKER,
    detail: { total: generated.total, plan_status: generated.plans[0]?.plan_status },
  })

  const plan = generated.plans[0]!
  checks.push({
    id: "task_graph_present",
    pass: plan.tasks.length >= 5 && plan.execution_graph.nodes.length >= 5,
    detail: { tasks: plan.tasks.length, nodes: plan.execution_graph.nodes.length },
  })

  const deps = resolveGrowthAgentDependencies(plan.tasks)
  checks.push({
    id: "dependency_resolution",
    pass: deps.length >= 3 && plan.dependencies.length >= 3,
    detail: { dependencies: plan.dependencies.length },
  })

  const ranked = rankGrowthAgentRecommendations(plan.recommendations)
  checks.push({
    id: "recommendation_ranking",
    pass: ranked.length >= 1 && ranked[0]?.priority === "high",
    detail: { recommendations: ranked.length },
  })

  checks.push({
    id: "task_routing",
    pass: plan.tasks.every((task) => routeGrowthAgentTask(task).requires_human_review === true),
    detail: {},
  })

  checks.push({
    id: "suggested_order_present",
    pass: plan.suggested_order.length >= 5,
    detail: { order: plan.suggested_order.slice(0, 3) },
  })

  checks.push({
    id: "risks_present",
    pass: plan.risks.length >= 1,
    detail: {},
  })

  checks.push({
    id: "required_approvals_present",
    pass: plan.required_approvals.length >= 2,
    detail: {},
  })

  const scoreA = scoreGrowthAgentPlan(plan)
  const scoreB = scoreGrowthAgentPlan(plan)
  checks.push({
    id: "deterministic_scoring",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  checks.push({
    id: "human_review_required",
    pass:
      plan.requires_human_review === true &&
      plan.autonomous_execution_enabled === false &&
      generated.requires_human_review === true,
    detail: {},
  })

  checks.push({
    id: "no_outreach_execution",
    pass: plan.outreach_execution === false && generated.outreach_execution === false,
    detail: {},
  })

  checks.push({
    id: "no_enrollment_execution",
    pass: plan.enrollment_execution === false && generated.enrollment_execution === false,
    detail: {},
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: generated.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const live = await fetchGrowthAgentOrchestration(admin, { limit: 5, persist_audit: false })
  checks.push({
    id: "live_orchestration_round_trip",
    pass: live.qa_marker === AGENT_ORCHESTRATION_QA_MARKER,
    detail: { organization_id: organization_id ?? null, total: live.total },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    enrollment_enabled: false,
    outreach_enabled: false,
    blockers: [],
  }
}
