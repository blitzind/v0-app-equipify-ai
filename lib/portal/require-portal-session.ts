import "server-only"

import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { PORTAL_SESSION_COOKIE } from "@/lib/portal/constants"
import { getPortalSessionSecret } from "@/lib/portal/env"
import type { PortalTokenPayload } from "@/lib/portal/session-token"
import { verifyPortalToken } from "@/lib/portal/session-token"

export type PortalSessionContext = {
  svc: ReturnType<typeof createServiceRoleSupabaseClient>
  payload: PortalTokenPayload
  portalUser: {
    id: string
    organization_id: string
    customer_id: string
    email: string
    display_name: string | null
    status: string
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function requirePortalSession(): Promise<PortalSessionContext | NextResponse> {
  const secret = getPortalSessionSecret()
  if (!secret) {
    return jsonError("Portal sign-in is not configured.", 503)
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get(PORTAL_SESSION_COOKIE)?.value
  if (!raw) {
    return jsonError("Sign in required.", 401)
  }

  const payload = await verifyPortalToken(raw, secret)
  if (!payload) {
    return jsonError("Session expired. Sign in again.", 401)
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data: pu, error } = await svc
    .from("portal_users")
    .select("id, organization_id, customer_id, email, display_name, status")
    .eq("id", payload.pu)
    .maybeSingle()

  if (error || !pu) {
    return jsonError("Portal session is no longer valid.", 401)
  }

  if (pu.organization_id !== payload.org || pu.customer_id !== payload.cust) {
    return jsonError("Portal session is invalid.", 401)
  }

  if (pu.status !== "active") {
    return jsonError("This portal account is not active.", 403)
  }

  const { data: org } = await svc.from("organizations").select("status").eq("id", payload.org).maybeSingle()
  if ((org as { status?: string } | null)?.status === "archived") {
    return jsonError("This workspace is no longer available.", 403)
  }

  return {
    svc,
    payload,
    portalUser: pu as PortalSessionContext["portalUser"],
  }
}

export async function getRequestMeta() {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip")
  return {
    ip: ip || null,
    userAgent: h.get("user-agent"),
  }
}
