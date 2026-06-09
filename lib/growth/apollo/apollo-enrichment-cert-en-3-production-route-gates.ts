/** Apollo EN-3 promotion cert production route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_ENRICHMENT_CERT_EN_3_PRODUCTION_ROUTE_QA_MARKER =
  "apollo-enrichment-cert-en-3-production-route-v1" as const

export const APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM =
  "RUN_APOLLO_ENRICHMENT_CERT_EN_3" as const

export const APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID =
  "d2e669d5-e912-4fb7-992a-b4f9a92ff56a" as const

export type ApolloEnrichmentCertEn3ProductionExecuteGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
  company_candidate_id: string
}

export function isApolloEnrichmentCertEn3Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_EN_3_CERT_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isApolloEnrichmentCertEn3ProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production"
}

export function resolveApolloEnrichmentCertEn3CompanyCandidateId(input?: {
  company_candidate_id?: string | null
  env?: NodeJS.ProcessEnv
}): string {
  const fromInput = input?.company_candidate_id?.trim()
  if (fromInput) return fromInput

  const env = input?.env ?? process.env
  return (
    env.GROWTH_APOLLO_EN_3_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID
  )
}

export function assertApolloEnrichmentCertEn3ProductionExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloEnrichmentCertEn3ProductionExecuteGateResult {
  const blockers: string[] = []

  if (!isApolloEnrichmentCertEn3ProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (!isApolloEnrichmentCertEn3Enabled(env)) {
    blockers.push("GROWTH_APOLLO_EN_3_CERT_ENABLED must be true")
  }

  if (env.GROWTH_APOLLO_EN_3_CERT_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_EN_3_CERT_ACK must be 1")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for production EN-3 certification")
  }

  const company_candidate_id = resolveApolloEnrichmentCertEn3CompanyCandidateId({ env })

  return {
    ok: blockers.length === 0,
    error: blockers[0] ?? null,
    blockers,
    company_candidate_id,
  }
}

export function validateApolloEnrichmentCertEn3Confirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_candidate_id: string
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM}".`,
      company_candidate_id: APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = record.confirm
  if (confirm !== APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_ENRICHMENT_CERT_EN_3_EXECUTE_CONFIRM}".`,
      company_candidate_id: APOLLO_ENRICHMENT_CERT_EN_3_DEFAULT_COMPANY_CANDIDATE_ID,
    }
  }

  const fromBody =
    typeof record.companyCandidateId === "string" ? record.companyCandidateId.trim() : ""

  return {
    ok: true,
    error: null,
    company_candidate_id: resolveApolloEnrichmentCertEn3CompanyCandidateId({
      company_candidate_id: fromBody || null,
    }),
  }
}

export type ApolloEnrichmentCertEn3ProductionReadinessPayload = {
  qa_marker: typeof APOLLO_ENRICHMENT_CERT_EN_3_PRODUCTION_ROUTE_QA_MARKER
  checked_at: string
  ready: boolean
  production_runtime: boolean
  cert_enabled: boolean
  company_candidate_id: string
  enriched_candidate_count: number
  enriched_candidates_with_email: number
  enriched_candidates_with_linkedin: number
  apollo_credits_required: false
  blockers: string[]
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloEnrichmentCertEn3ProductionReadinessPayload(input: {
  enriched_candidate_count: number
  enriched_candidates_with_email: number
  enriched_candidates_with_linkedin: number
  env?: NodeJS.ProcessEnv
  nowIso?: string
}): ApolloEnrichmentCertEn3ProductionReadinessPayload {
  const env = input.env ?? process.env
  const gates = assertApolloEnrichmentCertEn3ProductionExecuteAllowed(env)
  const blockers = [...gates.blockers]

  if (input.enriched_candidate_count === 0) {
    blockers.push(
      "No persisted enriched Apollo contact_candidates with contact channels — run EN-2 bulk_match first.",
    )
  }

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_ENRICHMENT_CERT_EN_3_PRODUCTION_ROUTE_QA_MARKER,
    checked_at: input.nowIso ?? new Date().toISOString(),
    ready: gates.ok && input.enriched_candidate_count > 0,
    production_runtime: isApolloEnrichmentCertEn3ProductionRuntime(env),
    cert_enabled: isApolloEnrichmentCertEn3Enabled(env),
    company_candidate_id: gates.company_candidate_id,
    enriched_candidate_count: input.enriched_candidate_count,
    enriched_candidates_with_email: input.enriched_candidates_with_email,
    enriched_candidates_with_linkedin: input.enriched_candidates_with_linkedin,
    apollo_credits_required: false,
    blockers,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets }
