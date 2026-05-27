import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthProviderSetupFamily,
  GrowthProviderSetupOAuthFamily,
} from "@/lib/growth/provider-setup/provider-setup-types"
import { GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES } from "@/lib/growth/provider-setup/provider-setup-types"

export type GrowthProviderOAuthStatePayload = {
  userId: string
  providerFamily: GrowthProviderSetupOAuthFamily
  returnTo: string
  senderAccountId?: string | null
  ts: number
  nonce: string
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000

function getSecret(): string | null {
  const secret = process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim()
  return secret && secret.length >= 16 ? secret : null
}

export function normalizeProviderSetupReturnTo(returnTo: string | null | undefined): string {
  const value = returnTo?.trim() || "/admin/growth/providers/setup"
  if (!GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return "/admin/growth/providers/setup"
  }
  return value
}

export function signProviderSetupOAuthState(payload: GrowthProviderOAuthStatePayload): string | null {
  const secret = getSecret()
  if (!secret) return null
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifyProviderSetupOAuthState(
  token: string,
  expectedFamily: GrowthProviderSetupOAuthFamily,
  maxAgeMs = STATE_MAX_AGE_MS,
): GrowthProviderOAuthStatePayload | null {
  const secret = getSecret()
  if (!secret) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null
  const expectedSig = createHmac("sha256", secret).update(body).digest("base64url")
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  let parsed: GrowthProviderOAuthStatePayload
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GrowthProviderOAuthStatePayload
  } catch {
    return null
  }

  if (!parsed.userId || typeof parsed.ts !== "number" || parsed.providerFamily !== expectedFamily) {
    return null
  }
  if (Date.now() - parsed.ts > maxAgeMs) return null
  parsed.returnTo = normalizeProviderSetupReturnTo(parsed.returnTo)
  return parsed
}

export async function createProviderSetupOAuthStateRecord(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupOAuthFamily
    userId: string
    returnTo: string
    senderAccountId?: string | null
    stateToken: string
  },
): Promise<void> {
  const expiresAt = new Date(Date.now() + STATE_MAX_AGE_MS).toISOString()
  const { error } = await admin.schema("growth").from("provider_oauth_states").insert({
    provider_family: input.providerFamily,
    state_token: input.stateToken,
    user_id: input.userId,
    return_to: normalizeProviderSetupReturnTo(input.returnTo),
    sender_account_id: input.senderAccountId ?? null,
    expires_at: expiresAt,
    metadata: { qa_marker: "growth-live-provider-setup-v1" },
  })
  if (error) throw new Error(error.message)
}

export async function consumeProviderSetupOAuthStateRecord(
  admin: SupabaseClient,
  input: { stateToken: string; providerFamily: GrowthProviderSetupFamily; userId: string },
): Promise<{ return_to: string; sender_account_id: string | null } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("provider_oauth_states")
    .select("id, return_to, sender_account_id, consumed_at, expires_at, user_id, provider_family")
    .eq("state_token", input.stateToken)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  if (data.consumed_at) return null
  if (data.user_id !== input.userId) return null
  if (data.provider_family !== input.providerFamily) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null

  const consumedAt = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from("provider_oauth_states")
    .update({ consumed_at: consumedAt })
    .eq("id", data.id)
    .is("consumed_at", null)

  if (updateError) throw new Error(updateError.message)
  return {
    return_to: normalizeProviderSetupReturnTo(data.return_to),
    sender_account_id: data.sender_account_id ?? null,
  }
}

export function createProviderSetupOAuthNonce(): string {
  return randomBytes(16).toString("hex")
}
