import "server-only"

import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isSequenceVideoAttachmentsSchemaReady } from "@/lib/growth/sequences/growth-sequence-video-attachment-schema-health"
import { isGrowthVideoWorkspaceEnabled } from "@/lib/growth/videos/growth-video-route-gates"

export type GrowthSequenceVideoAttachmentPlatformAccess =
  | {
      ok: true
      admin: import("@supabase/supabase-js").SupabaseClient
      userId: string
      userEmail: string | null
      organizationId: string
    }
  | { ok: false; response: NextResponse }

export async function requireGrowthSequenceVideoAttachmentPlatformAccess(): Promise<GrowthSequenceVideoAttachmentPlatformAccess> {
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

  if (!(await isSequenceVideoAttachmentsSchemaReady(access.admin))) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "sequence_video_attachment_schema_not_ready",
          message: "Sequence video attachment schema is not ready. Apply D1 migration.",
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

export function growthSequenceVideoAttachmentSafetyJson(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    sequence_execution_modified: false,
    auto_publish_enabled: false,
  }
}

export function mapGrowthSequenceVideoAttachmentApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  const statusMap: Record<string, number> = {
    not_found: 404,
    invalid_attachment_type: 400,
    invalid_channel_compatibility: 400,
    video_page_not_found: 404,
    video_asset_not_found: 404,
    voice_asset_not_found: 404,
    avatar_asset_not_found: 404,
    attachment_not_approved: 409,
    attachment_already_removed: 409,
    sequence_video_attachment_schema_not_ready: 503,
  }
  const baseMessage = message.includes(":") ? (message.split(":")[0] ?? message) : message
  const status = statusMap[baseMessage] ?? statusMap[message] ?? 500
  return NextResponse.json(
    growthSequenceVideoAttachmentSafetyJson({
      ok: false,
      error: message,
      message: message.replace(/_/g, " "),
    }),
    { status },
  )
}
