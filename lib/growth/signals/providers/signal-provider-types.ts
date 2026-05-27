import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
  GrowthSignalType,
} from "@/lib/growth/signals/signal-types"

export type GrowthSignalProviderStatus = "active" | "inactive" | "stub"

export type GrowthSignalPollContext = {
  organization_id?: string | null
  cursor?: Record<string, unknown>
  sample_input?: unknown
  limit?: number
}

export type GrowthSignalProviderPollResult = {
  ok: boolean
  status: "completed" | "skipped" | "failed"
  provider_key: string
  drafts: GrowthNormalizedSignalDraft[]
  message?: string
  cursor?: Record<string, unknown>
}

export interface GrowthSignalProvider {
  provider_key: string
  display_name: string
  status: GrowthSignalProviderStatus
  supported_signal_types: GrowthSignalType[]
  isConfigured(): boolean
  poll(context: GrowthSignalPollContext): Promise<GrowthSignalProviderPollResult>
  normalize(raw: unknown): GrowthNormalizedSignalDraft[]
  extractEvidence(raw: unknown): GrowthSignalEvidenceDraft[]
  computeProviderConfidence(draft: GrowthNormalizedSignalDraft): number
}
