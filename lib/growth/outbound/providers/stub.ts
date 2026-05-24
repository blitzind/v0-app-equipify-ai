import { GROWTH_OUTBOUND_STUB_PROVIDER } from "@/lib/growth/outbound/constants"
import { emptyGrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/capability-snapshot"
import { buildFixtureValidationResult } from "@/lib/growth/outbound/providers/fixture-validation"
import type { OutboundFixtureEnvelope } from "@/lib/growth/outbound/types"
import {
  defaultCostEstimate,
  defaultStubExecute,
  defaultValidateExecution,
  envelopeToNormalized,
  type OutboundProviderAdapter,
} from "@/lib/growth/outbound/providers/types"

const STUB_DECLARED = {
  ...emptyGrowthProviderCapabilitySnapshot(),
  supports_webhooks: "supported" as const,
  supports_replies: "supported" as const,
  supports_sequences: "supported" as const,
  supports_custom_tracking: "supported" as const,
  supports_unsubscribe_sync: "supported" as const,
  supports_reply_sync: "supported" as const,
  supports_contact_sync: "supported" as const,
  supports_campaign_sync: "partial" as const,
  supports_send: "supported" as const,
}

export const stubOutboundProviderAdapter: OutboundProviderAdapter = {
  providerKey() {
    return GROWTH_OUTBOUND_STUB_PROVIDER
  },
  providerName() {
    return "Fixture provider (stub)"
  },
  providerFamily() {
    return "custom"
  },
  declaredCapabilities() {
    return STUB_DECLARED
  },
  async validateConnection({ connection, credentials }) {
    return buildFixtureValidationResult({
      declared: STUB_DECLARED,
      config: connection.config,
      credentials,
      providerLabel: "Stub provider",
    })
  },
  verifyWebhookSignature() {
    return { ok: true, mode: "skipped", message: "Stub provider skips signature verification." }
  },
  parseWebhookPayload(raw: unknown) {
    if (Array.isArray(raw)) {
      return raw as OutboundFixtureEnvelope[]
    }
    if (raw && typeof raw === "object") {
      return [raw as OutboundFixtureEnvelope]
    }
    return []
  },
  normalizeEvent(envelope) {
    return envelopeToNormalized(envelope)
  },
  async validateExecution({ message }) {
    if (!message.to?.trim()) return { ok: false, warnings: [], message: "Recipient email required." }
    return defaultValidateExecution()
  },
  async execute({ message }) {
    return defaultStubExecute(GROWTH_OUTBOUND_STUB_PROVIDER, message)
  },
  async costEstimate({ messageCount }) {
    return defaultCostEstimate(messageCount)
  },
}
