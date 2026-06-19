import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceVideoAssetCatalogItem,
  GrowthSequenceVideoAttachmentView,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import {
  buildSequenceVideoAttachmentAiPayload,
  normalizeSequenceVideoMetadataHooks,
  renderSequenceVideoChannelPreview,
  resolveSequenceVideoAttachmentContext,
} from "@/lib/growth/sequences/growth-sequence-video-render-service"
import { mapSequenceVideoAttachmentRow } from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { buildGrowthVideoPublicPath } from "@/lib/growth/videos/growth-video-page-validation"

export async function buildSequenceVideoAttachmentPreview(
  admin: SupabaseClient,
  input: {
    organizationId: string
    attachmentId?: string | null
    attachmentType: GrowthSequenceVideoAttachmentView["attachmentType"]
    videoPageId?: string | null
    voiceMediaAssetId?: string | null
    avatarMediaAssetId?: string | null
    thumbnailUrl?: string | null
    previewFirstName?: string | null
  },
): Promise<{
  attachment: GrowthSequenceVideoAttachmentView | null
  channelPreview: ReturnType<typeof renderSequenceVideoChannelPreview>
  aiPayload: ReturnType<typeof buildSequenceVideoAttachmentAiPayload>
}> {
  let attachment: GrowthSequenceVideoAttachmentView | null = null
  if (input.attachmentId) {
    const { data, error } = await admin
      .schema("growth")
      .from("sequence_video_attachments")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("id", input.attachmentId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error("not_found")
    attachment = await enrichSequenceVideoAttachmentView(admin, {
      organizationId: input.organizationId,
      row: data as Record<string, unknown>,
    })
  }

  const videoPageId = input.videoPageId ?? attachment?.videoPageId ?? null
  const context = await resolveSequenceVideoAttachmentContext(admin, {
    organizationId: input.organizationId,
    videoPageId,
  })

  const channelPreview = renderSequenceVideoChannelPreview({
    attachmentType: input.attachmentType,
    videoPageTitle: context.videoPageTitle,
    publicUrl: context.publicUrl,
    thumbnailUrl: input.thumbnailUrl ?? attachment?.thumbnailUrl ?? null,
    voiceMediaAssetId: input.voiceMediaAssetId ?? attachment?.voiceMediaAssetId ?? null,
    avatarMediaAssetId: input.avatarMediaAssetId ?? attachment?.avatarMediaAssetId ?? null,
    previewFirstName: input.previewFirstName,
  })

  const aiPayload = buildSequenceVideoAttachmentAiPayload({
    attachment: {
      attachmentType: input.attachmentType,
      videoAssetId: attachment?.videoAssetId ?? null,
      videoPageId,
      thumbnailUrl: input.thumbnailUrl ?? attachment?.thumbnailUrl ?? null,
      voiceMediaAssetId: input.voiceMediaAssetId ?? attachment?.voiceMediaAssetId ?? null,
      avatarMediaAssetId: input.avatarMediaAssetId ?? attachment?.avatarMediaAssetId ?? null,
      sequencePatternStepId: attachment?.sequencePatternStepId ?? null,
    },
  })

  return { attachment, channelPreview, aiPayload }
}

export async function enrichSequenceVideoAttachmentView(
  admin: SupabaseClient,
  input: { organizationId: string; row: Record<string, unknown> },
): Promise<GrowthSequenceVideoAttachmentView> {
  const record = mapSequenceVideoAttachmentRow(input.row)
  const context = await resolveSequenceVideoAttachmentContext(admin, {
    organizationId: input.organizationId,
    videoPageId: record.videoPageId,
  })
  const channelPreview = renderSequenceVideoChannelPreview({
    attachmentType: record.attachmentType,
    videoPageTitle: context.videoPageTitle,
    publicUrl: context.publicUrl,
    thumbnailUrl: record.thumbnailUrl,
    voiceMediaAssetId: record.voiceMediaAssetId,
    avatarMediaAssetId: record.avatarMediaAssetId,
  })

  return {
    ...record,
    channelPreview,
    catalogSummary: {
      videoPageTitle: context.videoPageTitle,
      videoPageSlug: context.videoPageSlug,
      publicPath: context.videoPageSlug ? buildGrowthVideoPublicPath(context.videoPageSlug) : null,
    },
  }
}

export async function listSequenceVideoAssetCatalog(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<GrowthSequenceVideoAssetCatalogItem[]> {
  const items: GrowthSequenceVideoAssetCatalogItem[] = []

  const [assetsRes, pagesRes, mediaRes] = await Promise.all([
    admin
      .schema("growth")
      .from("video_assets")
      .select("id, title, status")
      .eq("organization_id", input.organizationId)
      .order("updated_at", { ascending: false })
      .limit(25),
    admin
      .schema("growth")
      .from("video_pages")
      .select("id, title, slug, status, video_asset_id")
      .eq("organization_id", input.organizationId)
      .order("updated_at", { ascending: false })
      .limit(25),
    admin
      .schema("growth")
      .from("media_assets")
      .select("id, title, asset_type, metadata, status")
      .eq("organization_id", input.organizationId)
      .in("asset_type", ["generated_audio", "generated_video"])
      .order("updated_at", { ascending: false })
      .limit(50),
  ])

  for (const row of assetsRes.data ?? []) {
    items.push({
      id: String(row.id),
      kind: "video_asset",
      title: String(row.title ?? "Video asset"),
      subtitle: String(row.status ?? ""),
      videoAssetId: String(row.id),
      videoPageId: null,
      mediaAssetId: null,
      thumbnailUrl: null,
      publicPath: null,
      dryRun: false,
    })
  }

  for (const row of pagesRes.data ?? []) {
    const slug = typeof row.slug === "string" ? row.slug : null
    items.push({
      id: String(row.id),
      kind: "video_page",
      title: String(row.title ?? "Video page"),
      subtitle: slug,
      videoAssetId: typeof row.video_asset_id === "string" ? row.video_asset_id : null,
      videoPageId: String(row.id),
      mediaAssetId: null,
      thumbnailUrl: null,
      publicPath: slug ? buildGrowthVideoPublicPath(slug) : null,
      dryRun: false,
    })
  }

  for (const row of mediaRes.data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const subtype = typeof metadata.media_subtype === "string" ? metadata.media_subtype : null
    const dryRun = Boolean(metadata.dry_run)
    if (subtype === "voiceover_audio" || row.asset_type === "generated_audio") {
      items.push({
        id: String(row.id),
        kind: "voice_media",
        title: String(row.title ?? "Voiceover"),
        subtitle: subtype,
        videoAssetId: null,
        videoPageId: null,
        mediaAssetId: String(row.id),
        thumbnailUrl: null,
        publicPath: null,
        dryRun,
      })
    } else if (subtype === "generated_avatar_video" || row.asset_type === "generated_video") {
      items.push({
        id: String(row.id),
        kind: "avatar_media",
        title: String(row.title ?? "Avatar video"),
        subtitle: subtype,
        videoAssetId: null,
        videoPageId: null,
        mediaAssetId: String(row.id),
        thumbnailUrl: null,
        publicPath: null,
        dryRun,
      })
    }
  }

  return items
}

export function buildSequenceVideoAttachmentAnalyticsHooks(input: {
  sequencePatternStepId?: string | null
}): Record<string, string | null> {
  return {
    sequence_step_id: input.sequencePatternStepId ?? null,
    sequence_execution_id: null,
    email_send_id: null,
    sms_send_id: null,
    voice_drop_id: null,
    video_page_visit_id: null,
    engagement_summary_id: null,
  }
}

export { normalizeSequenceVideoMetadataHooks }
