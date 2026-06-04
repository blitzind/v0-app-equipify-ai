/** Client-safe outbound provider capability metadata (no live APIs). */

import type { GrowthOutboundProviderFamily } from "@/lib/growth/outbound/types"

export type OutboundProviderCapabilityKey =
  | "webhook_events"
  | "sequences"
  | "reply_detection"
  | "open_click_tracking"
  | "unsubscribe_handling"
  | "contact_sync_api"
  | "send_api"
  | "multi_inbox_warmup"
  | "suppression_sync"

export type OutboundProviderCapabilityStatus = "supported" | "partial" | "planned" | "n_a"

export type OutboundProviderCapabilities = {
  providerFamily: GrowthOutboundProviderFamily
  displayName: string
  summary: string
  capabilities: Record<OutboundProviderCapabilityKey, OutboundProviderCapabilityStatus>
  fixtureOnly: boolean
}

export const OUTBOUND_PROVIDER_CAPABILITY_LABELS: Record<OutboundProviderCapabilityKey, string> = {
  webhook_events: "Webhook events",
  sequences: "Sequences",
  reply_detection: "Reply detection",
  open_click_tracking: "Open/click tracking",
  unsubscribe_handling: "Unsubscribe handling",
  contact_sync_api: "Contact sync API",
  send_api: "Send API",
  multi_inbox_warmup: "Multi-inbox / warmup",
  suppression_sync: "Suppression sync",
}

const BASE_CAPABILITIES: Record<OutboundProviderCapabilityKey, OutboundProviderCapabilityStatus> = {
  webhook_events: "supported",
  sequences: "supported",
  reply_detection: "supported",
  open_click_tracking: "supported",
  unsubscribe_handling: "supported",
  contact_sync_api: "supported",
  send_api: "supported",
  multi_inbox_warmup: "supported",
  suppression_sync: "supported",
}

export const GROWTH_OUTBOUND_PROVIDER_CAPABILITIES: OutboundProviderCapabilities[] = [
  {
    providerFamily: "lemlist",
    displayName: "Lemlist",
    summary:
      "Rollback-only adapter — campaign lead push and webhooks when GROWTH_ALLOW_ADAPTER_OUTBOUND=true. Production uses native Gmail/Microsoft transport.",
    capabilities: {
      ...BASE_CAPABILITIES,
      multi_inbox_warmup: "partial",
    },
    fixtureOnly: false,
  },
  {
    providerFamily: "smartlead",
    displayName: "Smartlead",
    summary: "Sequence outbound with webhook event ingestion (fixture-only until live adapter).",
    capabilities: { ...BASE_CAPABILITIES },
    fixtureOnly: true,
  },
  {
    providerFamily: "instantly",
    displayName: "Instantly",
    summary: "Cold email sequences with engagement webhooks (fixture-only until live adapter).",
    capabilities: { ...BASE_CAPABILITIES },
    fixtureOnly: true,
  },
  {
    providerFamily: "emailbison",
    displayName: "EmailBison",
    summary: "Email automation platform with reply and bounce webhooks (fixture-only until live adapter).",
    capabilities: {
      ...BASE_CAPABILITIES,
      multi_inbox_warmup: "partial",
    },
    fixtureOnly: true,
  },
  {
    providerFamily: "custom",
    displayName: "Custom",
    summary: "Bring-your-own SMTP or webhook bridge; manual suppression and limited automation.",
    capabilities: {
      webhook_events: "partial",
      sequences: "planned",
      reply_detection: "partial",
      open_click_tracking: "partial",
      unsubscribe_handling: "partial",
      contact_sync_api: "n_a",
      send_api: "planned",
      multi_inbox_warmup: "n_a",
      suppression_sync: "partial",
    },
    fixtureOnly: true,
  },
]

export function getGrowthOutboundProviderCapabilities(
  providerFamily: GrowthOutboundProviderFamily,
): OutboundProviderCapabilities | undefined {
  return GROWTH_OUTBOUND_PROVIDER_CAPABILITIES.find((entry) => entry.providerFamily === providerFamily)
}
