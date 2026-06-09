/** Apollo EN-2 enrichment cert production route orchestration — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildApolloEnrichmentCertEvidenceBundle } from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-bundle"
import type { ApolloEnrichmentCertEvidenceBundle } from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-bundle"
import { runApolloEnrichmentCertEn1 } from "@/lib/growth/apollo/apollo-enrichment-cert-runner"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import {
  assertApolloEnrichmentCertProductionExecuteAllowed,
  buildApolloEnrichmentCertProductionReadinessPayload,
  redactApolloEnrichmentCertProductionSecrets,
} from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  resolveApolloEnrichmentCertCompanyCandidateId,
  resolveApolloEnrichmentCertMaxPeople,
} from "@/lib/growth/apollo/apollo-enrichment-cert-gates"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

export type { ApolloEnrichmentCertProductionReadinessPayload } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
export { buildApolloEnrichmentCertProductionReadinessPayload } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

export type ApolloEnrichmentCertProductionExecuteResult = {
  ok: boolean
  execution_id: string
  company_candidate_id: string
  error?: "gates_failed" | "enrichment_failed" | "no_evidence"
  message?: string | null
  blockers?: string[]
  evidence_bundle: ApolloEnrichmentCertEvidenceBundle | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readApolloPersonId(candidate: GrowthContactCandidate): string | null {
  const metadata =
    candidate.metadata && typeof candidate.metadata === "object"
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  return asString(metadata.apollo_person_id) || null
}

export async function countApolloEnrichmentCertEligibleCandidates(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    max_people: number
  },
): Promise<{ candidate_count: number; candidates_with_apollo_person_id: number }> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, email, phone, linkedin_url, metadata")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(Math.max(input.max_people * 3, input.max_people))

  const rows = (data ?? []) as GrowthContactCandidate[]
  const eligible = rows.filter((candidate) => !candidateHasObservedContactChannel(candidate))
  const withPersonId = eligible.filter((candidate) => Boolean(readApolloPersonId(candidate)))

  return {
    candidate_count: eligible.length,
    candidates_with_apollo_person_id: withPersonId.slice(0, input.max_people).length,
  }
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

export async function buildApolloEnrichmentCertProductionReadiness(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReturnType<typeof buildApolloEnrichmentCertProductionReadinessPayload>> {
  const company_candidate_id = resolveApolloEnrichmentCertCompanyCandidateId(env)
  const max_people = resolveApolloEnrichmentCertMaxPeople(env)

  if (!company_candidate_id) {
    return buildApolloEnrichmentCertProductionReadinessPayload({
      candidate_count: 0,
      candidates_with_apollo_person_id: 0,
      env,
    })
  }

  const counts = await countApolloEnrichmentCertEligibleCandidates(admin, {
    company_candidate_id,
    max_people,
  })

  return buildApolloEnrichmentCertProductionReadinessPayload({
    ...counts,
    env,
  })
}

export async function executeApolloEnrichmentCertInProduction(
  admin: SupabaseClient,
  input?: {
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloEnrichmentCertProductionExecuteResult> {
  const env = input?.env ?? process.env
  const gates = assertApolloEnrichmentCertProductionExecuteAllowed(env)
  if (!gates.ok || !gates.company_candidate_id) {
    return {
      ok: false,
      error: "gates_failed",
      message: gates.error,
      blockers: gates.blockers,
      company_candidate_id: gates.company_candidate_id ?? "",
      execution_id: randomUUID(),
      evidence_bundle: null,
    }
  }

  const execution_id = randomUUID()
  const company_candidate_id = gates.company_candidate_id

  const result = await runApolloEnrichmentCertEn1(admin, {
    company_candidate_id,
    max_people: gates.max_people,
    env,
  })

  if (!result.evidence) {
    return redactApolloEnrichmentCertProductionSecrets({
      ok: false,
      error: result.error ? "enrichment_failed" : "no_evidence",
      message: result.error ?? "No enrichment evidence produced.",
      execution_id,
      company_candidate_id,
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
    ...(result.ok
      ? {}
      : {
          error: "enrichment_failed" as const,
          message:
            result.error ??
            (evidence_bundle.errors.length > 0
              ? evidence_bundle.errors.join(" | ")
              : "Apollo enrichment certification failed."),
        }),
    evidence_bundle,
  })
}
