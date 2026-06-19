/** Growth Engine D1 — Sequence video attachment API schemas (client-safe). */

import { z } from "zod"
import {
  GROWTH_SEQUENCE_VIDEO_ATTACHMENT_STATUSES,
  GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

export const growthSequenceVideoAttachmentListSchema = z.object({
  automation_flow_id: z.string().uuid().optional(),
  automation_node_id: z.string().uuid().optional(),
  sequence_pattern_step_id: z.string().uuid().optional(),
  attachment_type: z.enum(GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES).optional(),
  attachment_status: z.enum(GROWTH_SEQUENCE_VIDEO_ATTACHMENT_STATUSES).optional(),
})

export const growthSequenceVideoAttachmentAttachSchema = z.object({
  automation_flow_id: z.string().uuid().optional(),
  automation_node_id: z.string().uuid(),
  sequence_pattern_step_id: z.string().uuid().nullable().optional(),
  attachment_type: z.enum(GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES),
  video_asset_id: z.string().uuid().nullable().optional(),
  video_page_id: z.string().uuid().nullable().optional(),
  voice_media_asset_id: z.string().uuid().nullable().optional(),
  avatar_media_asset_id: z.string().uuid().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  metadata_hooks: z
    .object({
      script_version_id: z.string().uuid().nullable().optional(),
      lead_id: z.string().uuid().nullable().optional(),
      company_candidate_id: z.string().uuid().nullable().optional(),
      person_candidate_id: z.string().uuid().nullable().optional(),
      sequence_candidate_id: z.string().uuid().nullable().optional(),
    })
    .optional(),
})

export const growthSequenceVideoAttachmentPreviewSchema = z.object({
  attachment_id: z.string().uuid().optional(),
  automation_node_id: z.string().uuid().optional(),
  attachment_type: z.enum(GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES),
  video_page_id: z.string().uuid().nullable().optional(),
  voice_media_asset_id: z.string().uuid().nullable().optional(),
  avatar_media_asset_id: z.string().uuid().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  preview_first_name: z.string().trim().max(80).optional(),
})

export const growthSequenceVideoAttachmentApproveSchema = z.object({
  attachment_id: z.string().uuid(),
  action: z.enum(["approve", "remove", "replace"]),
  replace_with: growthSequenceVideoAttachmentAttachSchema.partial().optional(),
})

export const growthSequenceVideoSendPreviewSchema = z.object({
  sequence_pattern_step_id: z.string().uuid(),
  attachment_type: z.enum(GROWTH_SEQUENCE_VIDEO_ATTACHMENT_TYPES),
  lead_id: z.string().uuid(),
  sequence_execution_job_id: z.string().uuid().optional(),
  enrollment_step_id: z.string().uuid().optional(),
})

export const growthSequenceVideoAnalyticsDiagnosticsSchema = z.object({
  attachment_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
})

export const growthSequenceVideoIntelligenceDiagnosticsSchema = z.object({
  attachment_id: z.string().uuid().optional(),
  video_page_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  session_id: z.string().trim().max(120).optional(),
}).refine((value) => Boolean(value.attachment_id || value.video_page_id), {
  message: "attachment_id_or_video_page_id_required",
})
