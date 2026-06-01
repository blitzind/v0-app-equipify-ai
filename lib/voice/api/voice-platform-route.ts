import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import { resolveVoiceInfrastructureOrganizationId } from "@/lib/voice/repository/voice-repository"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export type VoicePlatformRouteContext =
  | {
      ok: true
      admin: SupabaseClient
      organizationId: string
      userId: string
    }
  | { ok: false; response: NextResponse }

export async function requireVoicePlatformRouteContext(): Promise<VoicePlatformRouteContext> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "org_not_configured",
          message: "Set GROWTH_ENGINE_AI_ORG_ID to scope voice operations.",
          qaMarker: VOICE_OPERATIONS_QA_MARKER,
        },
        { status: 400 },
      ),
    }
  }

  const schemaProbe = await probeVoiceSchemaHealth(access.admin)
  if (schemaProbe.missingTables.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "voice_schema_incomplete",
          message: schemaProbe.message,
          qaMarker: VOICE_OPERATIONS_QA_MARKER,
          probeUncertain: schemaProbe.probeUncertain,
        },
        { status: 503 },
      ),
    }
  }

  return {
    ok: true,
    admin: access.admin,
    organizationId,
    userId: access.userId,
  }
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function voiceInvalidIdResponse(label = "Resource"): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "invalid_id", message: `${label} id is invalid.` },
      { status: 400 },
    ),
  }
}
