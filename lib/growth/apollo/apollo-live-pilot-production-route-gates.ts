/** Apollo live pilot production route gates — client-safe, no secrets. */

import {
  buildApolloLivePilotEnvReadinessReport,
  type ApolloLivePilotEnvReadinessReport,
} from "@/lib/growth/apollo/apollo-live-pilot-env-readiness"
import {
  buildApolloLivePilotSafetyReport,
  type ApolloLivePilotSafetyReport,
} from "@/lib/growth/apollo/apollo-live-pilot-safety"
import { getApolloApiKey } from "@/lib/growth/providers/apollo/apollo-config"
import {
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloMockEnabled,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER =
  "apollo-live-pilot-production-route-v1" as const

export const APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM = "RUN_APOLLO_LIVE_PILOT" as const

export type ApolloLivePilotProductionExecuteGateResult = {
  ok: boolean
  error: string | null
  company_candidate_id: string | null
  blockers: string[]
}

export function resolveApolloLivePilotProductionCompanyCandidateId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return (
    env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_4_COMPANY_CANDIDATE_ID?.trim() ||
    null
  )
}

export function validateApolloLivePilotProductionExecuteConfirmation(body: unknown): {
  ok: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM}".`,
    }
  }

  const confirm = (body as Record<string, unknown>).confirm
  if (confirm !== APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM}".`,
    }
  }

  return { ok: true, error: null }
}

export function assertApolloLivePilotProductionExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloLivePilotProductionExecuteGateResult {
  const blockers: string[] = []

  if (!isApolloContactDiscoveryEnabled(env)) {
    blockers.push("GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED must be true")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED !== "true") {
    blockers.push("GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED must be true")
  }

  const company_candidate_id = resolveApolloLivePilotProductionCompanyCandidateId(env)
  if (!company_candidate_id) {
    blockers.push("GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID must be set")
  }

  if (isApolloDiscoveryDisabled(env)) {
    blockers.push("GROWTH_DISCOVERY_DISABLE_APOLLO kill switch is active")
  }

  if (!getApolloApiKey(env)) {
    blockers.push("Apollo API key not configured (APOLLO_API_KEY or GROWTH_APOLLO_API_KEY)")
  }

  return {
    ok: blockers.length === 0,
    error: blockers[0] ?? null,
    company_candidate_id,
    blockers,
  }
}

const SECRET_RESPONSE_KEYS = new Set([
  "APOLLO_API_KEY",
  "GROWTH_APOLLO_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
])

export function redactApolloLivePilotProductionSecrets<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if (SECRET_RESPONSE_KEYS.has(key)) return "[REDACTED]"
      return val
    }),
  ) as T
}

export function assertApolloLivePilotProductionResponseHasNoSecrets(json: string): void {
  if (/APOLLO_API_KEY\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}/.test(json)) {
    throw new Error("Response appears to include APOLLO_API_KEY value")
  }
  if (/GROWTH_APOLLO_API_KEY\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}/.test(json)) {
    throw new Error("Response appears to include GROWTH_APOLLO_API_KEY value")
  }
}

export type ApolloLivePilotProductionReadinessPayload = {
  qa_marker: typeof APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER
  readiness: ApolloLivePilotEnvReadinessReport
  safety: ApolloLivePilotSafetyReport
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloLivePilotProductionReadinessPayload(
  env: NodeJS.ProcessEnv = process.env,
): ApolloLivePilotProductionReadinessPayload {
  return redactApolloLivePilotProductionSecrets({
    qa_marker: APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER,
    readiness: buildApolloLivePilotEnvReadinessReport(env),
    safety: buildApolloLivePilotSafetyReport(env),
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}
