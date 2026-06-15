import { NextResponse } from "next/server"
import { buildCampaignReadinessReadinessPayload } from "@/lib/growth/campaign-readiness/campaign-readiness-route-gates"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...buildCampaignReadinessReadinessPayload(),
  })
}
