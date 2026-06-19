import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceVideoAttachmentRecord,
  GrowthSequenceVideoAttachmentStatus,
  GrowthSequenceVideoAttachmentType,
  GrowthSequenceVideoAttachmentView,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import {
  buildSequenceVideoAttachmentAiPayload,
  normalizeSequenceVideoMetadataHooks,
  validateSequenceVideoChannelCompatibility,
} from "@/lib/growth/sequences/growth-sequence-video-render-service"
import {
  buildSequenceVideoAttachmentAnalyticsHooks,
  enrichSequenceVideoAttachmentView,
  listSequenceVideoAssetCatalog,
} from "@/lib/growth/sequences/growth-sequence-video-preview-service"

type AttachmentRow = {
  id: string
  organization_id: string
  automation_flow_id: string | null
  automation_node_id: string | null
  sequence_pattern_step_id: string | null
  attachment_type: string
  attachment_status: string
  video_asset_id: string | null
  video_page_id: string | null
  voice_media_asset_id: string | null
  avatar_media_asset_id: string | null
  thumbnail_url: string | null
  metadata_json: Record<string, unknown> | null
  ai_payload: Record<string, unknown> | null
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function mapSequenceVideoAttachmentRow(row: Record<string, unknown>): GrowthSequenceVideoAttachmentRecord {
  const metadata = (row.metadata_json ?? {}) as Record<string, unknown>
  const hooks =
    metadata.metadata_hooks && typeof metadata.metadata_hooks === "object"
      ? (metadata.metadata_hooks as GrowthSequenceVideoAttachmentRecord["metadataHooks"])
      : {}
  const analytics =
    metadata.analytics_hooks && typeof metadata.analytics_hooks === "object"
      ? (metadata.analytics_hooks as GrowthSequenceVideoAttachmentRecord["analyticsHooks"])
      : {}

  const record: GrowthSequenceVideoAttachmentRecord = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    automationFlowId: typeof row.automation_flow_id === "string" ? row.automation_flow_id : null,
    automationNodeId: typeof row.automation_node_id === "string" ? row.automation_node_id : null,
    sequencePatternStepId:
      typeof row.sequence_pattern_step_id === "string" ? row.sequence_pattern_step_id : null,
    attachmentType: String(row.attachment_type) as GrowthSequenceVideoAttachmentType,
    attachmentStatus: String(row.attachment_status) as GrowthSequenceVideoAttachmentStatus,
    videoAssetId: typeof row.video_asset_id === "string" ? row.video_asset_id : null,
    videoPageId: typeof row.video_page_id === "string" ? row.video_page_id : null,
    voiceMediaAssetId: typeof row.voice_media_asset_id === "string" ? row.voice_media_asset_id : null,
    avatarMediaAssetId: typeof row.avatar_media_asset_id === "string" ? row.avatar_media_asset_id : null,
    thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    metadataHooks: normalizeSequenceVideoMetadataHooks(hooks, {
      videoAssetId: typeof row.video_asset_id === "string" ? row.video_asset_id : null,
      videoPageId: typeof row.video_page_id === "string" ? row.video_page_id : null,
      thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
      voiceMediaAssetId: typeof row.voice_media_asset_id === "string" ? row.voice_media_asset_id : null,
      avatarMediaAssetId: typeof row.avatar_media_asset_id === "string" ? row.avatar_media_asset_id : null,
    }),
    analyticsHooks: analytics,
    aiPayload:
      row.ai_payload && typeof row.ai_payload === "object"
        ? (row.ai_payload as GrowthSequenceVideoAttachmentRecord["aiPayload"])
        : buildSequenceVideoAttachmentAiPayload({
            attachment: {
              attachmentType: String(row.attachment_type) as GrowthSequenceVideoAttachmentType,
              videoAssetId: typeof row.video_asset_id === "string" ? row.video_asset_id : null,
              videoPageId: typeof row.video_page_id === "string" ? row.video_page_id : null,
              thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
              voiceMediaAssetId: typeof row.voice_media_asset_id === "string" ? row.voice_media_asset_id : null,
              avatarMediaAssetId: typeof row.avatar_media_asset_id === "string" ? row.avatar_media_asset_id : null,
              sequencePatternStepId:
                typeof row.sequence_pattern_step_id === "string" ? row.sequence_pattern_step_id : null,
            },
          }),
    approvedBy: typeof row.approved_by === "string" ? row.approved_by : null,
    approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }

  return record
}

async function assertVideoReferences(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoAssetId?: string | null
    videoPageId?: string | null
    voiceMediaAssetId?: string | null
    avatarMediaAssetId?: string | null
  },
): Promise<void> {
  if (input.videoAssetId) {
    const { data } = await admin
      .schema("growth")
      .from("video_assets")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.videoAssetId)
      .maybeSingle()
    if (!data) throw new Error("video_asset_not_found")
  }
  if (input.videoPageId) {
    const { data } = await admin
      .schema("growth")
      .from("video_pages")
      .select("id, video_asset_id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.videoPageId)
      .maybeSingle()
    if (!data) throw new Error("video_page_not_found")
  }
  if (input.voiceMediaAssetId) {
    const { data } = await admin
      .schema("growth")
      .from("media_assets")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.voiceMediaAssetId)
      .maybeSingle()
    if (!data) throw new Error("voice_asset_not_found")
  }
  if (input.avatarMediaAssetId) {
    const { data } = await admin
      .schema("growth")
      .from("media_assets")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.avatarMediaAssetId)
      .maybeSingle()
    if (!data) throw new Error("avatar_asset_not_found")
  }
}

