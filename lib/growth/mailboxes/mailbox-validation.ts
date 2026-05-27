/** Stub mailbox validation — no live OAuth or DNS in Phase 1B. Client-safe. */

import type { GrowthMailboxConnectionStatus } from "@/lib/growth/mailboxes/mailbox-types"
import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"
import { getMailboxProviderCapabilities } from "@/lib/growth/mailboxes/mailbox-provider-registry"

export type MailboxValidationInput = {
  provider_family: GrowthSenderProviderFamily
  email_address: string
  status: GrowthMailboxConnectionStatus
  token_configured: boolean
  token_expires_at?: string | null
  validation_failure_count?: number
}

export type MailboxValidationResult = {
  valid: boolean
  status: GrowthMailboxConnectionStatus
  message: string
  checked_at: string
}

export function validateMailboxConnectionStub(input: MailboxValidationInput): MailboxValidationResult {
  const capabilities = getMailboxProviderCapabilities(input.provider_family)
  const checked_at = new Date().toISOString()

  if (input.status === "disabled") {
    return { valid: false, status: "disabled", message: "Mailbox connection is disabled.", checked_at }
  }

  if (capabilities.oauth && !input.token_configured) {
    return {
      valid: false,
      status: "pending",
      message: "OAuth mailbox connection pending — live OAuth not enabled in Phase 1B.",
      checked_at,
    }
  }

  if (input.token_expires_at && Date.parse(input.token_expires_at) <= Date.now()) {
    return {
      valid: false,
      status: "expired",
      message: "Mailbox token expired.",
      checked_at,
    }
  }

  if ((input.validation_failure_count ?? 0) > 3) {
    return {
      valid: false,
      status: "error",
      message: "Validation failure threshold exceeded.",
      checked_at,
    }
  }

  if (input.status === "error") {
    return {
      valid: false,
      status: "error",
      message: "Mailbox connection in error state.",
      checked_at,
    }
  }

  return {
    valid: true,
    status: input.token_configured || capabilities.smtp ? "connected" : "pending",
    message: capabilities.oauth
      ? "Mailbox validation stub passed — OAuth execution deferred."
      : "Mailbox validation stub passed — SMTP credentials not executed.",
    checked_at,
  }
}
