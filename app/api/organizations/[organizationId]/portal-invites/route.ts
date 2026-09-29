import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getPublicAppOrigin } from "@/lib/email/config"
import { isValidEmail } from "@/lib/email/format"
import { sendEmail } from "@/lib/email/resend"
import { buildPortalAccessEmailContent } from "@/lib/email/portal-access-email"
import { PORTAL_DASHBOARD_PATH } from "@/lib/portal/constants"
import { mintPortalAccessLink, type PortalAccessLinkKind } from "@/lib/portal/mint-portal-access-link"
import { sanitizePortalNext } from "@/lib/portal/safe-portal-next"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Staff-only: mint a portal access link (and optionally email it).
 * Gated by `canManagePortalSettings`. Uses the configured public origin — never the request Origin header.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid organization.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManagePortalSettings")
  if ("error" in gate) return gate.error

  let body: {
    customerId?: string
    email?: string
    displayName?: string | null
    kind?: PortalAccessLinkKind
    next?: string | null
    sendEmail?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null
  const kind: PortalAccessLinkKind = body.kind === "magic_login" ? "magic_login" : "invite"
  const next = sanitizePortalNext(body.next) ?? PORTAL_DASHBOARD_PATH
  const shouldEmail = body.sendEmail === true

  if (!UUID_RE.test(customerId)) {
    return jsonError("Invalid customer id.", 400)
  }
  if (!isValidEmail(email)) {
    return jsonError("A valid email is required.", 400)
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const minted = await mintPortalAccessLink({
    supabase: svc,
    organizationId,
    customerId,
    email,
    displayName,
    kind,
    next,
  })

  if (!minted.ok) {
    const status =
      minted.code === "customer_not_found" ? 404 : minted.code === "revoked" ? 409 : minted.code === "invalid_email" ? 400 : 500
    return jsonError(minted.message, status)
  }

  let emailed = false
  if (shouldEmail) {
    const [{ data: org }, { data: cust }] = await Promise.all([
      svc.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
      svc.from("customers").select("company_name").eq("organization_id", organizationId).eq("id", customerId).maybeSingle(),
    ])
    const organizationName =
      ((org as { name?: string } | null)?.name ?? "").trim() || "Your service provider"
    const customerName =
      displayName ||
      ((cust as { company_name?: string } | null)?.company_name ?? "").trim() ||
      email
    const content = buildPortalAccessEmailContent({
      organizationName,
      customerName,
      accessUrl: minted.accessUrl,
      expiresAtIso: minted.expiresAt,
    })
    const send = await sendEmail({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      category: "portal_access_invite",
      organizationId,
    })
    if (!send.ok) {
      return NextResponse.json(
        {
          error: send.error,
          inviteUrl: minted.accessUrl,
          expiresAt: minted.expiresAt,
          portalUserId: minted.portalUserId,
          emailed: false,
        },
        { status: send.code === "config" ? 503 : 502 },
      )
    }
    emailed = true
  }

  return NextResponse.json({
    inviteUrl: minted.accessUrl,
    accessUrl: minted.accessUrl,
    expiresAt: minted.expiresAt,
    portalUserId: minted.portalUserId,
    publicOrigin: getPublicAppOrigin(),
    emailed,
  })
}
