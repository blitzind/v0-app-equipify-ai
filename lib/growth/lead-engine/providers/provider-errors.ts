import {
  createProviderResponse,
  type GrowthLeadEngineProviderContext,
  type GrowthLeadEngineProviderResponse,
  type GrowthLeadEngineProviderType,
} from "@/lib/growth/lead-engine/providers/provider-types"

export class GrowthLeadEngineProviderError extends Error {
  readonly provider_name: string
  readonly provider_type: GrowthLeadEngineProviderType
  readonly cause_detail: string

  constructor(
    providerName: string,
    providerType: GrowthLeadEngineProviderType,
    message: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = "GrowthLeadEngineProviderError"
    this.provider_name = providerName
    this.provider_type = providerType
    this.cause_detail = cause instanceof Error ? cause.message : String(cause ?? "")
  }
}

export function providerFailureResponse(
  providerName: string,
  providerType: GrowthLeadEngineProviderType,
  context: GrowthLeadEngineProviderContext,
  requestId: string,
  error: unknown,
  partial?: {
    normalized_payload?: unknown
    source_attribution?: GrowthLeadEngineProviderResponse["source_attribution"]
    confidence?: number
  },
): GrowthLeadEngineProviderResponse {
  const message = error instanceof Error ? error.message : String(error)
  return createProviderResponse({
    provider_name: providerName,
    provider_type: providerType,
    request_id: requestId,
    query: { ...context.query, stage_id: context.stage_id },
    status: partial?.normalized_payload != null ? "partial" : "failed",
    confidence: partial?.confidence ?? 0,
    source_attribution: partial?.source_attribution ?? [
      {
        source: providerName,
        section: context.stage_id,
        signal: "provider_error",
        evidence: `Provider failed in isolation: ${message}`,
        confidence: 0,
      },
    ],
    raw_payload: { error: message },
    normalized_payload: partial?.normalized_payload ?? {},
    warnings: partial?.normalized_payload != null ? ["Provider returned partial data after error."] : [],
    errors: [message],
  })
}

export function providerSkippedResponse(
  providerName: string,
  providerType: GrowthLeadEngineProviderType,
  context: GrowthLeadEngineProviderContext,
  requestId: string,
  reason: string,
): GrowthLeadEngineProviderResponse {
  return createProviderResponse({
    provider_name: providerName,
    provider_type: providerType,
    request_id: requestId,
    query: { ...context.query, stage_id: context.stage_id },
    status: "skipped",
    confidence: 0,
    source_attribution: [
      {
        source: providerName,
        section: context.stage_id,
        signal: "skipped",
        evidence: reason,
        confidence: 0,
      },
    ],
    raw_payload: null,
    normalized_payload: {},
    warnings: [reason],
    errors: [],
  })
}

export async function runProviderIsolated(
  providerName: string,
  providerType: GrowthLeadEngineProviderType,
  context: GrowthLeadEngineProviderContext,
  requestId: string,
  run: () => Promise<GrowthLeadEngineProviderResponse>,
): Promise<GrowthLeadEngineProviderResponse> {
  try {
    const response = await run()
    if (response.source_attribution.length === 0) {
      return providerFailureResponse(
        providerName,
        providerType,
        context,
        requestId,
        new Error("Provider response missing source_attribution."),
        {
          normalized_payload: response.normalized_payload,
          source_attribution: [
            {
              source: providerName,
              section: context.stage_id,
              signal: "attribution_missing",
              evidence: "Response rejected — attribution required.",
              confidence: 0,
            },
          ],
        },
      )
    }
    return response
  } catch (error) {
    return providerFailureResponse(providerName, providerType, context, requestId, error)
  }
}
