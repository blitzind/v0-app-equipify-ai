import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"
import {
  createFixtureLeadEngineProviderBundle,
  invokeFixtureProviderSync,
} from "@/lib/growth/lead-engine/providers/fixture-provider"
import {
  createFutureExternalLeadEngineProviderBundle,
  createInternalGrowthLeadEngineProviderBundle,
} from "@/lib/growth/lead-engine/providers/internal-growth-provider"
import {
  buildProviderQuery,
  GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER,
  type GrowthLeadEngineProviderBundle,
  type GrowthLeadEngineProviderContext,
  type GrowthLeadEngineProviderMode,
  type GrowthLeadEngineProviderResponse,
  type GrowthLeadEngineProviderType,
  toPublicProviderResponse,
} from "@/lib/growth/lead-engine/providers/provider-types"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"

const STAGE_PROVIDER_TYPES: Partial<Record<GrowthLeadEnginePipelineStageId, GrowthLeadEngineProviderType[]>> = {
  icp_targeting: ["website_research", "company_identification"],
  company_discovery: ["company_research", "company_identification", "website_research"],
  decision_maker_hypothesis: ["decision_maker_research"],
  contact_research: ["contact_research"],
  verification_triage: ["verification"],
  account_brief: ["company_research", "intent_signal"],
  outreach_personalization: ["intent_signal"],
  lead_score: ["intent_signal"],
}

export function resolveLeadEngineProviderBundle(
  mode: GrowthLeadEngineProviderMode,
  admin?: SupabaseClient | null,
): GrowthLeadEngineProviderBundle {
  switch (mode) {
    case "internal":
      return createInternalGrowthLeadEngineProviderBundle(admin)
    case "future_external":
      return createFutureExternalLeadEngineProviderBundle()
    case "fixture":
    default:
      return createFixtureLeadEngineProviderBundle()
  }
}

export function providerTypesForStage(stageId: GrowthLeadEnginePipelineStageId): GrowthLeadEngineProviderType[] {
  return STAGE_PROVIDER_TYPES[stageId] ?? []
}

async function invokeProvider(
  bundle: GrowthLeadEngineProviderBundle,
  providerType: GrowthLeadEngineProviderType,
  context: GrowthLeadEngineProviderContext,
): Promise<GrowthLeadEngineProviderResponse> {
  switch (providerType) {
    case "company_research":
      return bundle.company_research.research(context)
    case "company_identification":
      return bundle.company_identification.identify(context)
    case "decision_maker_research":
      return bundle.decision_maker_research.research(context)
    case "contact_research":
      return bundle.contact_research.research(context)
    case "verification":
      return bundle.verification.verify(context)
    case "website_research":
      return bundle.website_research.research(context)
    case "intent_signal":
      return bundle.intent_signal.collect(context)
    default:
      return {
        provider_name: "unknown",
        provider_type: providerType,
        request_id: "unknown",
        query: context.query,
        status: "skipped",
        confidence: 0,
        evidence: [],
        source_attribution: [
          {
            source: "lead_engine_provider_registry",
            evidence: `Unknown provider type ${providerType}.`,
            confidence: 0,
          },
        ],
        raw_payload: null,
        normalized_payload: {},
        warnings: [],
        errors: [`Unknown provider type: ${providerType}`],
      }
  }
}

