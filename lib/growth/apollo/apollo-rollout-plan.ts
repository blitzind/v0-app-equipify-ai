/** Apollo AI-3 controlled rollout plan from live pilot evidence — client-safe. */

import type { ApolloContactQualityScore } from "@/lib/growth/apollo/apollo-contact-quality-score"
import type { ApolloLivePilotAnalysis } from "@/lib/growth/apollo/apollo-live-pilot-analysis"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_ROLLOUT_PLAN_QA_MARKER = "apollo-rollout-plan-ai-3-v1" as const

export type ApolloRolloutPhase = {
  phase: 1 | 2 | 3
  name: string
  companies_per_day: { min: number; max: number }
  approval_requirements: string[]
  monitoring_requirements: string[]
  rollback_triggers: string[]
  entry_criteria: string[]
}

export type ApolloControlledRolloutPlan = {
  qa_marker: typeof APOLLO_ROLLOUT_PLAN_QA_MARKER
  based_on_live_evidence: boolean
  phases: ApolloRolloutPhase[]
  global_rollback: string[]
  operator_notes: string[]
}

export function buildApolloControlledRolloutPlan(input: {
  evidence: ApolloLivePilotEvidence
  analysis: ApolloLivePilotAnalysis
  quality: ApolloContactQualityScore
}): ApolloControlledRolloutPlan {
  const live = !input.evidence.mock
  const go = input.analysis.go_no_go.verdict === "go"
  const conditional = input.analysis.go_no_go.verdict === "conditional_go"
  const qualityOk = input.quality.composite_score >= 65
  const sequenceReady = input.evidence.readiness_funnel.sequence_ready > 0

  const phase1Max = live && (go || conditional) && sequenceReady ? 10 : 1
  const phase2Max =
    live && go && qualityOk && input.quality.composite_score >= 70 ? 25 : 5
  const phase3Max =
    live && go && input.quality.composite_score >= 80 && sequenceReady ? 100 : 25

  const sharedMonitoring = [
    "Apollo API error rate and rate-limit events (Twilio/Apollo console + app logs)",
    "contact_candidates vs company_contacts sync ratio per run",
    "canonical person linkage rate after backfill",
    "readiness funnel: imported → sequence_ready conversion",
    "Sequence execution job failure rate for Apollo-sourced leads",
  ]

  const sharedRollback = [
    "Apollo API error rate >15% for 24h",
    "Duplicate canonical person creation spike (>2 per company contact)",
    "Compliance block rate >25% on Apollo-imported phones",
    "Zero sequence-ready contacts for 3 consecutive pilot days",
  ]

  return {
    qa_marker: APOLLO_ROLLOUT_PLAN_QA_MARKER,
    based_on_live_evidence: live,
    phases: [
      {
        phase: 1,
        name: "Controlled pilot wave",
        companies_per_day: { min: 1, max: phase1Max },
        entry_criteria: [
          live ? "AI-3 live pilot evidence on file" : "Complete live pilot before Phase 1",
          "GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1 on certified environment",
          "Manual operator review per company before sequence enrollment",
        ],
        approval_requirements: [
          "Platform admin approves each company for Apollo discovery run",
          "Human approval on every sequence execution job",
          "Voice Drop campaigns approved before multichannel_with_voice_drop pattern",
        ],
        monitoring_requirements: [...sharedMonitoring, "Daily review of pilot evidence JSON metrics"],
        rollback_triggers: [
          ...sharedRollback,
          "Any Twilio/Apollo billing anomaly vs projected cost model",
        ],
      },
      {
        phase: 2,
        name: "Limited production",
        companies_per_day: { min: 10, max: phase2Max },
        entry_criteria: [
          "7 consecutive days Phase 1 with go or conditional_go verdict",
          `Contact quality composite ≥70 (pilot: ${input.quality.composite_score})`,
          "At least 1 sequence-ready contact per company average in Phase 1",
        ],
        approval_requirements: [
          "Daily ops review of Apollo run guardrail snapshots",
          "Campaign-level approval for message variants",
          "No bulk auto-enrollment — per-lead job approval remains",
        ],
        monitoring_requirements: [
          ...sharedMonitoring,
          "Weekly cost projection vs actual credits consumed",
          "Decision-maker accuracy spot-check (10% sample)",
        ],
        rollback_triggers: sharedRollback,
      },
      {
        phase: 3,
        name: "Scaled controlled rollout",
        companies_per_day: { min: 25, max: phase3Max },
        entry_criteria: [
          "30 days Phase 2 without rollback trigger",
          "Quality grade good or excellent for 2 consecutive weeks",
          "VD-4 Voice Drop live certification if using voice_drop sequences",
        ],
        approval_requirements: [
          "Ops lead sign-off for daily volume above Phase 2 max",
          "Pre-approved sequence patterns only (no ad-hoc Apollo messaging)",
          "Weekly compliance audit on Apollo-sourced outreach",
        ],
        monitoring_requirements: [
          ...sharedMonitoring,
          "Automated alert on guardrail ApolloRunGuardrailError",
          "Engagement metrics by Apollo source vs baseline",
        ],
        rollback_triggers: [
          ...sharedRollback,
          "Carrier or compliance escalation on Voice Drop / SMS channels",
        ],
      },
    ],
    global_rollback: [
      "Set GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false",
      "Set GROWTH_DISCOVERY_DISABLE_APOLLO=1",
      "Pause active Apollo-linked sequence patterns",
      "Cancel pending voice_drop / SMS execution jobs",
    ],
    operator_notes: live
      ? [
          `Pilot quality grade: ${input.quality.grade} (${input.quality.composite_score}/100)`,
          `Go/no-go: ${input.analysis.go_no_go.verdict}`,
          "Bulk automated enrollment remains disabled at all phases.",
        ]
      : ["Rollout phases use conservative defaults until live pilot evidence is captured."],
  }
}
