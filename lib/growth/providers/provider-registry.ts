/** Delivery provider capability registry. Client-safe. */

import type {
  GrowthDeliveryProviderCapabilities,
  GrowthDeliveryProviderFamily,
} from "@/lib/growth/providers/provider-types"

export type GrowthDeliveryProviderRegistryEntry = {
  provider_family: GrowthDeliveryProviderFamily
  label: string
  capabilities: GrowthDeliveryProviderCapabilities
}

export const GROWTH_DELIVERY_PROVIDER_REGISTRY: Record<GrowthDeliveryProviderFamily, GrowthDeliveryProviderRegistryEntry> = {
  google: {
    provider_family: "google",
    label: "Google Workspace",
    capabilities: {
      send: true,
      replySync: true,
      tracking: true,
      templates: true,
      webhooks: false,
      rateLimits: true,
      validation: true,
    },
  },
  microsoft: {
    provider_family: "microsoft",
    label: "Microsoft 365",
    capabilities: {
      send: true,
      replySync: true,
      tracking: true,
      templates: true,
      webhooks: false,
      rateLimits: true,
      validation: true,
    },
  },
  smtp: {
    provider_family: "smtp",
    label: "SMTP",
    capabilities: {
      send: true,
      replySync: false,
      tracking: false,
      templates: false,
      webhooks: false,
      rateLimits: true,
      validation: true,
    },
  },
  ses: {
    provider_family: "ses",
    label: "Amazon SES",
    capabilities: {
      send: true,
      replySync: false,
      tracking: true,
      templates: true,
      webhooks: true,
      rateLimits: true,
      validation: true,
    },
  },
  mailgun: {
    provider_family: "mailgun",
    label: "Mailgun",
    capabilities: {
      send: true,
      replySync: false,
      tracking: true,
      templates: true,
      webhooks: true,
      rateLimits: true,
      validation: true,
    },
  },
  postmark: {
    provider_family: "postmark",
    label: "Postmark",
    capabilities: {
      send: true,
      replySync: false,
      tracking: true,
      templates: true,
      webhooks: true,
      rateLimits: true,
      validation: true,
    },
  },
  resend: {
    provider_family: "resend",
    label: "Resend",
    capabilities: {
      send: true,
      replySync: false,
      tracking: true,
      templates: true,
      webhooks: true,
      rateLimits: true,
      validation: true,
    },
  },
  custom: {
    provider_family: "custom",
    label: "Custom Provider",
    capabilities: {
      send: true,
      replySync: false,
      tracking: false,
      templates: false,
      webhooks: false,
      rateLimits: false,
      validation: false,
    },
  },
}

export function listDeliveryProviderRegistry(): GrowthDeliveryProviderRegistryEntry[] {
  return Object.values(GROWTH_DELIVERY_PROVIDER_REGISTRY)
}

export function getDeliveryProviderRegistryEntry(
  family: GrowthDeliveryProviderFamily,
): GrowthDeliveryProviderRegistryEntry {
  return GROWTH_DELIVERY_PROVIDER_REGISTRY[family]
}

export function capabilitiesToLabel(capabilities: GrowthDeliveryProviderCapabilities): string {
  const parts: string[] = []
  if (capabilities.send) parts.push("Send")
  if (capabilities.replySync) parts.push("Reply sync")
  if (capabilities.tracking) parts.push("Tracking")
  if (capabilities.templates) parts.push("Templates")
  if (capabilities.webhooks) parts.push("Webhooks")
  if (capabilities.rateLimits) parts.push("Rate limits")
  if (capabilities.validation) parts.push("Validation")
  return parts.length > 0 ? parts.join(", ") : "None"
}

export function registryCapabilitiesToDbFlags(capabilities: GrowthDeliveryProviderCapabilities) {
  return {
    supports_send: capabilities.send,
    supports_reply_sync: capabilities.replySync,
    supports_tracking: capabilities.tracking,
    supports_templates: capabilities.templates,
    supports_validation: capabilities.validation,
    supports_webhooks: capabilities.webhooks,
    supports_rate_limits: capabilities.rateLimits,
  }
}
