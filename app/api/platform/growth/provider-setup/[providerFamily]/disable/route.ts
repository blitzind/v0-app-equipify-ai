import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { disableProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"
import {
  isGrowthProviderSetupFamily,
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
} from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ providerFamily: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { providerFamily } = await context.params
  if (!isGrowthProviderSetupFamily(providerFamily)) {
    return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400 })
  }

  const settings = await disableProviderConnectionSettings(access.admin, {
    providerFamily,
    actorUserId: access.userId,
  })

  return NextResponse.json({ ok: true, qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, settings })
}
