import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloSequenceExecutionAutomationReadiness } from "@/lib/growth/apollo/apollo-sequence-execution-automation-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloSequenceExecutionAutomationReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
