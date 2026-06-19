import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthVideoWorkspaceEnabled } from "@/lib/growth/videos/growth-video-route-gates"
import {
  isGrowthVideoAssetsSchemaReady,
  isGrowthVideoAssetsUploadSchemaReady,
  isGrowthVideoAnalyticsSchemaReady,
  isGrowthVideoPagesSchemaReady,
} from "@/lib/growth/videos/growth-video-schema-health"

export type GrowthVideoPlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string | null
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireGrowthVideoPlatformAccess(): Promise<GrowthVideoPlatformAccess> {
  if (!isGrowthVideoWorkspaceEnabled()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "video_workspace_disabled", message: "Video workspace is not enabled." },
        { status: 403 },
      ),
    }
  }

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

  if (!(await isGrowthVideoAssetsSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "schema_not_ready", message: "Video assets schema is not ready." },
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

export async function requireGrowthVideoUploadSchemaReady(
  access: GrowthVideoPlatformAccess & { ok: true },
): Promise<NextResponse | null> {
  if (!(await isGrowthVideoAssetsUploadSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        error: "upload_schema_not_ready",
        message: "Video upload columns are not ready. Apply A2 migration.",
      },
      { status: 503 },
    )
  }
  return null
}

export async function requireGrowthVideoPagesSchemaReady(
  access: GrowthVideoPlatformAccess & { ok: true },
): Promise<NextResponse | null> {
  if (!(await isGrowthVideoPagesSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        error: "pages_schema_not_ready",
        message: "Video pages schema is not ready. Apply A3 migration.",
      },
      { status: 503 },
    )
  }
  return null
}

export async function requireGrowthVideoAnalyticsSchemaReady(
  access: GrowthVideoPlatformAccess & { ok: true },
): Promise<NextResponse | null> {
  if (!(await isGrowthVideoAnalyticsSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        error: "analytics_schema_not_ready",
        message: "Video analytics schema is not ready. Apply A4 migration.",
      },
      { status: 503 },
    )
  }
  return null
}
