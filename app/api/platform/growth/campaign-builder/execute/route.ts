import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertCampaignBuilderExecuteAllowed,
  CAMPAIGN_BUILDER_CONFIRM,
} from "@/lib/growth/campaign-builder/campaign-builder-route-gates"
import { executeCampaignBuilderCertification } from "@/lib/growth/campaign-builder/campaign-builder-certification"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("campaignBuilder", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertCampaignBuilderExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== CAMPAIGN_BUILDER_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const report = await executeCampaignBuilderCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
  })

  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
