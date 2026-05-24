import "server-only"

import { emptyGrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/capability-snapshot"
import { buildFixtureValidationResult } from "@/lib/growth/outbound/providers/fixture-validation"
import {
  createLemlistCampaignLead,
  listLemlistCampaigns,
  validateLemlistApiKey,
} from "@/lib/growth/outbound/providers/lemlist/lemlist-api-client"
import { parseLemlistConnectionConfig } from "@/lib/growth/outbound/providers/lemlist/lemlist-config"
import { mapLemlistExecutionError } from "@/lib/growth/outbound/providers/lemlist/lemlist-errors"
import {
  LEMLIST_PROVIDER_DISPLAY_NAME,
  LEMLIST_PROVIDER_KEY,
  LEMLIST_WEBHOOK_VERIFICATION_NOTE,
} from "@/lib/growth/outbound/providers/lemlist/lemlist-labels"
import {
  parseLemlistWebhookPayload,
  verifyLemlistWebhookSecret,
} from "@/lib/growth/outbound/providers/lemlist/lemlist-webhook-mapper"
import type { OutboundFixtureEnvelope } from "@/lib/growth/outbound/types"
import {
  defaultCostEstimate,
  defaultValidateExecution,
  envelopeToNormalized,
  type OutboundProviderAdapter,
} from "@/lib/growth/outbound/providers/types"

const LEMLIST_DECLARED = {
  ...emptyGrowthProviderCapabilitySnapshot(),
  supports_webhooks: "supported" as const,
  supports_replies: "supported" as const,
  supports_sequences: "supported" as const,
  supports_custom_tracking: "partial" as const,
  supports_unsubscribe_sync: "supported" as const,
  supports_reply_sync: "supported" as const,
  supports_contact_sync: "supported" as const,
  supports_campaign_sync: "supported" as const,
  supports_send: "supported" as const,
}

function readApiKey(credentials: Record<string, unknown> | null): string | null {
  const apiKey = credentials?.apiKey
  return typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : null
}

function splitContactName(fullName: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const trimmed = fullName?.trim()
  if (!trimmed) return { firstName: null, lastName: null }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null }
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null }
}

