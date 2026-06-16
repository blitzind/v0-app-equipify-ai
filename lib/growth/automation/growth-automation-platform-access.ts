import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthAutomationBuilderSchemaReady } from "@/lib/growth/automation/growth-automation-schema-health"
import type { GrowthAutomationFlow } from "@/lib/growth/automation/growth-automation-types"

export type AutomationPlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireAutomationPlatformAccess(): Promise<AutomationPlatformAccess> {
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

  if (!(await isGrowthAutomationBuilderSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "schema_not_ready",
          message: "Automation builder schema is not ready.",
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

export function assertAutomationFlowOrgScope(
  flow: GrowthAutomationFlow,
  organizationId: string,
): NextResponse | null {
  if (flow.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "organization_scope_mismatch" }, { status: 403 })
  }
  return null
}