export async function fetchLeadEngineStageProviderResults(
  mode: GrowthLeadEngineProviderMode,
  input: GrowthLeadEngineSandboxInput,
  stageId: GrowthLeadEnginePipelineStageId,
  upstream: Record<string, unknown> | undefined,
  admin?: SupabaseClient | null,
): Promise<{
  qa_marker: typeof GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER
  mode: GrowthLeadEngineProviderMode
  stage_id: GrowthLeadEnginePipelineStageId
  responses: GrowthLeadEngineProviderResponse[]
  public_responses: ReturnType<typeof toPublicProviderResponse>[]
}> {
  const bundle = resolveLeadEngineProviderBundle(mode, admin)
  const context: GrowthLeadEngineProviderContext = {
    input,
    stage_id: stageId,
    query: buildProviderQuery(input, stageId),
    upstream,
  }

  const types = providerTypesForStage(stageId)
  const responses: GrowthLeadEngineProviderResponse[] = []

  for (const providerType of types) {
    try {
      const response = await invokeProvider(bundle, providerType, context)
      responses.push(response)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      responses.push({
        provider_name: bundle.mode,
        provider_type: providerType,
        request_id: "isolated_failure",
        query: context.query,
        status: "failed",
        confidence: 0,
        evidence: [],
        source_attribution: [
          {
            source: "lead_engine_provider_registry",
            section: stageId,
            signal: "isolated_failure",
            evidence: message,
            confidence: 0,
          },
        ],
        raw_payload: { error: message },
        normalized_payload: {},
        warnings: [],
        errors: [message],
      })
    }
  }

  return {
    qa_marker: GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER,
    mode,
    stage_id: stageId,
    responses,
    public_responses: responses.map(toPublicProviderResponse),
  }
}

/**
 * Synchronous provider fetch for fixture mode only (orchestrator dry-run stays sync).
 * Internal / future_external modes return skipped responses here — use async fetch for DB-backed providers.
 */
export function fetchLeadEngineStageProviderResultsSync(
  mode: GrowthLeadEngineProviderMode,
  input: GrowthLeadEngineSandboxInput,
  stageId: GrowthLeadEnginePipelineStageId,
  upstream: Record<string, unknown> | undefined,
): {
  qa_marker: typeof GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER
  mode: GrowthLeadEngineProviderMode
  stage_id: GrowthLeadEnginePipelineStageId
  responses: GrowthLeadEngineProviderResponse[]
  public_responses: ReturnType<typeof toPublicProviderResponse>[]
} {
  if (mode !== "fixture") {
    const bundle = resolveLeadEngineProviderBundle(mode, null)
    const context: GrowthLeadEngineProviderContext = {
      input,
      stage_id: stageId,
      query: buildProviderQuery(input, stageId),
      upstream,
    }
    const skipped = providerTypesForStage(stageId).map((providerType) => ({
      provider_name: bundle.mode,
      provider_type: providerType,
      request_id: "sync_skip",
      query: context.query,
      status: "skipped" as const,
      confidence: 0,
      evidence: [],
      source_attribution: [
        {
          source: "lead_engine_provider_registry",
          section: stageId,
          signal: "sync_skip",
          evidence: `${mode} providers require async pipeline — not invoked in sync dry-run.`,
          confidence: 0,
        },
      ],
      raw_payload: null,
      normalized_payload: {},
      warnings: [`Sync registry skip for mode ${mode}.`],
      errors: [],
    }))
    return {
      qa_marker: GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER,
      mode,
      stage_id: stageId,
      responses: skipped,
      public_responses: skipped.map(toPublicProviderResponse),
    }
  }

  const context: GrowthLeadEngineProviderContext = {
    input,
    stage_id: stageId,
    query: buildProviderQuery(input, stageId),
    upstream,
  }

  const types = providerTypesForStage(stageId)
  const responses: GrowthLeadEngineProviderResponse[] = []

  for (const providerType of types) {
    try {
      responses.push(invokeFixtureProviderSync(providerType, context))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      responses.push({
        provider_name: "fixture",
        provider_type: providerType,
        request_id: "sync_failure",
        query: context.query,
        status: "failed",
        confidence: 0,
        evidence: [],
        source_attribution: [
          {
            source: "lead_engine_provider_registry",
            evidence: message,
            confidence: 0,
          },
        ],
        raw_payload: { error: message },
        normalized_payload: {},
        warnings: [],
        errors: [message],
      })
    }
  }

  return {
    qa_marker: GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER,
    mode: "fixture",
    stage_id: stageId,
    responses,
    public_responses: responses.map(toPublicProviderResponse),
  }
}
