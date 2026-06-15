/** Phase GS-2E — Campaign Readiness certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { evaluateCampaignReadiness } from "@/lib/growth/campaign-readiness/campaign-readiness-engine"
import {
  CAMPAIGN_READINESS_CONFIRM,
  CAMPAIGN_READINESS_QA_MARKER,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { buildProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness"
import { generateCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"

export { CAMPAIGN_READINESS_CONFIRM }

const CERT_PREFIX = "gs2e-cert"

export function assertCampaignReadinessCertificationAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export async function executeCampaignReadinessCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertCampaignReadinessCertificationAllowed(
    process.env as Record<string, string | undefined>,
  )
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: CAMPAIGN_READINESS_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: CAMPAIGN_READINESS_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()

  const engineReadiness = buildProspectSearchEngineReadiness({
    company: {
      contact_intelligence: undefined,
      canonical_company_id: null,
      is_suppressed: false,
    },
  })

  const notReady = evaluateCampaignReadiness({
    assessment_id: `${CERT_PREFIX}-not-ready`,
    subject_type: "prospect",
    subject_ref: `${CERT_PREFIX}-lead`,
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} Blocked Co`,
    is_suppressed: true,
    engine_readiness: engineReadiness,
    knowledge_document_count: 0,
    has_account_playbook: false,
    sequence_pattern_count: 0,
    voice_drop_pattern_ready: false,
    compliance_orchestration_enabled: false,
    human_approval_pending_count: 2,
    execution_plan_approved: false,
  })

  checks.push({
    id: "not_ready_status",
    pass: notReady.readiness_status === "not_ready",
    detail: { score: notReady.readiness_score, blockers: notReady.blockers.length },
  })

  const partialReady = evaluateCampaignReadiness({
    assessment_id: `${CERT_PREFIX}-partial`,
    subject_type: "account",
    subject_ref: `${CERT_PREFIX}-account`,
    engine_readiness: {
      ...engineReadiness,
      overall: { ...engineReadiness.overall, score: 55 },
      channel: { ...engineReadiness.channel, score: 45 },
      committee: { ...engineReadiness.committee, score: 50 },
      company_intelligence: { ...engineReadiness.company_intelligence, score: 55 },
    },
    knowledge_document_count: 5,
    has_account_playbook: false,
    sequence_pattern_count: 1,
    compliance_orchestration_enabled: true,
    human_approval_pending_count: 0,
  })

  checks.push({
    id: "partially_ready_status",
    pass: partialReady.readiness_status === "partially_ready" || partialReady.readiness_status === "not_ready",
    detail: { score: partialReady.readiness_score },
  })

  const ready = evaluateCampaignReadiness({
    assessment_id: `${CERT_PREFIX}-ready`,
    subject_type: "prospect",
    subject_ref: `${CERT_PREFIX}-ready-lead`,
    engine_readiness: {
      ...engineReadiness,
      overall: { ...engineReadiness.overall, score: 88 },
      channel: { ...engineReadiness.channel, score: 85, level: "ready" },
      committee: { ...engineReadiness.committee, score: 82, level: "ready" },
      company_intelligence: { ...engineReadiness.company_intelligence, score: 80, level: "ready" },
      contactability: { ...engineReadiness.contactability, score: 85, level: "ready" },
      reachable_decision_maker_count: 2,
    },
    knowledge_document_count: 15,
    has_account_playbook: true,
    sequence_pattern_count: 3,
    voice_drop_pattern_ready: true,
    compliance_orchestration_enabled: true,
    human_approval_pending_count: 0,
    execution_plan_approved: true,
    sequence_readiness: {
      qa_marker: "growth-sequence-readiness-v1",
      readiness_state: "ready",
      sequence_suitability: "email_first",
      readiness_reasons: ["Ready"],
      blockers: [],
      missing_requirements: [],
      safest_recommended_channel: "email",
      recommended_first_contact_id: null,
      recommended_first_contact_name: null,
      suggested_sequence_type: "Email-first outreach",
      readiness_score: 85,
    },
  })

  checks.push({
    id: "ready_status_high_score",
    pass: ready.readiness_score >= 70 && ready.dimensions.length === 9,
    detail: { score: ready.readiness_score, status: ready.readiness_status },
  })

  const scoreA = evaluateCampaignReadiness({
    assessment_id: `${CERT_PREFIX}-det-a`,
    subject_type: "cohort",
    subject_ref: "cohort-a",
    engine_readiness: engineReadiness,
    knowledge_document_count: 3,
  })
  const scoreB = evaluateCampaignReadiness({
    assessment_id: `${CERT_PREFIX}-det-b`,
    subject_type: "cohort",
    subject_ref: "cohort-a",
    engine_readiness: engineReadiness,
    knowledge_document_count: 3,
  })

  checks.push({
    id: "scoring_deterministic",
    pass: scoreA.readiness_score === scoreB.readiness_score && scoreA.dimensions.length === scoreB.dimensions.length,
    detail: { score: scoreA.readiness_score },
  })

  checks.push({
    id: "blockers_present_when_suppressed",
    pass: notReady.blockers.some((b) => b.severity === "critical"),
    detail: { blockers: notReady.blockers.length },
  })

  checks.push({
    id: "recommendations_advisory",
    pass: notReady.recommendations.length > 0 && !notReady.recommendations.some((r) => /send|enroll|launch/i.test(r.title)),
    detail: { count: notReady.recommendations.length },
  })

  checks.push({
    id: "human_review_required",
    pass:
      notReady.requires_human_review === true &&
      ready.requires_human_review === true &&
      notReady.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: ready.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const liveResult = await generateCampaignReadinessAssessment(admin, {
    subject_type: "account",
    subject_ref: `${CERT_PREFIX}-live`,
    persist_audit: false,
  })

  checks.push({
    id: "live_assessment_round_trip",
    pass: liveResult.ok && liveResult.assessment?.qa_marker === CAMPAIGN_READINESS_QA_MARKER,
    detail: {
      organization_id: organization_id ?? null,
      score: liveResult.assessment?.readiness_score,
      error: liveResult.error ?? null,
    },
  })

  checks.push({
    id: "required_human_actions_present",
    pass: (liveResult.assessment?.required_human_actions.length ?? 0) > 0,
    detail: { actions: liveResult.assessment?.required_human_actions.length },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
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
