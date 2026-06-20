import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AUDIENCE_SCHEMA_SETUP_MESSAGE,
  isGrowthAudienceSchemaReady,
} from "@/lib/growth/audiences/growth-audience-schema-health"
import type { GrowthAudience } from "@/lib/growth/audiences/growth-audience-types"

export type AudiencePlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireAudiencePlatformAccess(): Promise<AudiencePlatformAccess> {
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

  if (!(await isGrowthAudienceSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "schema_not_ready",
          message: GROWTH_AUDIENCE_SCHEMA_SETUP_MESSAGE,
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

export function assertAudienceOrgScope(
  audience: GrowthAudience,
  organizationId: string,
): NextResponse | null {
  if (audience.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "organization_scope_mismatch" }, { status: 403 })
  }
  return null
}
