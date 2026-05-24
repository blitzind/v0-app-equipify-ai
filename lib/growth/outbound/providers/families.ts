import type { GrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/provider-types"
import { emptyGrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/capability-snapshot"
import { buildFixtureValidationResult } from "@/lib/growth/outbound/providers/fixture-validation"
import {
  defaultCostEstimate,
  defaultStubExecute,
  defaultValidateExecution,
  envelopeToNormalized,
  type OutboundProviderAdapter,
} from "@/lib/growth/outbound/providers/types"
import type { OutboundFixtureEnvelope } from "@/lib/growth/outbound/types"

function fixtureAdapter(input: {
  providerKey: string
  providerName: string
  providerFamily: "smartlead" | "instantly" | "emailbison" | "lemlist" | "custom"
  declared: GrowthProviderCapabilitySnapshot
}): OutboundProviderAdapter {
  return {
    providerKey() {
      return input.providerKey
    },
    providerName() {
      return input.providerName
    },
    providerFamily() {
      return input.providerFamily
    },
    declaredCapabilities() {
      return input.declared
    },
    async validateConnection({ connection, credentials }) {
      return buildFixtureValidationResult({
        declared: input.declared,
        config: connection.config,
        credentials,
        providerLabel: input.providerName,
      })
    },
    verifyWebhookSignature() {
      return { ok: true, mode: "skipped", message: "Fixture provider skips signature verification." }
    },
    parseWebhookPayload(raw: unknown) {
      if (Array.isArray(raw)) return raw as OutboundFixtureEnvelope[]
      if (raw && typeof raw === "object") return [raw as OutboundFixtureEnvelope]
      return []
    },
    normalizeEvent(envelope) {
      return envelopeToNormalized(envelope)
    },
    async validateExecution({ connection, credentials, message }) {
      const validation = await buildFixtureValidationResult({
        declared: input.declared,
        config: connection.config,
        credentials,
        providerLabel: input.providerName,
      })
      if (!validation.healthy) {
        return { ok: false, warnings: validation.warnings, message: "Provider connection unhealthy." }
      }
      if (!message.to?.trim()) {
        return { ok: false, warnings: [], message: "Recipient email required." }
      }
      return defaultValidateExecution()
    },
    async execute({ message }) {
      return defaultStubExecute(input.providerKey, message)
    },
    async costEstimate({ messageCount }) {
      return defaultCostEstimate(messageCount)
    },
  }
}

const FULL_FIXTURE: GrowthProviderCapabilitySnapshot = {
  supports_webhooks: "supported",
  supports_replies: "supported",
  supports_sequences: "supported",
  supports_custom_tracking: "supported",
  supports_unsubscribe_sync: "supported",
  supports_reply_sync: "supported",
  supports_contact_sync: "supported",
  supports_campaign_sync: "partial",
  supports_send: "supported",
}

export const smartleadOutboundProviderAdapter = fixtureAdapter({
  providerKey: "smartlead",
  providerName: "Smartlead",
  providerFamily: "smartlead",
  declared: FULL_FIXTURE,
})

export const instantlyOutboundProviderAdapter = fixtureAdapter({
  providerKey: "instantly",
  providerName: "Instantly",
  providerFamily: "instantly",
  declared: FULL_FIXTURE,
})

export const emailbisonOutboundProviderAdapter = fixtureAdapter({
  providerKey: "emailbison",
  providerName: "EmailBison",
  providerFamily: "emailbison",
  declared: {
    ...FULL_FIXTURE,
    supports_custom_tracking: "partial",
  },
})

export const customOutboundProviderAdapter = fixtureAdapter({
  providerKey: "custom",
  providerName: "Custom",
  providerFamily: "custom",
  declared: {
    ...emptyGrowthProviderCapabilitySnapshot(),
    supports_webhooks: "partial",
    supports_replies: "partial",
    supports_sequences: "unavailable",
    supports_custom_tracking: "partial",
    supports_unsubscribe_sync: "partial",
    supports_reply_sync: "partial",
    supports_contact_sync: "unavailable",
    supports_campaign_sync: "unavailable",
    supports_send: "unavailable",
  },
})
