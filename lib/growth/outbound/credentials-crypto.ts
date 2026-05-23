import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const PEPPER =
  process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER ?? "growth_provider_credentials_pepper_dev_only"

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12

function deriveKey(): Buffer {
  return createHash("sha256").update(PEPPER).update("|growth-provider-credentials|").digest()
}

/** Encrypt provider credentials JSON for storage. Never log return value. */
export function encryptGrowthProviderCredentials(credentials: Record<string, unknown>): string {
  const key = deriveKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = JSON.stringify(credentials)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return ["v1", iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(":")
}

/** Decrypt stored credentials. Returns null if ciphertext is invalid. */
export function decryptGrowthProviderCredentials(
  ciphertext: string | null | undefined,
): Record<string, unknown> | null {
  if (!ciphertext?.trim()) return null
  try {
    const parts = ciphertext.split(":")
    if (parts.length !== 4 || parts[0] !== "v1") return null
    const [, ivB64, tagB64, dataB64] = parts
    const key = deriveKey()
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64url"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ])
    const parsed = JSON.parse(decrypted.toString("utf8"))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Strip secret fields from config before API responses. */
export function sanitizeGrowthProviderConfigForApi(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...config }
  delete sanitized.apiKey
  delete sanitized.apiSecret
  delete sanitized.password
  delete sanitized.accessToken
  delete sanitized.refreshToken
  delete sanitized._internal
  return sanitized
}
