/** Apollo-Primary-1 production gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  isApolloApiConfigured,
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_PRIMARY_CONTACT_ACQUISITION_GATES_QA_MARKER =
  "apollo-primary-contact-acquisition-gates-v1" as const

export const APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM =
  "RUN_APOLLO_PRIMARY_CONTACT_ACQUISITION" as const

export const APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID =
  "d2e669d5-e912-4fb7-992a-b4f9a92ff56a" as const

export type ApolloPrimaryContactAcquisitionGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
  company_candidate_id: string
  contact_limit: number
}

export function isApolloPrimaryContactAcquisitionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isApolloPrimaryContactAcquisitionProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production"
}

export function resolveApolloPrimaryContactAcquisitionCompanyCandidateId(input?: {
  company_candidate_id?: string | null
  env?: NodeJS.ProcessEnv
}): string {
  const fromInput = input?.company_candidate_id?.trim()
  if (fromInput) return fromInput

  const env = input?.env ?? process.env
  return (
    env.GROWTH_APOLLO_PRIMARY_1_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_EN_3_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID
  )
}

export function resolveApolloPrimaryContactAcquisitionContactLimit(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.GROWTH_APOLLO_PRIMARY_1_CONTACT_LIMIT?.trim()
  const parsed = raw ? Number.parseInt(raw, 10) : 10
  if (!Number.isFinite(parsed) || parsed <= 0) return 10
  return Math.min(parsed, 25)
}

export function assertApolloPrimaryContactAcquisitionAllowed(
  env: NodeJS.ProcessEnv = process.env,
  input?: { require_production?: boolean },
): ApolloPrimaryContactAcquisitionGateResult {
  const blockers: string[] = []
  const requireProduction = input?.require_production !== false

  if (requireProduction && !isApolloPrimaryContactAcquisitionProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (!isApolloPrimaryContactAcquisitionEnabled(env)) {
    blockers.push("GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ENABLED must be true")
  }

  if (env.GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_PRIMARY_CONTACT_ACQUISITION_ACK must be 1")
  }

  if (!isApolloContactDiscoveryEnabled(env)) {
    blockers.push("GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED must be true")
  }

  if (isApolloDiscoveryDisabled(env)) {
    blockers.push("GROWTH_DISCOVERY_DISABLE_APOLLO must not be set")
  }

  if (!isApolloApiConfigured(env) && !isApolloMockEnabled(env)) {
    blockers.push("Apollo provider must be configured (APOLLO_API_KEY or mock mode)")
  }

  if (requireProduction && isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for production Apollo-Primary-1")
  }

  const company_candidate_id = resolveApolloPrimaryContactAcquisitionCompanyCandidateId({ env })

  return {
    ok: blockers.length === 0,
    error: blockers[0] ?? null,
    blockers,
    company_candidate_id,
    contact_limit: resolveApolloPrimaryContactAcquisitionContactLimit(env),
  }
}

export function validateApolloPrimaryContactAcquisitionConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_candidate_id: string
  contact_limit: number
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM}".`,
      company_candidate_id: APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID,
      contact_limit: 10,
    }
  }

  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_PRIMARY_CONTACT_ACQUISITION_EXECUTE_CONFIRM}".`,
      company_candidate_id: APOLLO_PRIMARY_CONTACT_ACQUISITION_DEFAULT_COMPANY_CANDIDATE_ID,
      contact_limit: 10,
    }
  }

  const fromBody =
    typeof record.companyCandidateId === "string" ? record.companyCandidateId.trim() : ""
  const limitRaw =
    typeof record.contactLimit === "number"
      ? record.contactLimit
      : typeof record.contactLimit === "string"
        ? Number.parseInt(record.contactLimit, 10)
        : undefined

  return {
    ok: true,
    error: null,
    company_candidate_id: resolveApolloPrimaryContactAcquisitionCompanyCandidateId({
      company_candidate_id: fromBody || null,
    }),
    contact_limit:
      limitRaw && Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 25)
        : resolveApolloPrimaryContactAcquisitionContactLimit(),
  }
}

export type ApolloPrimaryContactAcquisitionReadinessPayload = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_ACQUISITION_GATES_QA_MARKER
  checked_at: string
  ready: boolean
  primary_enabled: boolean
  production_runtime: boolean
  apollo_configured: boolean
  enrich_emails: boolean
  company_candidate_id: string
  contact_limit: number
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloPrimaryContactAcquisitionReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  nowIso?: string
  company_candidate_id?: string | null
}): ApolloPrimaryContactAcquisitionReadinessPayload {
  const env = input?.env ?? process.env
  const gates = assertApolloPrimaryContactAcquisitionAllowed(env)
  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)
  const company_candidate_id =
    input?.company_candidate_id?.trim() ||
    resolveApolloPrimaryContactAcquisitionCompanyCandidateId({ env })

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_PRIMARY_CONTACT_ACQUISITION_GATES_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok && config_diagnostics.ready_for_live_benchmark,
    primary_enabled: isApolloPrimaryContactAcquisitionEnabled(env),
    production_runtime: isApolloPrimaryContactAcquisitionProductionRuntime(env),
    apollo_configured: isApolloApiConfigured(env) || isApolloMockEnabled(env),
    enrich_emails: isApolloEmailEnrichmentEnabled(env),
    company_candidate_id,
    contact_limit: gates.contact_limit,
    blockers: [...gates.blockers, ...config_diagnostics.issues.map((issue) => issue.message)],
    config_diagnostics,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloPrimaryContactAcquisitionSecrets }
