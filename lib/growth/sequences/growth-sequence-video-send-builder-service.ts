import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequenceVideoAttachments } from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import type {
  GrowthSequenceVideoAttachmentType,
  GrowthSequenceVideoChannelPreview,
  GrowthSequenceVideoSendAttribution,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import {
  buildSequenceVideoSendAttribution,
  persistSequenceVideoSendAttribution,
  patchSequenceVideoAttachmentAnalyticsHooks,
} from "@/lib/growth/sequences/growth-sequence-video-attribution-service"
import { buildSequenceVideoEngagementSignals } from "@/lib/growth/sequences/growth-sequence-video-engagement-service"
import {
  resolveSequenceVideoAttachmentContext,
  resolveSequenceVideoPublicUrl,
} from "@/lib/growth/sequences/growth-sequence-video-render-service"
import {
  applySequenceVideoAttachmentToEmailHtml,
  applySequenceVideoAttachmentToSmsBody,
  applySequenceVideoAttachmentToVoiceDropMessage,
  buildSequenceVideoChannelPreviewFromRender,
  type GrowthSequenceVideoSendWirePreview,
} from "@/lib/growth/sequences/growth-sequence-video-send-render"
import { renderGrowthVideoPageFields } from "@/lib/growth/videos/growth-video-personalization-service"
import {
  parseGrowthVideoPageBranding,
  parseGrowthVideoPagePersonalization,
} from "@/lib/growth/videos/growth-video-page-validation"
import { resolveGrowthVideoPublicThumbnailUrls } from "@/lib/growth/videos/growth-video-thumbnail-service"
import type { GrowthSequenceTransportChannel } from "@/lib/growth/sequences/execution/sequence-execution-types"

export type GrowthSequenceVideoSendWireResult = GrowthSequenceVideoSendWirePreview

export {
  applySequenceVideoAttachmentToEmailHtml,
  applySequenceVideoAttachmentToSmsBody,
  applySequenceVideoAttachmentToVoiceDropMessage,
}

function mapTransportChannelToAttachmentType(
  channel: GrowthSequenceTransportChannel,
): GrowthSequenceVideoAttachmentType {
  return channel
}

function leadFirstName(contactName: string | null | undefined): string {
  const trimmed = contactName?.trim()
  if (!trimmed) return "there"
  return trimmed.split(/\s+/)[0] ?? "there"
}

async function loadVideoPageRow(
  admin: SupabaseClient,
  input: { organizationId: string; videoPageId: string },
) {
  const { data, error } = await admin
    .schema("growth")
    .from("video_pages")
    .select(
      "id, organization_id, video_asset_id, title, description, slug, status, cta_label, cta_url, calendar_url, branding_json, personalization_json, metadata_json",
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.videoPageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("video_page_not_found")
  return data
}

async function resolveApprovedAttachment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sequencePatternStepId: string | null
    attachmentType: GrowthSequenceVideoAttachmentType
  },
) {
  if (!input.sequencePatternStepId) return null

  const attachments = await listGrowthSequenceVideoAttachments(admin, {
    organizationId: input.organizationId,
    sequencePatternStepId: input.sequencePatternStepId,
    attachmentType: input.attachmentType,
    attachmentStatus: "approved",
  })

  return attachments[0] ?? null
}

async function buildSendRenderContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    attachment: NonNullable<Awaited<ReturnType<typeof resolveApprovedAttachment>>>
    leadId: string
  },
) {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const firstName = leadFirstName(lead?.contactName)

  let publicUrl: string | null = null
  let signedThumbnailUrl: string | null = input.attachment.thumbnailUrl
  let ctaLabel = "Book a Demo"
  let ctaUrl: string | null = null
  let avatarPreviewUrl: string | null = null

  if (input.attachment.videoPageId) {
    const pageRow = await loadVideoPageRow(admin, {
      organizationId: input.organizationId,
      videoPageId: input.attachment.videoPageId,
    })
    const branding = parseGrowthVideoPageBranding(pageRow.branding_json)
    const personalization = parseGrowthVideoPagePersonalization(pageRow.personalization_json)
    const metadata = (pageRow.metadata_json ?? {}) as Record<string, unknown>

    const rendered = await renderGrowthVideoPageFields(
      admin,
      {
        organizationId: input.organizationId,
        leadId: input.leadId,
        companyCandidateId: input.attachment.metadataHooks.company_candidate_id ?? null,
        personCandidateId: input.attachment.metadataHooks.person_candidate_id ?? null,
        pagePersonalization: personalization,
      },
      {
        title: pageRow.title,
        description: pageRow.description,
        ctaLabel: pageRow.cta_label,
        ctaUrl: pageRow.cta_url,
        calendarUrl: pageRow.calendar_url,
        branding,
      },
    )

    const slug = typeof pageRow.slug === "string" ? pageRow.slug : null
    publicUrl = resolveSequenceVideoPublicUrl(slug)
    ctaLabel = rendered.ctaLabel?.trim() || ctaLabel
    ctaUrl = rendered.ctaUrl

    const thumbnails = await resolveGrowthVideoPublicThumbnailUrls(admin, {
      organizationId: input.organizationId,
      videoAssetId: pageRow.video_asset_id,
      metadata,
      mergeValues: rendered.mergeContext.variables,
      branding: rendered.branding,
      pageTitle: rendered.title,
      ctaLabel: rendered.ctaLabel,
    })
    signedThumbnailUrl = thumbnails.thumbnailUrl ?? thumbnails.ogImageUrl ?? signedThumbnailUrl
  } else {
    const context = await resolveSequenceVideoAttachmentContext(admin, {
      organizationId: input.organizationId,
      videoPageId: input.attachment.videoPageId,
    })
    publicUrl = context.publicUrl
  }

  if (input.attachment.avatarMediaAssetId) {
    avatarPreviewUrl = signedThumbnailUrl
  }

  return {
    firstName,
    publicUrl: publicUrl ?? "https://example.com/v/preview",
    signedThumbnailUrl,
    ctaLabel,
    ctaUrl,
    avatarPreviewUrl,
    voiceMediaAssetId: input.attachment.voiceMediaAssetId,
    attachmentType: input.attachment.attachmentType,
  }
}

