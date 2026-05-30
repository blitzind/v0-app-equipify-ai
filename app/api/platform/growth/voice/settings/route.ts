import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { readTwilioEnvPresence } from "@/lib/voice/providers/twilio-env-readiness"
import {
  ensureDefaultVoiceProviderConfigurations,
  ensureTwilioVoiceProviderConfiguration,
  resolveVoiceInfrastructureOrganizationId,
} from "@/lib/voice/repository/voice-repository"
import { fetchVoiceOperationsReadiness } from "@/lib/voice/repository/voice-operations-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import { VOICE_FOUNDATION_QA_MARKER, VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

type VoiceSettingsAction = "initialize_twilio" | "initialize_scaffolding"

function twilioEnvPresenceResponse() {
  const env = readTwilioEnvPresence()
  return {
    twilioAccountSid: env.twilioAccountSid,
    twilioAuthToken: env.twilioAuthToken,
    growthEngineAiOrgId: env.growthEngineAiOrgId,
    twilioCredentialsConfigured: env.twilioCredentialsConfigured,
  }
}

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  const schemaProbe = await probeVoiceSchemaHealth(access.admin)
  const readiness = await fetchVoiceOperationsReadiness(access.admin, organizationId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_FOUNDATION_QA_MARKER,
    operationsQaMarker: VOICE_OPERATIONS_QA_MARKER,
    schema: schemaProbe,
    readiness,
    twilioEnvPresence: twilioEnvPresenceResponse(),
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Set GROWTH_ENGINE_AI_ORG_ID to initialize voice provider configurations.",
        twilioEnvPresence: twilioEnvPresenceResponse(),
      },
      { status: 400 },
    )
  }

  const schemaProbe = await probeVoiceSchemaHealth(access.admin)
  if (!schemaProbe.ready) {
    return NextResponse.json({ ok: false, message: schemaProbe.message }, { status: 503 })
  }

  let action: VoiceSettingsAction = "initialize_twilio"
  try {
    const body = (await request.json()) as { action?: VoiceSettingsAction }
    if (body.action === "initialize_scaffolding") {
      action = "initialize_scaffolding"
    }
  } catch {
    // Default POST initializes Twilio provider row from env presence.
  }

  if (action === "initialize_scaffolding") {
    await ensureDefaultVoiceProviderConfigurations(access.admin, organizationId)
  } else {
    const twilioInit = await ensureTwilioVoiceProviderConfiguration(access.admin, organizationId)
    if (!twilioInit.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Twilio environment variables missing: ${twilioInit.missingEnvVars.join(", ")}.`,
          missingEnvVars: twilioInit.missingEnvVars,
          twilioEnvPresence: twilioEnvPresenceResponse(),
        },
        { status: 400 },
      )
    }
  }

  const readiness = await fetchVoiceOperationsReadiness(access.admin, organizationId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_FOUNDATION_QA_MARKER,
    operationsQaMarker: VOICE_OPERATIONS_QA_MARKER,
    readiness,
    twilioEnvPresence: twilioEnvPresenceResponse(),
    message:
      action === "initialize_scaffolding"
        ? "Default voice provider configuration rows ensured."
        : "Twilio provider configuration initialized from environment.",
  })
}
