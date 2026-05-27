import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  configureProviderWebhookEndpoint,
  fetchProviderWebhookSetup,
} from "@/lib/growth/provider-setup/webhook-setup"
import {
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
  isGrowthProviderSetupFamily,
} from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const origin = new URL(request.url).origin
  const webhooks = await fetchProviderWebhookSetup(access.admin, origin)
  return NextResponse.json({ ok: true, qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, webhooks })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as {
    provider_family?: string
    signing_secret?: string
  }
  const providerFamily = body.provider_family?.trim() ?? ""
  if (!isGrowthProviderSetupFamily(providerFamily)) {
    return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const webhook = await configureProviderWebhookEndpoint(access.admin, {
    providerFamily,
    origin,
    signingSecret: body.signing_secret ?? null,
    actorUserId: access.userId,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    webhook,
    note: "Signing secret is stored hashed only. Copy a new secret from server logs/admin tooling if rotation is required.",
  })
}