export async function listGrowthSequenceVideoAttachments(
  admin: SupabaseClient,
  input: {
    organizationId: string
    automationFlowId?: string | null
    automationNodeId?: string | null
    sequencePatternStepId?: string | null
    attachmentType?: GrowthSequenceVideoAttachmentType | null
    attachmentStatus?: GrowthSequenceVideoAttachmentStatus | null
  },
): Promise<GrowthSequenceVideoAttachmentView[]> {
  let query = admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (input.automationFlowId) query = query.eq("automation_flow_id", input.automationFlowId)
  if (input.automationNodeId) query = query.eq("automation_node_id", input.automationNodeId)
  if (input.sequencePatternStepId) query = query.eq("sequence_pattern_step_id", input.sequencePatternStepId)
  if (input.attachmentType) query = query.eq("attachment_type", input.attachmentType)
  if (input.attachmentStatus) query = query.eq("attachment_status", input.attachmentStatus)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as AttachmentRow[]
  return Promise.all(
    rows.map((row) =>
      enrichSequenceVideoAttachmentView(admin, {
        organizationId: input.organizationId,
        row: row as unknown as Record<string, unknown>,
      }),
    ),
  )
}

export async function attachGrowthSequenceVideoAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string
    automationFlowId?: string | null
    automationNodeId: string
    sequencePatternStepId?: string | null
    attachmentType: GrowthSequenceVideoAttachmentType
    videoAssetId?: string | null
    videoPageId?: string | null
    voiceMediaAssetId?: string | null
    avatarMediaAssetId?: string | null
    thumbnailUrl?: string | null
    metadataHooks?: Partial<GrowthSequenceVideoAttachmentRecord["metadataHooks"]>
  },
): Promise<GrowthSequenceVideoAttachmentView> {
  validateSequenceVideoChannelCompatibility(input)
  await assertVideoReferences(admin, input)

  const metadataHooks = normalizeSequenceVideoMetadataHooks(input.metadataHooks, input)
  const aiPayload = buildSequenceVideoAttachmentAiPayload({
    attachment: {
      attachmentType: input.attachmentType,
      videoAssetId: input.videoAssetId ?? null,
      videoPageId: input.videoPageId ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      voiceMediaAssetId: input.voiceMediaAssetId ?? null,
      avatarMediaAssetId: input.avatarMediaAssetId ?? null,
      sequencePatternStepId: input.sequencePatternStepId ?? null,
    },
  })

  const { data: existing } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("automation_node_id", input.automationNodeId)
    .eq("attachment_type", input.attachmentType)
    .neq("attachment_status", "removed")
    .maybeSingle()

  const payload = {
    organization_id: input.organizationId,
    automation_flow_id: input.automationFlowId ?? null,
    automation_node_id: input.automationNodeId,
    sequence_pattern_step_id: input.sequencePatternStepId ?? null,
    attachment_type: input.attachmentType,
    attachment_status: "pending_approval" as const,
    video_asset_id: input.videoAssetId ?? null,
    video_page_id: input.videoPageId ?? null,
    voice_media_asset_id: input.voiceMediaAssetId ?? null,
    avatar_media_asset_id: input.avatarMediaAssetId ?? null,
    thumbnail_url: input.thumbnailUrl ?? null,
    metadata_json: {
      metadata_hooks: metadataHooks,
      analytics_hooks: buildSequenceVideoAttachmentAnalyticsHooks({
        sequencePatternStepId: input.sequencePatternStepId ?? null,
      }),
    },
    ai_payload: aiPayload,
    created_by: input.createdBy,
    approved_by: null,
    approved_at: null,
  }

  let row: AttachmentRow
  if (existing?.id) {
    const { data, error } = await admin
      .schema("growth")
      .from("sequence_video_attachments")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single()
    if (error || !data) throw new Error(error?.message ?? "update_failed")
    row = data as AttachmentRow
  } else {
    const { data, error } = await admin
      .schema("growth")
      .from("sequence_video_attachments")
      .insert(payload)
      .select("*")
      .single()
    if (error || !data) throw new Error(error?.message ?? "insert_failed")
    row = data as AttachmentRow
  }

  return enrichSequenceVideoAttachmentView(admin, {
    organizationId: input.organizationId,
    row: row as unknown as Record<string, unknown>,
  })
}

export async function getGrowthSequenceVideoAssetCatalog(
  admin: SupabaseClient,
  input: { organizationId: string },
) {
  const [catalog, attachments] = await Promise.all([
    listSequenceVideoAssetCatalog(admin, input),
    listGrowthSequenceVideoAttachments(admin, { organizationId: input.organizationId, attachmentStatus: "approved" }),
  ])

  return { catalog, attachments }
}
