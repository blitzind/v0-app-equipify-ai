/** Growth Engine D2 — Sequence video send render helpers (client-safe). */

import type {
  GrowthSequenceVideoAttachmentAnalyticsHooks,
  GrowthSequenceVideoAttachmentRecord,
  GrowthSequenceVideoAttachmentType,
  GrowthSequenceVideoChannelPreview,
  GrowthSequenceVideoSendAttribution,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

export function buildSequenceVideoSendAnalyticsHooks(input: {
  attachment: Pick<GrowthSequenceVideoAttachmentRecord, "sequencePatternStepId" | "analyticsHooks">
  sequenceExecutionId?: string | null
  enrollmentStepId?: string | null
  emailSendId?: string | null
  smsSendId?: string | null
  voiceDropId?: string | null
  videoPageVisitId?: string | null
  engagementSummaryId?: string | null
}): GrowthSequenceVideoAttachmentAnalyticsHooks {
  return {
    sequence_step_id:
      input.enrollmentStepId ??
      input.attachment.sequencePatternStepId ??
      input.attachment.analyticsHooks.sequence_step_id ??
      null,
    sequence_execution_id: input.sequenceExecutionId ?? input.attachment.analyticsHooks.sequence_execution_id ?? null,
    email_send_id: input.emailSendId ?? input.attachment.analyticsHooks.email_send_id ?? null,
    sms_send_id: input.smsSendId ?? input.attachment.analyticsHooks.sms_send_id ?? null,
    voice_drop_id: input.voiceDropId ?? input.attachment.analyticsHooks.voice_drop_id ?? null,
    video_page_visit_id:
      input.videoPageVisitId ?? input.attachment.analyticsHooks.video_page_visit_id ?? null,
    engagement_summary_id:
      input.engagementSummaryId ?? input.attachment.analyticsHooks.engagement_summary_id ?? null,
  }
}

export function renderSequenceVideoEmailSendBlock(input: {
  firstName: string
  publicUrl: string
  thumbnailUrl?: string | null
  ctaLabel?: string | null
  avatarPreviewUrl?: string | null
}): string {
  const thumbBlock = input.thumbnailUrl
    ? `<img src="${input.thumbnailUrl}" alt="Video thumbnail" style="max-width:480px;border-radius:12px;display:block;" />`
    : `<div style="width:480px;max-width:100%;height:270px;background:#111;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;">Personalized Video</div>`

  const avatarBlock = input.avatarPreviewUrl
    ? `<img src="${input.avatarPreviewUrl}" alt="" style="max-width:120px;border-radius:999px;margin-top:12px;" />`
    : ""

  const ctaLabel = input.ctaLabel?.trim() || "Watch Personalized Video"

  return [
    `<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;">`,
    thumbBlock,
    `<p style="margin:12px 0 0;font-size:15px;line-height:1.5;">I recorded a quick video for you.</p>`,
    `<p style="margin:12px 0 0;"><a href="${input.publicUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">${ctaLabel}</a></p>`,
    avatarBlock,
    `</div>`,
  ].join("")
}

export function renderSequenceVideoSmsSendBlock(input: {
  firstName: string
  publicUrl: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  thumbnailUrl?: string | null
}): string {
  const lines = [
    `Hey ${input.firstName},`,
    "",
    "I recorded a quick video for you:",
    input.publicUrl,
  ]

  if (input.ctaUrl?.trim()) {
    lines.push("", `${input.ctaLabel?.trim() || "Book a Demo"}:`, input.ctaUrl.trim())
  }

  if (input.thumbnailUrl?.trim()) {
    lines.push("", `Thumbnail: ${input.thumbnailUrl.trim()}`)
  }

  return lines.join("\n")
}

export function renderSequenceVideoVoiceDropSendBlock(input: {
  voiceMediaAssetId?: string | null
  publicUrl?: string | null
}): string {
  return [
    "Voice asset attached",
    input.voiceMediaAssetId ? `voice_media_asset_id: ${input.voiceMediaAssetId}` : null,
    input.publicUrl ? `Follow-up page:\n${input.publicUrl}` : null,
    "No avatar playback in voice drop channel.",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildSequenceVideoChannelPreviewFromRender(input: {
  attachmentType: GrowthSequenceVideoAttachmentType
  firstName: string
  publicUrl: string
  signedThumbnailUrl?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  avatarPreviewUrl?: string | null
  voiceMediaAssetId?: string | null
}): GrowthSequenceVideoChannelPreview {
  if (input.attachmentType === "email") {
    return {
      channel: "email",
      emailHtml: renderSequenceVideoEmailSendBlock({
        firstName: input.firstName,
        publicUrl: input.publicUrl,
        thumbnailUrl: input.signedThumbnailUrl,
        ctaLabel: input.ctaLabel,
        avatarPreviewUrl: input.avatarPreviewUrl,
      }),
    }
  }

  if (input.attachmentType === "sms") {
    return {
      channel: "sms",
      smsText: renderSequenceVideoSmsSendBlock({
        firstName: input.firstName,
        publicUrl: input.publicUrl,
        ctaLabel: input.ctaLabel,
        ctaUrl: input.ctaUrl,
        thumbnailUrl: input.signedThumbnailUrl,
      }),
    }
  }

  return {
    channel: "voice_drop",
    voiceDropSummary: renderSequenceVideoVoiceDropSendBlock({
      voiceMediaAssetId: input.voiceMediaAssetId,
      publicUrl: input.publicUrl,
    }),
  }
}

export type GrowthSequenceVideoSendWirePreview = {
  channelPreview: GrowthSequenceVideoChannelPreview
  attribution: GrowthSequenceVideoSendAttribution
}

export function applySequenceVideoAttachmentToEmailHtml(
  html: string,
  preview: GrowthSequenceVideoSendWirePreview,
): string {
  const block = preview.channelPreview.emailHtml?.trim()
  if (!block) return html
  return `${html}<div style="margin-top:24px;">${block}</div>`
}

export function applySequenceVideoAttachmentToSmsBody(
  body: string,
  preview: GrowthSequenceVideoSendWirePreview,
): string {
  const block = preview.channelPreview.smsText?.trim()
  if (!block) return body
  return `${body.trim()}\n\n${block}`.trim()
}

export function applySequenceVideoAttachmentToVoiceDropMessage(
  renderedMessage: string,
  preview: GrowthSequenceVideoSendWirePreview,
): string {
  const block = preview.channelPreview.voiceDropSummary?.trim()
  if (!block) return renderedMessage
  return `${renderedMessage.trim()}\n\n${block}`.trim()
}
