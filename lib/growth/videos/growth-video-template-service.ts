import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_FOUNDATION_QA_MARKER,
  type GrowthVideoTemplate,
} from "@/lib/growth/videos/growth-video-types"
import { GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME } from "@/lib/growth/videos/growth-video-settings-types"
import { isGrowthVideoTemplatesSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"

const TEMPLATE_SELECT =
  "id, organization_id, name, description, thumbnail_path, configuration_json, created_at, updated_at"

type VideoTemplateRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  thumbnail_path: string | null
  configuration_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function mapTemplateRow(row: VideoTemplateRow): GrowthVideoTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    thumbnailPath: row.thumbnail_path,
    configuration: row.configuration_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class GrowthVideoTemplateService {
  constructor(private readonly admin: SupabaseClient) {}

  async listTemplates(input: {
    organizationId: string
    limit?: number
  }): Promise<{ ok: true; items: GrowthVideoTemplate[] } | { ok: false; error: string }> {
    if (!(await isGrowthVideoTemplatesSchemaReady(this.admin))) {
      return { ok: false, error: "schema_not_ready" }
    }

    const { data, error } = await this.admin
      .schema("growth")
      .from("video_templates")
      .select(TEMPLATE_SELECT)
      .eq("organization_id", input.organizationId)
      .neq("name", GROWTH_VIDEO_WORKSPACE_SETTINGS_TEMPLATE_NAME)
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 50)

    if (error) return { ok: false, error: error.message }
    return { ok: true, items: (data as VideoTemplateRow[]).map(mapTemplateRow) }
  }

  buildDiagnosticsPayload() {
    return {
      qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
      service: "growth_video_template_service",
      persistence: "growth.video_templates",
    }
  }
}

export function createGrowthVideoTemplateService(admin: SupabaseClient): GrowthVideoTemplateService {
  return new GrowthVideoTemplateService(admin)
}
