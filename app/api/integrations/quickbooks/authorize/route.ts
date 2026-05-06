import { NextRequest, NextResponse } from "next/server"
import { signOAuthState } from "@/lib/integrations/oauth-state"
import { quickBooksOAuthConfigured } from "@/lib/integrations/quickbooks-env"
import { buildQuickBooksAuthorizeUrl } from "@/lib/integrations/quickbooks-oauth"
import { requireOrgIntegrationAdmin } from "@/lib/integrations/require-org-integration-admin"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim()
  if (!organizationId) {
    return NextResponse.json({ error: "missing_organization", message: "organizationId is required." }, { status: 400 })
  }

  if (!quickBooksOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "quickbooks_not_configured",
        message: "QuickBooks OAuth environment variables are not set on the server.",
      },
      { status: 503 },
    )
  }

  const gate = await requireOrgIntegrationAdmin(organizationId)
  if ("error" in gate) return gate.error

  const state = signOAuthState({
    organizationId,
    userId: gate.userId,
    ts: Date.now(),
  })
  if (!state) {
    return NextResponse.json(
      {
        error: "oauth_state_unconfigured",
        message: "Set INTEGRATION_OAUTH_STATE_SECRET (min 16 chars) for OAuth security.",
      },
      { status: 503 },
    )
  }

  const url = buildQuickBooksAuthorizeUrl({ state })
  return NextResponse.redirect(url)
}
