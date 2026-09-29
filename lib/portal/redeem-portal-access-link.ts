import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sha256Hex } from "@/lib/portal/token-hash"

export type RedeemPortalAccessFailure = {
  ok: false
  status: number
  message: string
}

export type RedeemPortalAccessSuccess = {
  ok: true
  portalUser: {
    id: string
    organization_id: string
    customer_id: string
    email: string
    display_name: string | null
    status: string
  }
  linkKind: string
}

export type RedeemPortalAccessResult = RedeemPortalAccessSuccess | RedeemPortalAccessFailure

/**
 * Atomically consume a hashed access link and activate the portal user.
 *
 * Compare-and-swap on `use_count` so two concurrent POSTs cannot both succeed
 * when max_uses allows only one remaining redemption.
 *
 * GET of the email URL never reaches this function.
 */
export async function redeemPortalAccessToken(
  svc: SupabaseClient,
  rawToken: string,
): Promise<RedeemPortalAccessResult> {
  const token = rawToken.trim()
  if (!token) {
    return { ok: false, status: 400, message: "Token is required." }
  }

  const tokenHash = sha256Hex(token)

  const { data: link, error: linkErr } = await svc
    .from("portal_access_links")
    .select("id, organization_id, portal_user_id, expires_at, max_uses, use_count, revoked_at, kind")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (linkErr || !link) {
    return { ok: false, status: 401, message: "This sign-in link is invalid or has expired." }
  }

  const row = link as {
    id: string
    organization_id: string
    portal_user_id: string
    expires_at: string
    max_uses: number
    use_count: number
    revoked_at: string | null
    kind: string
  }

  if (row.revoked_at) {
    return { ok: false, status: 401, message: "This sign-in link is no longer valid." }
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      status: 401,
      message: "This sign-in link has expired. Ask your service provider to send a new one.",
    }
  }

  if (row.use_count >= row.max_uses) {
    return {
      ok: false,
      status: 401,
      message: "This sign-in link was already used. Ask your service provider to send a new one.",
    }
  }

  const { data: pu, error: puErr } = await svc
    .from("portal_users")
    .select("id, organization_id, customer_id, email, display_name, status")
    .eq("id", row.portal_user_id)
    .maybeSingle()

  if (puErr || !pu) {
    return { ok: false, status: 401, message: "This sign-in link is invalid or has expired." }
  }

  const portalUser = pu as RedeemPortalAccessSuccess["portalUser"]

  if (portalUser.organization_id !== row.organization_id) {
    return { ok: false, status: 401, message: "This sign-in link is invalid or has expired." }
  }

  if (portalUser.status === "revoked") {
    return {
      ok: false,
      status: 403,
      message: "Portal access for this account has been disabled. Contact your service provider.",
    }
  }

  const { data: org } = await svc.from("organizations").select("status").eq("id", portalUser.organization_id).maybeSingle()
  if ((org as { status?: string } | null)?.status === "archived") {
    return { ok: false, status: 403, message: "This workspace is no longer available." }
  }

  const nowIso = new Date().toISOString()
  const nextUse = row.use_count + 1

  const { data: consumed, error: updErr } = await svc
    .from("portal_access_links")
    .update({
      use_count: nextUse,
      last_used_at: nowIso,
    })
    .eq("id", row.id)
    .eq("organization_id", row.organization_id)
    .is("revoked_at", null)
    .eq("use_count", row.use_count)
    .select("id")
    .maybeSingle()

  if (updErr) {
    return { ok: false, status: 500, message: "Could not complete sign-in. Please try again." }
  }

  if (!consumed) {
    return {
      ok: false,
      status: 401,
      message: "This sign-in link was already used. Ask your service provider to send a new one.",
    }
  }

  const statusUpdate =
    portalUser.status === "pending"
      ? {
          status: "active",
          activated_at: nowIso,
          last_login_at: nowIso,
          invited_at: nowIso,
        }
      : { last_login_at: nowIso }

  const { error: userUpdErr } = await svc
    .from("portal_users")
    .update(statusUpdate)
    .eq("id", portalUser.id)
    .eq("organization_id", portalUser.organization_id)

  if (userUpdErr) {
    return { ok: false, status: 500, message: "Could not complete sign-in. Please try again." }
  }

  return {
    ok: true,
    portalUser: { ...portalUser, status: portalUser.status === "pending" ? "active" : portalUser.status },
    linkKind: row.kind,
  }
}
