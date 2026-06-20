import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { probeSendrSchemaReady } from "@/lib/growth/sendr/growth-sendr-schema-health"

export const GROWTH_SENDR_SCHEMA_SETUP_MESSAGE =
  "Personalized media runtime schema is not ready. Apply migration 20270901170000 (GS-SENDR-2A)."

export type SendrPlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireSendrPlatformAccess(): Promise<SendrPlatformAccess> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "organization_id_required",
          message: "GROWTH_ENGINE_AI_ORG_ID is required.",
        },
        { status: 503 },
      ),
    }
  }

  if (!(await probeSendrSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "schema_not_ready",
          message: GROWTH_SENDR_SCHEMA_SETUP_MESSAGE,
        },
        { status: 503 },
      ),
    }
  }

  return {
    ok: true,
    admin: access.admin,
    userId: access.userId,
    userEmail: access.userEmail,
    organizationId,
  }
}