export const lemlistOutboundProviderAdapter: OutboundProviderAdapter = {
  providerKey() {
    return LEMLIST_PROVIDER_KEY
  },
  providerName() {
    return LEMLIST_PROVIDER_DISPLAY_NAME
  },
  providerFamily() {
    return "lemlist"
  },
  declaredCapabilities() {
    return LEMLIST_DECLARED
  },
  async validateConnection({ connection, credentials }) {
    const apiKey = readApiKey(credentials)
    if (!apiKey) {
      return buildFixtureValidationResult({
        declared: LEMLIST_DECLARED,
        config: connection.config,
        credentials,
        providerLabel: LEMLIST_PROVIDER_DISPLAY_NAME,
      })
    }

    try {
      const team = await validateLemlistApiKey({ apiKey, apiBaseUrl: connection.apiBaseUrl })
      const campaigns = await listLemlistCampaigns({ apiKey, apiBaseUrl: connection.apiBaseUrl, limit: 5 })
      const lemlistConfig = parseLemlistConnectionConfig(connection.config)
      const selected = campaigns.find((campaign) => campaign.id === lemlistConfig.defaultCampaignId)

      return {
        healthy: true,
        warnings: lemlistConfig.defaultCampaignId && !selected
          ? [{ code: "lemlist_campaign_not_found", message: "Configured default campaign was not found in Lemlist." }]
          : selected?.status === "running" && lemlistConfig.campaignAutoLaunchWarning
            ? [{ code: "lemlist_auto_launch", message: "Default campaign is running and may auto-launch outreach." }]
            : [],
        supportedCapabilities: LEMLIST_DECLARED,
        accountMetadata: {
          teamId: team.teamId,
          teamName: team.teamName,
          campaignCount: campaigns.length,
          defaultCampaignId: lemlistConfig.defaultCampaignId,
          defaultCampaignStatus: selected?.status ?? null,
          webhookVerification: LEMLIST_WEBHOOK_VERIFICATION_NOTE,
        },
      }
    } catch (error) {
      const mapped = mapLemlistExecutionError(error)
      return {
        healthy: false,
        warnings: [{ code: mapped.code, message: mapped.message }],
        supportedCapabilities: LEMLIST_DECLARED,
        accountMetadata: {},
      }
    }
  },
  verifyWebhookSignature(input) {
    let payload: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(input.rawBody) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>
      }
    } catch {
      payload = {}
    }
    return verifyLemlistWebhookSecret({
      secret: input.secret,
      headers: input.headers,
      payload,
    })
  },
  parseWebhookPayload(raw: unknown) {
    return parseLemlistWebhookPayload(raw)
  },
  normalizeEvent(envelope: OutboundFixtureEnvelope) {
    return envelopeToNormalized(envelope)
  },
  async validateExecution({ connection, credentials, message }) {
    const apiKey = readApiKey(credentials)
    if (!apiKey) {
      return { ok: false, warnings: [], message: "Lemlist API key is required." }
    }
    if (!message.to?.trim()) {
      return { ok: false, warnings: [], message: "Recipient email required." }
    }

    const lemlistConfig = parseLemlistConnectionConfig(connection.config)
    const metadataCampaignId =
      typeof message.metadata?.campaignId === "string" ? message.metadata.campaignId : null
    const campaignId = metadataCampaignId ?? lemlistConfig.defaultCampaignId
    if (!campaignId) {
      return { ok: false, warnings: [], message: "Select a Lemlist campaign before executing outreach." }
    }

    return defaultValidateExecution()
  },
  async execute({ connection, credentials, message }) {
    const apiKey = readApiKey(credentials)
    if (!apiKey) {
      return { ok: false, code: "lemlist_missing_credentials", message: "Lemlist API key is required." }
    }

    const lemlistConfig = parseLemlistConnectionConfig(connection.config)
    const metadataCampaignId =
      typeof message.metadata?.campaignId === "string" ? message.metadata.campaignId : null
    const campaignId = metadataCampaignId ?? lemlistConfig.defaultCampaignId
    if (!campaignId) {
      return { ok: false, code: "lemlist_missing_campaign", message: "Select a Lemlist campaign before executing outreach." }
    }

    const metadataFirstName =
      typeof message.metadata?.leadFirstName === "string" ? message.metadata.leadFirstName : null
    const metadataLastName = typeof message.metadata?.leadLastName === "string" ? message.metadata.leadLastName : null
    const metadataCompany =
      typeof message.metadata?.companyName === "string" ? message.metadata.companyName : null
    const metadataContactName =
      typeof message.metadata?.contactName === "string" ? message.metadata.contactName : null
    const split = splitContactName(metadataContactName)

    try {
      const created = await createLemlistCampaignLead({
        apiKey,
        apiBaseUrl: connection.apiBaseUrl,
        campaignId,
        deduplicate: lemlistConfig.deduplicateAcrossCampaigns,
        lead: {
          email: message.to.trim(),
          firstName: metadataFirstName ?? split.firstName,
          lastName: metadataLastName ?? split.lastName,
          companyName: metadataCompany,
          icebreaker: message.body?.trim() ? message.body.trim().slice(0, 1000) : null,
        },
      })

      return {
        ok: true,
        providerMessageId: created.leadId,
        raw: {
          stub: false,
          provider: LEMLIST_PROVIDER_KEY,
          leadId: created.leadId,
          contactId: created.contactId,
          campaignId: created.campaignId,
          campaignName: created.campaignName,
          isPaused: created.isPaused,
          submittedAt: new Date().toISOString(),
        },
      }
    } catch (error) {
      const mapped = mapLemlistExecutionError(error)
      return { ok: false, code: mapped.code, message: mapped.message }
    }
  },
  async costEstimate({ messageCount }) {
    return defaultCostEstimate(messageCount)
  },
}
