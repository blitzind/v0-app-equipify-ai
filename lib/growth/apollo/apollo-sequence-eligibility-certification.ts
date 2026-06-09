/** Apollo AI-5 sequence eligibility certification — assessment only, no enrollment. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_SEQUENCE_ELIGIBILITY_QA_MARKER = "apollo-sequence-eligibility-ai-5-v1" as const

export type ApolloSequenceEligibilityRequirement = {
  id: string
  category: "contactability" | "compliance" | "research" | "scoring"
  satisfied: boolean
  detail: string
}

export type ApolloSequenceEligibilityCertification = {
  qa_marker: typeof APOLLO_SEQUENCE_ELIGIBILITY_QA_MARKER
  sequence_ready_count: number
  enrollment_ready: boolean
  requirements: ApolloSequenceEligibilityRequirement[]
  failures: string[]
  summary: string
}

export function certifyApolloSequenceEligibility(input: {
  evidence: ApolloLivePilotEvidence
  compliance_orchestration_enabled?: boolean
}): ApolloSequenceEligibilityCertification {
  const { evidence } = input
  const compliance = input.compliance_orchestration_enabled ?? false
  const f = evidence.readiness_funnel
  const cq = evidence.contact_quality
  const rp = evidence.research_pipeline

  const requirements: ApolloSequenceEligibilityRequirement[] = [
    {
      id: "contactability.channel_present",
      category: "contactability",
      satisfied: cq.with_email > 0 || cq.with_phone > 0,
      detail:
        cq.with_email > 0 || cq.with_phone > 0
          ? `${cq.with_email} email, ${cq.with_phone} phone on mapped contacts`
          : "No email or phone — outreach blocked",
    },
    {
      id: "contactability.contactable_cohort",
      category: "contactability",
      satisfied: f.contactable >= f.sequence_ready,
      detail: `${f.contactable} contactable, ${f.sequence_ready} sequence-ready`,
    },
    {
      id: "compliance.orchestration",
      category: "compliance",
      satisfied: compliance,
      detail: compliance
        ? "Compliance orchestration enabled"
        : "VOICE_COMPLIANCE_ORCHESTRATION_ENABLED not confirmed — manual compliance review required",
    },
    {
      id: "compliance.human_approval",
      category: "compliance",
      satisfied: true,
      detail: "Sequence execution jobs require human approval (unchanged — no autonomous enrollment)",
    },
    {
      id: "research.pipeline_complete",
      category: "research",
      satisfied: rp.automated_flow_confirmed && rp.company_intelligence_present,
      detail: rp.automated_flow_confirmed
        ? "Discovery → sync → canonical → research flow confirmed"
        : "Research automation not fully confirmed",
    },
    {
      id: "research.buying_committee",
      category: "research",
      satisfied: rp.buying_committee_present,
      detail: rp.buying_committee_present
        ? "Buying committee intelligence present"
        : "Buying committee not populated",
    },
    {
      id: "scoring.fit_score",
      category: "scoring",
      satisfied: rp.fit_score_present && f.score_available >= f.sequence_ready,
      detail: rp.fit_score_present
        ? `${f.score_available} contacts with scores available`
        : "Fit score not present on pilot cohort",
    },
    {
      id: "scoring.next_best_action",
      category: "scoring",
      satisfied: rp.next_best_action_present || f.sequence_ready === 0,
      detail: rp.next_best_action_present
        ? "Next best action generated for research pipeline"
        : "Next best action missing — sequence readiness may be blocked",
    },
    {
      id: "scoring.sequence_ready_gate",
      category: "scoring",
      satisfied: f.sequence_ready >= 1,
      detail:
        f.sequence_ready >= 1
          ? `${f.sequence_ready} contact(s) sequence-ready for enrollment assessment`
          : "Zero sequence-ready contacts — enrollment not certified",
    },
  ]

  const failures = requirements.filter((r) => !r.satisfied).map((r) => `[${r.category}] ${r.id}: ${r.detail}`)

  const enrollment_ready =
    f.sequence_ready >= 1 &&
    requirements.filter((r) => r.category !== "compliance" || r.id !== "compliance.orchestration").every((r) => r.satisfied)

  const summary = enrollment_ready
    ? `${f.sequence_ready} sequence-ready contact(s) meet enrollment eligibility requirements (execution still requires human approval).`
    : f.sequence_ready > 0
      ? `${f.sequence_ready} sequence-ready but ${failures.length} requirement(s) failed — conditional enrollment only.`
      : "No sequence-ready contacts — enrollment not certified."

  return {
    qa_marker: APOLLO_SEQUENCE_ELIGIBILITY_QA_MARKER,
    sequence_ready_count: f.sequence_ready,
    enrollment_ready,
    requirements,
    failures,
    summary,
  }
}
