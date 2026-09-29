import "server-only"

import { randomBytes } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isValidEmail } from "@/lib/email/format"
import { buildPortalAccessLoginUrl } from "@/lib/portal/build-portal-access-url"
import { PORTAL_ACCESS_LINK_MAX_USES, PORTAL_ACCESS_LINK_TTL_MS } from "@/lib/portal/constants"
import { sha256Hex } from "@/lib/portal/token-hash"

export type PortalAccessLinkKind = "invite" | "magic_login"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type MintPortalAccessLinkArgs = {
  supabase: SupabaseClient
  organizationId: string
  customerId: string
  email: string
  displayName?: string | null
  kind: PortalAccessLinkKind
  next?: string | null
  ttlMs?: number
  maxUses?: number
}

export type MintPortalAccessLinkSuccess = {
  ok: true
  rawToken: string
  tokenHash: string
  expiresAt: string
  portalUserId: string
  accessUrl: string
  kind: PortalAccessLinkKind
}

export type MintPortalAccessLinkFailure = {
  ok: false
  code:
    | "invalid_email"
    | "invalid_ids"
    | "customer_not_found"
    | "revoked"
    | "create_user_failed"
    | "create_link_failed"
  message: string
}

export type MintPortalAccessLinkResult = MintPortalAccessLinkSuccess | MintPortalAccessLinkFailure

export function generateRawPortalAccessToken(): string {
  return Buffer.from(randomBytes(32)).toString("base64url")
}

/**
 * Mint a hashed portal access link for a customer email.
 *
 * Scanner policy: keep max_uses = 1. The login URL is a GET that does not redeem;
 * redemption is POST /api/portal/access/exchange from an intentional browser session.
 * Ordinary email security scanners fetch GET and do not execute that POST, so they
 * do not consume the credential. Do not raise max_uses as a substitute for that split.
 * Tokens remain time-limited (default 7 days) and are never stored in plaintext.
 */
export async function mintPortalAccessLink(
  args: MintPortalAccessLinkArgs,
): Promise<MintPortalAccessLinkResult> {
  const organizationId = args.organizationId.trim()
  const customerId = args.customerId.trim()
  const email = args.email.trim().toLowerCase()
  const displayName =
    typeof args.displayName === "string" && args.displayName.trim() ? args.displayName.trim() : null

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return { ok: false, code: "invalid_ids", message: "Invalid organization or customer." }
  }
  if (!isValidEmail(email)) {
    return { ok: false, code: "invalid_email", message: "A valid email is required." }
  }

  const { data: cust, error: cErr } = await args.supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .is("archived_at", null)
    .maybeSingle()

  if (cErr || !cust) {
    return { ok: false, code: "customer_not_found", message: "Customer not found for this organization." }
  }

  const { data: existing } = await args.supabase
    .from("portal_users")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .maybeSingle()

  const existingRow = existing as { id?: string; status?: string } | null
  if (existingRow?.status === "revoked") {
    return {
      ok: false,
      code: "revoked",
      message: "This portal email was revoked. Restore access before sending a new link.",
    }
  }

  const nowIso = new Date().toISOString()
  let portalUserId = existingRow?.id

  if (!portalUserId) {
    const { data: inserted, error: insErr } = await args.supabase
      .from("portal_users")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        email,
        display_name: displayName,
        status: "pending",
        invited_at: nowIso,
      })
      .select("id")
      .single()

    if (insErr || !inserted) {
      return { ok: false, code: "create_user_failed", message: "Could not create portal user." }
    }
    portalUserId = inserted.id as string
  } else {
    await args.supabase
      .from("portal_users")
      .update({
        customer_id: customerId,
        display_name: displayName ?? undefined,
        invited_at: nowIso,
      })
      .eq("organization_id", organizationId)
      .eq("id", portalUserId)
  }

  const rawToken = generateRawPortalAccessToken()
  const tokenHash = sha256Hex(rawToken)
  const ttlMs = args.ttlMs ?? PORTAL_ACCESS_LINK_TTL_MS
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()
  const maxUses = args.maxUses ?? PORTAL_ACCESS_LINK_MAX_USES

  const { error: linkErr } = await args.supabase.from("portal_access_links").insert({
    organization_id: organizationId,
    portal_user_id: portalUserId,
    token_hash: tokenHash,
    kind: args.kind,
    expires_at: expiresAt,
    max_uses: maxUses,
    use_count: 0,
  })

  if (linkErr) {
    return { ok: false, code: "create_link_failed", message: "Could not create access link." }
  }

  return {
    ok: true,
    rawToken,
    tokenHash,
    expiresAt,
    portalUserId,
    kind: args.kind,
    accessUrl: buildPortalAccessLoginUrl({ rawToken, next: args.next }),
  }
}
