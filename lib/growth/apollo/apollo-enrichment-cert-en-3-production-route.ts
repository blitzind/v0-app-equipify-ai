/** Apollo EN-3 promotion cert production route orchestration — server-only, no Apollo HTTP. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildApolloEnrichmentCertEvidenceBundle } from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-bundle"
import type { ApolloEnrichmentCertEvidenceBundle } from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-bundle"
import {
  assertApolloEnrichmentCertEn3ProductionExecuteAllowed,
  buildApolloEnrichmentCertEn3ProductionReadinessPayload,
  redactApolloEnrichmentCertProductionSecrets,
} from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates"
import { countEnrichedCandidateChannels } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import { summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"
import { loadPersistedApolloCandidatesForPromotion } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion"
import { runApolloEnrichmentCertEn3 } from "@/lib/growth/apollo/apollo-enrichment-cert-runner"
import type { ApolloEnrichmentCertEvidence } from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-types"
import type { ApolloEnrichmentCertCanonicalCompanyResolutionEvidence } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"

export type { ApolloEnrichmentCertEn3ProductionReadinessPayload } from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates"
export { buildApolloEnrichmentCertEn3ProductionReadinessPayload } from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates"

export type ApolloEnrichmentCertEn3ProductionExecuteResult = {
  ok: boolean
  execution_id: string
  company_candidate_id: string
  error?: "gates_failed" | "promotion_failed" | "no_evidence"
  message?: string | null
  blockers?: string[]
  canonical_company_resolution?: ApolloEnrichmentCertCanonicalCompanyResolutionEvidence | null
  evidence: ApolloEnrichmentCertEvidence | null
  evidence_bundle: ApolloEnrichmentCertEvidenceBundle | null
}

function buildEn3PromotionFailureMessage(
  result: Awaited<ReturnType<typeof runApolloEnrichmentCertEn3>>,
): string {
  const resolution = result.evidence?.promotion.canonical_company_resolution
  if (resolution) {
    return (
      resolution.blocker_reason ??
      summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure(resolution)
    )
  }
  return result.error ?? "Apollo EN-3 promotion certification failed."
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function countCanonicalPersonMatches(
  admin: SupabaseClient,
  canonical_company_id: string | null,
): Promise<number> {
  if (!canonical_company_id) return 0

  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("canonical_person_id")
    .eq("company_id", canonical_company_id)

  let matches = 0
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>
    if (asString(row.canonical_person_id)) matches += 1
  }
  return matches
}

export async function buildApolloEnrichmentCertEn3ProductionReadiness(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string
    env?: NodeJS.ProcessEnv
  },
): Promise<ReturnType<typeof buildApolloEnrichmentCertEn3ProductionReadinessPayload>> {
  const env = input?.env ?? process.env
  const gates = assertApolloEnrichmentCertEn3ProductionExecuteAllowed(env)
  const company_candidate_id = input?.company_candidate_id?.trim() || gates.company_candidate_id

  const candidates = await loadPersistedApolloCandidatesForPromotion(admin, company_candidate_id)
  const channels = countEnrichedCandidateChannels(candidates)

  return buildApolloEnrichmentCertEn3ProductionReadinessPayload({
    enriched_candidate_count: candidates.length,
    enriched_candidates_with_email: channels.with_email,
    enriched_candidates_with_linkedin: channels.with_linkedin,
    env,
  })
}

export async function executeApolloEnrichmentCertEn3InProduction(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloEnrichmentCertEn3ProductionExecuteResult> {
  const env = input?.env ?? process.env
  const gates = assertApolloEnrichmentCertEn3ProductionExecuteAllowed(env)
  const company_candidate_id =
    input?.company_candidate_id?.trim() || gates.company_candidate_id

  if (!gates.ok) {
    return {
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      company_candidate_id,
      execution_id: randomUUID(),
      evidence: null,
      evidence_bundle: null,
    }
  }

  const execution_id = randomUUID()

  const result = await runApolloEnrichmentCertEn3(admin, {
    company_candidate_id,
    env,
  })

  if (!result.evidence) {
    return redactApolloEnrichmentCertProductionSecrets({
      ok: false,
      error: result.error ? "promotion_failed" : "no_evidence",
      message: result.error ?? "No EN-3 promotion evidence produced.",
      execution_id,
      company_candidate_id,
      evidence: null,
      evidence_bundle: null,
    })
  }

  const canonical_person_matches = await countCanonicalPersonMatches(
    admin,
    result.evidence.company.canonical_company_id,
  )

  const evidence_bundle = buildApolloEnrichmentCertEvidenceBundle({
    evidence: result.evidence,
    ok: result.ok,
    canonical_person_matches,
    canonical_company_matches: result.evidence.company.canonical_company_id ? 1 : 0,
  })

  return redactApolloEnrichmentCertProductionSecrets({
    ok: result.ok,
    execution_id,
    company_candidate_id,
    evidence: result.evidence,
    evidence_bundle,
    canonical_company_resolution: result.evidence?.promotion.canonical_company_resolution ?? null,
    ...(result.ok
      ? {}
      : {
          error: "promotion_failed" as const,
          message: buildEn3PromotionFailureMessage(result),
          blockers: result.evidence?.promotion.promotion_blockers,
        }),
  })
}
