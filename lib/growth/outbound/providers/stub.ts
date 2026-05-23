import { GROWTH_OUTBOUND_STUB_PROVIDER } from "@/lib/growth/outbound/constants"
import type { OutboundFixtureEnvelope } from "@/lib/growth/outbound/types"
import { envelopeToNormalized, type OutboundProviderAdapter } from "@/lib/growth/outbound/providers/types"

export const stubOutboundProviderAdapter: OutboundProviderAdapter = {
  providerKey() {
    return GROWTH_OUTBOUND_STUB_PROVIDER
  },
  providerName() {
    return "Fixture provider (stub)"
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
}
