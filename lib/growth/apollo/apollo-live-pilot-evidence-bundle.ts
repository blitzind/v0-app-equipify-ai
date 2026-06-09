/** Apollo AI-4 hardened pilot evidence bundle — client-safe types. */

import type { ApolloAi3ProductionCertification } from "@/lib/growth/apollo/apollo-integration-ai-3-production-certification"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import type { ApolloLivePilotEvidenceValidation } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER = "apollo-live-pilot-evidence-bundle-ai-4-v1" as const

export type ApolloLivePilotOperatorCommands = {
  live_pilot: string
  validate: string
  env_check: string
  dry_run: string
  rollback: string
}

export type ApolloLivePilotEvidenceBundle = {
  qa_marker: typeof APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER
  captured_at: string
  ok: boolean
  target_company: ApolloLivePilotEvidence["company"]
  runtime: ApolloLivePilotEvidence["runtime"]
  discovery: ApolloLivePilotEvidence["discovery"]
  canonical_matching: ApolloLivePilotEvidence["canonical_matching"]
  readiness_funnel: ApolloLivePilotEvidence["readiness_funnel"]
  contact_quality_summary: {
    decision_maker_count: number
    with_email: number
    with_phone: number
    composite_score: number | null
  }
  cost_per_company: ApolloAi3ProductionCertification["analysis"]["cost_per_company"] | null
  cost_projections: ApolloAi3ProductionCertification["analysis"]["cost_projections"] | null
  go_no_go: ApolloAi3ProductionCertification["final_go_no_go"] | null
  errors: string[]
  validation: ApolloLivePilotEvidenceValidation
  evidence: ApolloLivePilotEvidence
  certification: ApolloAi3ProductionCertification | null
  operator_commands: ApolloLivePilotOperatorCommands
}

export function buildApolloLivePilotOperatorCommands(outputPath?: string | null): ApolloLivePilotOperatorCommands {
  const evidencePath = outputPath?.trim() || "./evidence/apollo-ai-3-pilot.json"
  return {
    env_check:
      "GET /api/platform/growth/apollo-live-pilot/readiness (platform admin session, Vercel Production runtime)",
    dry_run: "pnpm dry-run:apollo-live-pilot-ai-4 (local planning only — no Production secrets)",
    live_pilot: [
      "POST /api/platform/growth/apollo-live-pilot/execute",
      'Body: { "confirm": "RUN_APOLLO_LIVE_PILOT" }',
      "Auth: platform admin session on deployed Production",
      `Save response evidence_bundle to ${evidencePath}`,
    ].join("\n"),
    validate: `APOLLO_AI_3_PILOT_EVIDENCE_JSON=${evidencePath} pnpm test:apollo-integration-ai-3`,
    rollback:
      "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false GROWTH_DISCOVERY_DISABLE_APOLLO=1",
  }
}

export function buildApolloLivePilotEvidenceBundle(input: {
  evidence: ApolloLivePilotEvidence
  validation: ApolloLivePilotEvidenceValidation
  certification: ApolloAi3ProductionCertification | null
  ok: boolean
  output_path?: string | null
  captured_at?: string
}): ApolloLivePilotEvidenceBundle {
  const cert = input.certification

  return {
    qa_marker: APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER,
    captured_at: input.captured_at ?? new Date().toISOString(),
    ok: input.ok,
    target_company: input.evidence.company,
    runtime: input.evidence.runtime,
    discovery: input.evidence.discovery,
    canonical_matching: input.evidence.canonical_matching,
    readiness_funnel: input.evidence.readiness_funnel,
    contact_quality_summary: {
      decision_maker_count: input.evidence.contact_quality.decision_maker_count,
      with_email: input.evidence.contact_quality.with_email,
      with_phone: input.evidence.contact_quality.with_phone,
      composite_score: cert?.quality.composite_score ?? null,
    },
    cost_per_company: cert?.analysis.cost_per_company ?? null,
    cost_projections: cert?.analysis.cost_projections ?? null,
    go_no_go: cert?.final_go_no_go ?? null,
    errors: input.evidence.runtime.errors,
    validation: input.validation,
    evidence: input.evidence,
    certification: cert,
    operator_commands: buildApolloLivePilotOperatorCommands(input.output_path),
  }
}

export function isApolloLivePilotEvidenceBundle(value: unknown): value is ApolloLivePilotEvidenceBundle {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.qa_marker === APOLLO_LIVE_PILOT_EVIDENCE_BUNDLE_QA_MARKER
}

export function unwrapApolloLivePilotEvidenceBundle(value: unknown): {
  evidence: ApolloLivePilotEvidence
  certification: ApolloAi3ProductionCertification | null
} {
  if (isApolloLivePilotEvidenceBundle(value)) {
    return { evidence: value.evidence, certification: value.certification }
  }
  return { evidence: value as ApolloLivePilotEvidence, certification: null }
}
