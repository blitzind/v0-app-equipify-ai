import {
  decryptGrowthProviderCredentials,
  encryptGrowthProviderCredentials,
  sanitizeGrowthProviderConfigForApi,
} from "@/lib/growth/outbound/credentials-crypto"
import type { GrowthProviderCredentialInput, GrowthProviderSetupFamily } from "@/lib/growth/provider-setup/provider-setup-types"
import { GROWTH_PROVIDER_SETUP_INTERNAL_FIELD_NAMES } from "@/lib/growth/provider-setup/provider-setup-types"

export function encryptProviderSetupCredentials(
  credentials: GrowthProviderCredentialInput,
): string {
  return encryptGrowthProviderCredentials(credentials)
}

export function decryptProviderSetupCredentials(
  ciphertext: string | null | undefined,
): Record<string, unknown> | null {
  return decryptGrowthProviderCredentials(ciphertext)
}

export function sanitizeProviderSetupForApi<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row }
  for (const key of GROWTH_PROVIDER_SETUP_INTERNAL_FIELD_NAMES) {
    delete copy[key]
  }
  if (copy.metadata && typeof copy.metadata === "object") {
    copy.metadata = sanitizeGrowthProviderConfigForApi(copy.metadata as Record<string, unknown>)
  }
  return copy
}

export function credentialsPresent(ciphertext: string | null | undefined): boolean {
  return Boolean(ciphertext?.trim())
}

export function maskCredentialField(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—"
  const trimmed = value.trim()
  if (trimmed.length <= 4) return "••••"
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`
}

export function buildCredentialSummary(
  family: GrowthProviderSetupFamily,
  ciphertext: string | null | undefined,
): Record<string, unknown> {
  const decrypted = decryptProviderSetupCredentials(ciphertext)
  if (!decrypted) return { configured: false }

  switch (family) {
    case "smtp":
      return {
        configured: true,
        host: decrypted.host ?? null,
        port: decrypted.port ?? null,
        username: maskCredentialField(decrypted.username),
        from_email: decrypted.from_email ?? null,
      }
    case "ses":
      return {
        configured: true,
        region: decrypted.region ?? null,
        access_key_id: maskCredentialField(decrypted.access_key_id),
      }
    case "resend":
      return {
        configured: true,
        from_email: decrypted.from_email ?? null,
        api_key: maskCredentialField(decrypted.api_key),
      }
    case "custom":
      return { configured: true, keys: Object.keys(decrypted).filter((k) => !/secret|token|password/i.test(k)) }
    default:
      return { configured: true }
  }
}
