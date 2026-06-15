import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { validateSharePageOrganizationScope } from "@/lib/growth/share-pages/share-pages-route-gates"
import { isGrowthSharePagesSchemaReady } from "@/lib/growth/share-pages/share-pages-schema-health"
import type { GrowthSharePage } from "@/lib/growth/share-pages/share-page-types"

export type SharePagePlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string | null
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireSharePagePlatformAccess(): Promise<SharePagePlatformAccess> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "organization_id_required", message: "GROWTH_ENGINE_AI_ORG_ID is required." },
        { status: 503 },
      ),
    }
  }

  if (!(await isGrowthSharePagesSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "schema_not_ready", message: "Share pages schema is not ready." },
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

export function assertSharePageOrgScope(page: GrowthSharePage, organizationId: string): NextResponse | null {
  const scope = validateSharePageOrganizationScope({
    organizationId: page.organizationId,
    expectedOrganizationId: organizationId,
  })
  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: scope.error ?? "organization_scope_mismatch" }, { status: 403 })
  }
  return null
}

export function sharePageOrigin(request: Request): string {
  return new URL(request.url).origin
}
