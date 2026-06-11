import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloFullPipelineProductionCertificationReadiness } from "@/lib/growth/apollo/apollo-full-pipeline-production-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloFullPipelineProductionCertificationReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
