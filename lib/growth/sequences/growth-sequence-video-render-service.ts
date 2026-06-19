import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceVideoAttachmentMetadataHooks,
  GrowthSequenceVideoAttachmentRecord,
  GrowthSequenceVideoAttachmentType,
  GrowthSequenceVideoChannelPreview,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import { buildGrowthVideoPublicPath } from "@/lib/growth/videos/growth-video-page-validation"

export function resolveSequenceVideoPublicUrl(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? ""
  const path = buildGrowthVideoPublicPath(slug)
  return base ? `${base}${path}` : path
}

export function validateSequenceVideoChannelCompatibility(input: {
  attachmentType: GrowthSequenceVideoAttachmentType
  videoPageId?: string | null
  voiceMediaAssetId?: string | null
  avatarMediaAssetId?: string | null
}): void {
  if (input.attachmentType === "email" || input.attachmentType === "sms") {
    if (!input.videoPageId) throw new Error("invalid_channel_compatibility:video_page_required")
  }
  if (input.attachmentType === "voice_drop") {
    if (!input.voiceMediaAssetId) throw new Error("invalid_channel_compatibility:voice_asset_required")
  }
  if (input.attachmentType === "email" && input.avatarMediaAssetId) {
    throw new Error("invalid_channel_compatibility:avatar_not_supported_in_email")
  }
}

export function renderSequenceVideoChannelPreview(input: {
  attachmentType: GrowthSequenceVideoAttachmentType
  videoPageTitle?: string | null
  publicUrl?: string | null
  thumbnailUrl?: string | null
  voiceMediaAssetId?: string | null
  avatarMediaAssetId?: string | null
  previewFirstName?: string | null
}): GrowthSequenceVideoChannelPreview {
  const firstName = input.previewFirstName?.trim() || "John"
  const publicUrl = input.publicUrl ?? "https://example.com/v/preview"
  const thumbnail = input.thumbnailUrl ?? null

  if (input.attachmentType === "email") {
    const thumbBlock = thumbnail
      ? `<img src="${thumbnail}" alt="Video thumbnail" style="max-width:480px;border-radius:12px;" />`
      : `<div style="width:480px;height:270px;background:#111;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;">Personalized Video</div>`
    return {
      channel: "email",
      emailHtml: `${thumbBlock}<p><a href="${publicUrl}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Watch Personalized Video</a></p><p><a href="${publicUrl}">Open Video Page</a></p>`,
    }
  }

  if (input.attachmentType === "sms") {
    const suffix = thumbnail ? `\n${thumbnail}` : ""
    return {
      channel: "sms",
      smsText: `Hey ${firstName}, I made this quick video:\n${publicUrl}${suffix}`,
    }
  }

  return {
    channel: "voice_drop",
    voiceDropSummary: [
      "Voice asset attached",
      input.voiceMediaAssetId ? `voice_media_asset_id: ${input.voiceMediaAssetId}` : null,
      input.publicUrl ? `Video follow-up available: ${input.publicUrl}` : null,
      input.avatarMediaAssetId ? null : "No avatar video playback in voice drop channel.",
    ]
      .filter(Boolean)
      .join("\n"),
  }
}

export function buildSequenceVideoAttachmentAiPayload(input: {
  attachment: Pick<
    GrowthSequenceVideoAttachmentRecord,
    | "attachmentType"
    | "videoAssetId"
    | "videoPageId"
    | "thumbnailUrl"
    | "voiceMediaAssetId"
    | "avatarMediaAssetId"
    | "sequencePatternStepId"
  >
}): GrowthSequenceVideoAttachmentRecord["aiPayload"] {
  return {
    attachment_type: input.attachment.attachmentType,
    video_asset_id: input.attachment.videoAssetId,
    video_page_id: input.attachment.videoPageId,
    thumbnail_url: input.attachment.thumbnailUrl,
    voice_media_asset_id: input.attachment.voiceMediaAssetId,
    avatar_media_asset_id: input.attachment.avatarMediaAssetId,
    sequence_step_id: input.attachment.sequencePatternStepId,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export async function resolveSequenceVideoAttachmentContext(
  admin: SupabaseClient,
  input: { organizationId: string; videoPageId?: string | null },
): Promise<{ videoPageTitle: string | null; videoPageSlug: string | null; publicUrl: string | null }> {
  if (!input.videoPageId) {
    return { videoPageTitle: null, videoPageSlug: null, publicUrl: null }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("video_pages")
    .select("title, slug, status")
    .eq("organization_id", input.organizationId)
    .eq("id", input.videoPageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("video_page_not_found")

  const slug = typeof data.slug === "string" ? data.slug : null
  return {
    videoPageTitle: typeof data.title === "string" ? data.title : null,
    videoPageSlug: slug,
    publicUrl: resolveSequenceVideoPublicUrl(slug),
  }
}

export function normalizeSequenceVideoMetadataHooks(
  hooks?: Partial<GrowthSequenceVideoAttachmentMetadataHooks>,
  record?: Partial<GrowthSequenceVideoAttachmentRecord>,
): GrowthSequenceVideoAttachmentMetadataHooks {
  return {
    video_asset_id: record?.videoAssetId ?? hooks?.video_asset_id ?? null,
    video_page_id: record?.videoPageId ?? hooks?.video_page_id ?? null,
    thumbnail_url: record?.thumbnailUrl ?? hooks?.thumbnail_url ?? null,
    voice_media_asset_id: record?.voiceMediaAssetId ?? hooks?.voice_media_asset_id ?? null,
    avatar_media_asset_id: record?.avatarMediaAssetId ?? hooks?.avatar_media_asset_id ?? null,
    script_version_id: hooks?.script_version_id ?? null,
    lead_id: hooks?.lead_id ?? null,
    company_candidate_id: hooks?.company_candidate_id ?? null,
    person_candidate_id: hooks?.person_candidate_id ?? null,
    sequence_candidate_id: hooks?.sequence_candidate_id ?? null,
  }
}
