import {
  decryptGrowthProviderCredentials,
  encryptGrowthProviderCredentials,
} from "@/lib/growth/outbound/credentials-crypto"
import { getMailboxProviderCapabilities } from "@/lib/growth/mailboxes/mailbox-provider-registry"
import type { GrowthMailboxTokenRefreshResult } from "@/lib/growth/mailboxes/mailbox-types"
import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

const TOKEN_WRAPPER_KEY = "token"

/** Encrypt a token string for DB storage. Never log return value. */
export function encryptMailboxToken(plaintext: string | null | undefined): string | null {
  if (!plaintext?.trim()) return null
  return encryptGrowthProviderCredentials({ [TOKEN_WRAPPER_KEY]: plaintext.trim() })
}

/** Decrypt stored token ciphertext server-side only. Never expose to clients. */
export function decryptMailboxToken(ciphertext: string | null | undefined): string | null {
  const parsed = decryptGrowthProviderCredentials(ciphertext)
  const token = parsed?.[TOKEN_WRAPPER_KEY]
  return typeof token === "string" && token.trim() ? token.trim() : null
}

export type RefreshProviderTokenInput = {
  provider_family: GrowthSenderProviderFamily
  encrypted_refresh_token?: string | null
}

/** Stub refresh flow — no live OAuth/token exchange in Phase 1B. */
export function refreshProviderToken(input: RefreshProviderTokenInput): GrowthMailboxTokenRefreshResult {
  const capabilities = getMailboxProviderCapabilities(input.provider_family)
  if (!capabilities.refreshable) return "unsupported"
  if (!input.encrypted_refresh_token) return "failed"
  return "supported"
}

/** Strip secret fields from mailbox API responses. */
export function sanitizeMailboxConnectionRow<T extends Record<string, unknown>>(row: T): Omit<T, "encrypted_access_token" | "encrypted_refresh_token"> {
  const sanitized = { ...row }
  delete sanitized.encrypted_access_token
  delete sanitized.encrypted_refresh_token
  delete sanitized.access_token
  delete sanitized.refresh_token
  return sanitized
}

export function sanitizeMailboxMetadataForApi(metadata: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...metadata }
  for (const key of Object.keys(copy)) {
    if (/token|secret|password|credential/i.test(key)) delete copy[key]
  }
  return copy
}
