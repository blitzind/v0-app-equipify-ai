import "server-only"

import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthMediaGenerationRunsSchemaReady } from "@/lib/growth/media/growth-media-generation-schema-health"
import { isGrowthVideoWorkspaceEnabled } from "@/lib/growth/videos/growth-video-route-gates"

export type GrowthMediaGenerationPlatformAccess =
  | {
      ok: true
      admin: import("@supabase/supabase-js").SupabaseClient
      userId: string
      userEmail: string | null
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireGrowthMediaGenerationPlatformAccess(): Promise<GrowthMediaGenerationPlatformAccess> {
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

  if (!(await isGrowthMediaGenerationRunsSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "media_generation_schema_not_ready",
          message: "Media generation runs schema is not ready. Apply C3 migration.",
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

export function growthMediaGenerationSafetyJson(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    provider_execution_enabled: false,
    no_media_generation_executed: true,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

export function mapGrowthMediaGenerationApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  const statusMap: Record<string, number> = {
    not_found: 404,
    invalid_generation_type: 400,
    script_required: 400,
    script_version_not_found: 404,
    invalid_voice_id: 400,
    invalid_avatar_id: 400,
    elevenlabs_tts_failed: 502,
    elevenlabs_avatar_failed: 502,
    retell_avatar_failed: 502,
    retell_api_key_missing: 503,
    video_upload_failed: 500,
    elevenlabs_api_key_missing: 503,
    provider_job_cancelled: 409,
    invalid_status_transition: 400,
    run_insert_failed: 500,
    run_load_failed: 500,
    update_failed: 500,
    media_generation_schema_not_ready: 503,
  }
  const baseMessage = message.includes(":") ? (message.split(":")[0] ?? message) : message
  const status = statusMap[baseMessage] ?? statusMap[message] ?? 500
  return NextResponse.json(
    growthMediaGenerationSafetyJson({
      ok: false,
      error: message,
      message: message.replace(/_/g, " "),
    }),
    { status },
  )
}
