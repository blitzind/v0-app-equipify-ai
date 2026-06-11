import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildOpportunityDraftEngineReadiness } from "@/lib/growth/meeting-intelligence/opportunity-draft-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildOpportunityDraftEngineReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
