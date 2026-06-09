/** Apollo EN-1 enrichment certification gates — client-safe. */

import { diagnoseApolloContactDiscoveryConfig } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  getApolloApiKey,
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_ENRICHMENT_CERT_GATES_QA_MARKER = "apollo-enrichment-cert-gates-en-1-v1" as const

export const APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM = "RUN_APOLLO_ENRICHMENT_CERT" as const

export const APOLLO_ENRICHMENT_CERT_DEFAULT_MAX_PEOPLE = 10 as const

export type ApolloEnrichmentCertGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
  company_candidate_id: string | null
  max_people: number
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export function isApolloEnrichmentCertEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_EN_1_CERT_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function resolveApolloEnrichmentCertCompanyCandidateId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return (
    env.GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_4_COMPANY_CANDIDATE_ID?.trim() ||
    null
  )
}

export function resolveApolloEnrichmentCertMaxPeople(env: NodeJS.ProcessEnv = process.env): number {
  const requested = parsePositiveInt(
    env.GROWTH_APOLLO_EN_1_MAX_PEOPLE,
    APOLLO_ENRICHMENT_CERT_DEFAULT_MAX_PEOPLE,
  )
  return Math.min(requested, APOLLO_ENRICHMENT_CERT_DEFAULT_MAX_PEOPLE)
}

export function assertApolloEnrichmentCertAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloEnrichmentCertGateResult {
  const blockers: string[] = []
  const config = diagnoseApolloContactDiscoveryConfig(env)

  if (!isApolloEnrichmentCertEnabled(env)) {
    blockers.push("GROWTH_APOLLO_EN_1_CERT_ENABLED must be true")
  }

  if (!isApolloContactDiscoveryEnabled(env)) {
    blockers.push("GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED must be true")
  }

  if (isApolloDiscoveryDisabled(env)) {
    blockers.push("GROWTH_DISCOVERY_DISABLE_APOLLO kill switch is active")
  }

  if (!getApolloApiKey(env) && !isApolloMockEnabled(env)) {
    blockers.push("Apollo API key not configured (APOLLO_API_KEY or GROWTH_APOLLO_API_KEY)")
  }

  if (!isApolloEmailEnrichmentEnabled(env)) {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS must be true")
  }

  if (env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_EN_1_CERT_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_EN_1_CERT_ACK must be 1")
  }

  if (!config.ready_for_enrichment && !isApolloMockEnabled(env)) {
    blockers.push("Apollo config not ready_for_enrichment (see config_diagnostics)")
  }

  const company_candidate_id = resolveApolloEnrichmentCertCompanyCandidateId(env)
  if (!company_candidate_id) {
    blockers.push(
      "GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID or GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID must be set",
    )
  }

  return {
    ok: blockers.length === 0,
    error: blockers[0] ?? null,
    blockers,
    company_candidate_id,
    max_people: resolveApolloEnrichmentCertMaxPeople(env),
  }
}

export function validateApolloEnrichmentCertConfirmation(body: unknown): {
  ok: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM}".`,
    }
  }

  const confirm = (body as Record<string, unknown>).confirm
  if (confirm !== APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM}".`,
    }
  }

  return { ok: true, error: null }
}
