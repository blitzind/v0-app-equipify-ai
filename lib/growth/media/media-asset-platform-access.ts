import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthMediaAssetsSchemaReady } from "@/lib/growth/media/media-asset-schema-health"
import type { GrowthMediaAsset } from "@/lib/growth/media/media-asset-types"

export type MediaAssetPlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string | null
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireMediaAssetPlatformAccess(): Promise<MediaAssetPlatformAccess> {
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

  if (!(await isGrowthMediaAssetsSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "schema_not_ready", message: "Media assets schema is not ready." },
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

export function assertMediaAssetOrgScope(asset: GrowthMediaAsset, organizationId: string): NextResponse | null {
  if (asset.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "organization_scope_mismatch" }, { status: 403 })
  }
  return null
}
