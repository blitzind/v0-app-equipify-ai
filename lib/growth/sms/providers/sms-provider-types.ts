/** Growth Engine SMS provider adapter contract (Phase 5.1B). Client-safe. */

import type { GrowthSmsProviderKind } from "@/lib/growth/sms/sms-types"

export type GrowthSmsProviderSendMessage = {
  fromE164: string
  toE164: string
  body: string
  idempotencyKey: string
  statusCallbackUrl?: string | null
  messagingServiceSid?: string | null
}

export type GrowthSmsProviderSendResult =
  | { ok: true; providerMessageId: string; status: "queued" | "sent" }
  | { ok: false; code: string; message: string }

export type GrowthSmsProviderHealthResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

export type GrowthSmsProviderCapabilities = {
  supportsStatusCallbacks: boolean
  supportsMessagingServiceSid: boolean
  supportsInboundWebhooks: boolean
}

export type GrowthSmsProviderAdapter = {
  kind: GrowthSmsProviderKind
  capabilities(): GrowthSmsProviderCapabilities
  health(): Promise<GrowthSmsProviderHealthResult>
  send(message: GrowthSmsProviderSendMessage): Promise<GrowthSmsProviderSendResult>
}

export type GrowthSmsWebhookValidationInput = {
  signatureHeader: string | null
  url: string
  params: Record<string, string>
}

export type GrowthSmsWebhookValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export type GrowthSmsWebhookCapableAdapter = GrowthSmsProviderAdapter & {
  validateWebhook(input: GrowthSmsWebhookValidationInput): GrowthSmsWebhookValidationResult
}

export function isGrowthSmsWebhookCapableAdapter(
  adapter: GrowthSmsProviderAdapter,
): adapter is GrowthSmsWebhookCapableAdapter {
  return typeof (adapter as GrowthSmsWebhookCapableAdapter).validateWebhook === "function"
}
