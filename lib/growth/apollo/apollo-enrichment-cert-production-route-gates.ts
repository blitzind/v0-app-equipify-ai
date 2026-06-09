/** Apollo EN-2 enrichment cert production route gates — client-safe, no secrets. */

import {
  APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM,
  APOLLO_ENRICHMENT_CERT_GATES_QA_MARKER,
  assertApolloEnrichmentCertAllowed,
  isApolloEnrichmentCertEnabled,
  resolveApolloEnrichmentCertCompanyCandidateId,
  resolveApolloEnrichmentCertMaxPeople,
  validateApolloEnrichmentCertConfirmation,
  type ApolloEnrichmentCertGateResult,
} from "@/lib/growth/apollo/apollo-enrichment-cert-gates"
import { getApolloApiKey } from "@/lib/growth/providers/apollo/apollo-config"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_QA_MARKER =
  "apollo-enrichment-cert-production-route-en-2-v1" as const

export {
  APOLLO_ENRICHMENT_CERT_EXECUTE_CONFIRM,
  validateApolloEnrichmentCertConfirmation,
}

export type ApolloEnrichmentCertProductionExecuteGateResult = ApolloEnrichmentCertGateResult

export function assertApolloEnrichmentCertProductionExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloEnrichmentCertProductionExecuteGateResult {
  return assertApolloEnrichmentCertAllowed(env)
}

const SECRET_RESPONSE_KEYS = new Set([
  "APOLLO_API_KEY",
  "GROWTH_APOLLO_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
])

export function redactApolloEnrichmentCertProductionSecrets<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if (SECRET_RESPONSE_KEYS.has(key)) return "[REDACTED]"
      return val
    }),
  ) as T
}

export function assertApolloEnrichmentCertProductionResponseHasNoSecrets(json: string): void {
  if (/APOLLO_API_KEY\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}/.test(json)) {
    throw new Error("Response appears to include APOLLO_API_KEY value")
  }
  if (/GROWTH_APOLLO_API_KEY\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}/.test(json)) {
    throw new Error("Response appears to include GROWTH_APOLLO_API_KEY value")
  }
  if (/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}/.test(json)) {
    throw new Error("Response appears to include SUPABASE_SERVICE_ROLE_KEY value")
  }
}

function apiKeySource(env: NodeJS.ProcessEnv): "APOLLO_API_KEY" | "GROWTH_APOLLO_API_KEY" | null {
  if (env.APOLLO_API_KEY?.trim()) return "APOLLO_API_KEY"
  if (env.GROWTH_APOLLO_API_KEY?.trim()) return "GROWTH_APOLLO_API_KEY"
  return null
}

export type ApolloEnrichmentCertProductionReadinessPayload = {
  qa_marker: typeof APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_QA_MARKER
  gates_marker: typeof APOLLO_ENRICHMENT_CERT_GATES_QA_MARKER
  checked_at: string
  ready: boolean
  enrichment_enabled: boolean
  enrich_emails_enabled: boolean
  api_configured: boolean
  api_key_source: "APOLLO_API_KEY" | "GROWTH_APOLLO_API_KEY" | null
  mock_mode: boolean
  cert_enabled: boolean
  company_candidate_id: string | null
  max_people: number
  candidate_count: number
  candidates_with_apollo_person_id: number
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloEnrichmentCertProductionReadinessPayload(
  input: {
    candidate_count: number
    candidates_with_apollo_person_id: number
    env?: NodeJS.ProcessEnv
    nowIso?: string
  },
): ApolloEnrichmentCertProductionReadinessPayload {
  const env = input.env ?? process.env
  const gates = assertApolloEnrichmentCertAllowed(env)
  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_ENRICHMENT_CERT_PRODUCTION_ROUTE_QA_MARKER,
    gates_marker: APOLLO_ENRICHMENT_CERT_GATES_QA_MARKER,
    checked_at: input.nowIso ?? new Date().toISOString(),
    ready: gates.ok && input.candidates_with_apollo_person_id > 0,
    enrichment_enabled: isApolloContactDiscoveryEnabled(env) && !isApolloDiscoveryDisabled(env),
    enrich_emails_enabled: isApolloEmailEnrichmentEnabled(env),
    api_configured: Boolean(getApolloApiKey(env)),
    api_key_source: apiKeySource(env),
    mock_mode: isApolloMockEnabled(env),
    cert_enabled: isApolloEnrichmentCertEnabled(env),
    company_candidate_id: resolveApolloEnrichmentCertCompanyCandidateId(env),
    max_people: resolveApolloEnrichmentCertMaxPeople(env),
    candidate_count: input.candidate_count,
    candidates_with_apollo_person_id: input.candidates_with_apollo_person_id,
    blockers:
      input.candidates_with_apollo_person_id === 0
        ? [
            ...gates.blockers,
            "No channel-less Apollo candidates with apollo_person_id — run search-only live pilot first.",
          ]
        : gates.blockers,
    config_diagnostics,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}
