import "server-only"

import type { GrowthSmsProviderKind } from "@/lib/growth/sms/sms-types"
import type { GrowthSmsProviderAdapter } from "@/lib/growth/sms/providers/sms-provider-types"
import { createTwilioGrowthSmsProvider } from "@/lib/growth/sms/providers/twilio-sms-provider"

function createPlaceholderProvider(kind: GrowthSmsProviderKind): GrowthSmsProviderAdapter {
  return {
    kind,
    capabilities() {
      return {
        supportsStatusCallbacks: false,
        supportsMessagingServiceSid: false,
        supportsInboundWebhooks: false,
      }
    },
    async health() {
      return { ok: false, message: `${kind} SMS provider is not configured in Phase 5.1.` }
    },
    async send() {
      return { ok: false, code: "not_configured", message: `${kind} SMS provider is not configured.` }
    },
  }
}

const noopProvider: GrowthSmsProviderAdapter = {
  kind: "noop",
  capabilities() {
    return {
      supportsStatusCallbacks: false,
      supportsMessagingServiceSid: false,
      supportsInboundWebhooks: false,
    }
  },
  async health() {
    return { ok: true, message: "Noop SMS provider — no network I/O." }
  },
  async send() {
    return { ok: true, providerMessageId: `noop-${Date.now()}`, status: "sent" }
  },
}

export function resolveGrowthSmsProvider(kind: GrowthSmsProviderKind): GrowthSmsProviderAdapter {
  switch (kind) {
    case "twilio":
      return createTwilioGrowthSmsProvider()
    case "telnyx":
      return createPlaceholderProvider("telnyx")
    case "signalwire":
      return createPlaceholderProvider("signalwire")
    case "noop":
    default:
      return noopProvider
  }
}

export function resolveDefaultGrowthSmsProviderKind(): GrowthSmsProviderKind {
  const configured = process.env.GROWTH_SMS_PROVIDER?.trim().toLowerCase()
  if (configured === "twilio" || configured === "telnyx" || configured === "signalwire" || configured === "noop") {
    return configured
  }
  if (process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()) {
    return "twilio"
  }
  return "noop"
}

export function isGrowthSmsLiveSendEnabled(): boolean {
  return process.env.GROWTH_SMS_SEND_ENABLED?.trim() === "true"
}

export function readGrowthSmsFromE164(): string | null {
  return process.env.GROWTH_SMS_FROM_E164?.trim() || "+18333784743"
}

export function buildGrowthSmsStatusCallbackUrl(requestOrigin?: string | null): string | null {
  const explicit = process.env.GROWTH_SMS_STATUS_CALLBACK_URL?.trim()
  if (explicit) return explicit
  const base = requestOrigin?.trim() || process.env.GROWTH_ENGINE_PUBLIC_BASE_URL?.trim()
  if (!base) return null
  return `${base.replace(/\/$/, "")}/api/growth/webhooks/sms/twilio/status`
}
