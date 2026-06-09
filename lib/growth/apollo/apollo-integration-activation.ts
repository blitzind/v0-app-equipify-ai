/** Apollo integration AI-1 — activation requirements (client-safe). */

import { diagnoseApolloContactDiscoveryConfig } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  APOLLO_BULK_MATCH_PATH,
  APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  isApolloProviderConfigured,
  resolveApolloApiBaseUrl,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_INTEGRATION_AI_1_ACTIVATION_QA_MARKER = "apollo-integration-ai-1-activation-v1" as const

export type ApolloActivationMode = "disabled" | "mock" | "live_search" | "live_enrichment"

export type ApolloActivationRequirement = {
  id: string
  category: "env" | "safety" | "api" | "limits"
  required: boolean
  variable?: string
  description: string
  satisfied: boolean
}

export type ApolloActivationReport = {
  qa_marker: typeof APOLLO_INTEGRATION_AI_1_ACTIVATION_QA_MARKER
  mode: ApolloActivationMode
  provider_configured: boolean
  ready_for_live_search: boolean
  ready_for_live_benchmark: boolean
  ready_for_enrichment: boolean
  api: {
    base_url: string
    people_search_path: string
    bulk_match_path: string
    rate_limits: ReturnType<typeof resolveApolloCreditLimits>
  }
  credit_paths: Array<{
    operation: string
    consumes_credits: boolean
    gate: string
  }>
  requirements: ApolloActivationRequirement[]
  mock_vs_live: {
    mock_enabled: boolean
    live_key_required: boolean
    mock_wins_when_both: boolean
  }
}

function pushRequirement(
  requirements: ApolloActivationRequirement[],
  requirement: ApolloActivationRequirement,
): void {
  requirements.push(requirement)
}

export function resolveApolloActivationMode(env: NodeJS.ProcessEnv = process.env): ApolloActivationMode {
  if (isApolloDiscoveryDisabled(env) || !isApolloContactDiscoveryEnabled(env)) return "disabled"
  if (isApolloMockEnabled(env)) return "mock"
  if (isApolloEmailEnrichmentEnabled(env)) return "live_enrichment"
  return "live_search"
}

export function buildApolloActivationReport(env: NodeJS.ProcessEnv = process.env): ApolloActivationReport {
  const diagnostics = diagnoseApolloContactDiscoveryConfig(env)
  const requirements: ApolloActivationRequirement[] = []
  const mock_enabled = isApolloMockEnabled(env)
  const mode = resolveApolloActivationMode(env)

  pushRequirement(requirements, {
    id: "master_enable",
    category: "env",
    required: true,
    variable: "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED",
    description: "Set to true to include Apollo in contact discovery operator chain.",
    satisfied: isApolloContactDiscoveryEnabled(env),
  })

  pushRequirement(requirements, {
    id: "kill_switch_off",
    category: "safety",
    required: true,
    variable: "GROWTH_DISCOVERY_DISABLE_APOLLO",
    description: "Must not be 1 — hard kill switch for Apollo.",
    satisfied: !isApolloDiscoveryDisabled(env),
  })

  pushRequirement(requirements, {
    id: "api_key_or_mock",
    category: "env",
    required: !mock_enabled,
    variable: "APOLLO_API_KEY | GROWTH_APOLLO_API_KEY",
    description: "Live HTTP requires API key unless GROWTH_APOLLO_USE_MOCK=true.",
    satisfied: mock_enabled || diagnostics.api_key_present,
  })

  pushRequirement(requirements, {
    id: "live_benchmark_ack",
    category: "safety",
    required: mode === "live_search" || mode === "live_enrichment",
    variable: "GROWTH_APOLLO_LIVE_BENCHMARK_ACK",
    description: "Set to 1 before live benchmark or bulk runs that consume API quota.",
    satisfied: env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK === "1" || mock_enabled,
  })

  pushRequirement(requirements, {
    id: "enrichment_ack",
    category: "safety",
    required: isApolloEmailEnrichmentEnabled(env) && !mock_enabled,
    variable: "GROWTH_APOLLO_ENRICH_EMAILS_ACK",
    description: "Required when GROWTH_APOLLO_ENRICH_EMAILS=true (bulk_match consumes credits).",
    satisfied:
      !isApolloEmailEnrichmentEnabled(env) ||
      mock_enabled ||
      env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
  })

  return {
    qa_marker: APOLLO_INTEGRATION_AI_1_ACTIVATION_QA_MARKER,
    mode,
    provider_configured: isApolloProviderConfigured(env),
    ready_for_live_search: diagnostics.ready_for_live_search,
    ready_for_live_benchmark: diagnostics.ready_for_live_benchmark,
    ready_for_enrichment: diagnostics.ready_for_enrichment,
    api: {
      base_url: resolveApolloApiBaseUrl(),
      people_search_path: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      bulk_match_path: APOLLO_BULK_MATCH_PATH,
      rate_limits: resolveApolloCreditLimits(env),
    },
    credit_paths: [
      {
        operation: "mixed_people/api_search",
        consumes_credits: false,
        gate: "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED + operator chain opt-in",
      },
      {
        operation: "people/bulk_match",
        consumes_credits: true,
        gate: "GROWTH_APOLLO_ENRICH_EMAILS=true + GROWTH_APOLLO_ENRICH_EMAILS_ACK=1",
      },
    ],
    requirements,
    mock_vs_live: {
      mock_enabled,
      live_key_required: !mock_enabled,
      mock_wins_when_both: mock_enabled && diagnostics.api_key_present,
    },
  }
}
