import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  ensureDefaultVoiceProviderConfigurations,
  fetchVoiceInfrastructureReadiness,
  resolveVoiceInfrastructureOrganizationId,
} from "@/lib/voice/repository/voice-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import { VOICE_FOUNDATION_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  const schemaProbe = await probeVoiceSchemaHealth(access.admin)
  const readiness = await fetchVoiceInfrastructureReadiness(access.admin, organizationId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_FOUNDATION_QA_MARKER,
    schema: schemaProbe,
    readiness,
  })
}

export async function POST() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Set GROWTH_ENGINE_AI_ORG_ID to initialize voice provider configurations.",
      },
      { status: 400 },
    )
  }

  const schemaProbe = await probeVoiceSchemaHealth(access.admin)
  if (!schemaProbe.ready) {
    return NextResponse.json({ ok: false, message: schemaProbe.message }, { status: 503 })
  }

  await ensureDefaultVoiceProviderConfigurations(access.admin, organizationId)
  const readiness = await fetchVoiceInfrastructureReadiness(access.admin, organizationId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_FOUNDATION_QA_MARKER,
    readiness,
    message: "Default voice provider configuration rows ensured.",
  })
}
