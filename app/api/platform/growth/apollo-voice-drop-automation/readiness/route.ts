import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloVoiceDropAutomationReadiness } from "@/lib/growth/apollo/apollo-voice-drop-automation-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloVoiceDropAutomationReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