export async function buildSequenceVideoSendPreview(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sequencePatternStepId: string
    attachmentType: GrowthSequenceVideoAttachmentType
    leadId: string
    sequenceExecutionJobId?: string | null
    enrollmentStepId?: string | null
  },
): Promise<GrowthSequenceVideoSendWireResult | null> {
  const attachment = await resolveApprovedAttachment(admin, {
    organizationId: input.organizationId,
    sequencePatternStepId: input.sequencePatternStepId,
    attachmentType: input.attachmentType,
  })
  if (!attachment) return null

  const render = await buildSendRenderContext(admin, {
    organizationId: input.organizationId,
    attachment,
    leadId: input.leadId,
  })

  const engagement = attachment.videoPageId
    ? await buildSequenceVideoEngagementSignals(admin, {
        organizationId: input.organizationId,
        videoPageId: attachment.videoPageId,
        leadId: input.leadId,
      })
    : null

  const attribution = buildSequenceVideoSendAttribution({
    attachment,
    publicUrl: render.publicUrl,
    signedThumbnailUrl: render.signedThumbnailUrl,
    sequenceExecutionId: input.sequenceExecutionJobId ?? null,
    enrollmentStepId: input.enrollmentStepId ?? null,
    d3Signals: engagement?.signals ?? [],
  })

  return {
    channelPreview: buildSequenceVideoChannelPreviewFromRender({
      attachmentType: render.attachmentType,
      firstName: render.firstName,
      publicUrl: render.publicUrl,
      signedThumbnailUrl: render.signedThumbnailUrl,
      ctaLabel: render.ctaLabel,
      ctaUrl: render.ctaUrl,
      avatarPreviewUrl: render.avatarPreviewUrl,
      voiceMediaAssetId: render.voiceMediaAssetId,
    }),
    attribution,
  }
}

export async function wireApprovedSequenceVideoAttachment(
  admin: SupabaseClient,
  input: {
    organizationId: string | null | undefined
    sequencePatternStepId: string | null
    channel: GrowthSequenceTransportChannel
    leadId: string
    sequenceExecutionJobId?: string | null
    enrollmentStepId?: string | null
    persistAnalyticsHooks?: boolean
  },
): Promise<GrowthSequenceVideoSendWireResult | null> {
  if (!input.organizationId || !input.sequencePatternStepId) return null

  const preview = await buildSequenceVideoSendPreview(admin, {
    organizationId: input.organizationId,
    sequencePatternStepId: input.sequencePatternStepId,
    attachmentType: mapTransportChannelToAttachmentType(input.channel),
    leadId: input.leadId,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
    enrollmentStepId: input.enrollmentStepId ?? null,
  })

  if (!preview) return null

  if (input.persistAnalyticsHooks !== false) {
    await persistSequenceVideoSendAttribution(admin, {
      attachmentId: preview.attribution.attachmentId,
      organizationId: input.organizationId,
      ...preview.attribution.analyticsHooks,
    })
  }

  return preview
}

export async function finalizeSequenceVideoSendAttribution(
  admin: SupabaseClient,
  input: {
    organizationId: string
    attachmentId: string
    emailSendId?: string | null
    smsSendId?: string | null
    voiceDropId?: string | null
    videoPageVisitId?: string | null
    engagementSummaryId?: string | null
  },
) {
  return patchSequenceVideoAttachmentAnalyticsHooks(admin, {
    attachmentId: input.attachmentId,
    organizationId: input.organizationId,
    email_send_id: input.emailSendId ?? null,
    sms_send_id: input.smsSendId ?? null,
    voice_drop_id: input.voiceDropId ?? null,
    video_page_visit_id: input.videoPageVisitId ?? null,
    engagement_summary_id: input.engagementSummaryId ?? null,
  })
}

export type { GrowthSequenceVideoSendAttribution }
