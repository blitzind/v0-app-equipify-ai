import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloMappingPipelineAuditProductionReadiness } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloMappingPipelineAuditProductionReadiness({ env: process.env })
  return NextResponse.json(payload)
}
