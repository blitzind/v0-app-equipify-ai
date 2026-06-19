/** Growth Engine A2 — Video assets API schemas (client-safe). */

import { z } from "zod"
import {
  GROWTH_VIDEO_ALLOWED_MIME_TYPES,
  GROWTH_VIDEO_ASSET_STATUSES,
  GROWTH_VIDEO_MAX_UPLOAD_BYTES,
  GROWTH_VIDEO_SOURCE_TYPES,
} from "@/lib/growth/videos/growth-video-types"

export const growthVideoAssetCreateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  original_filename: z.string().trim().min(1).max(200),
  mime_type: z.enum(GROWTH_VIDEO_ALLOWED_MIME_TYPES as unknown as [string, ...string[]]),
  file_size_bytes: z.number().int().min(1).max(GROWTH_VIDEO_MAX_UPLOAD_BYTES),
  source_type: z.enum(GROWTH_VIDEO_SOURCE_TYPES as unknown as [string, ...string[]]).optional(),
})

export const growthVideoAssetListQuerySchema = z.object({
  status: z.enum(GROWTH_VIDEO_ASSET_STATUSES as unknown as [string, ...string[]]).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const growthVideoAssetPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(GROWTH_VIDEO_ASSET_STATUSES as unknown as [string, ...string[]]).optional(),
  })
  .strict()

export const growthVideoUploadUrlSchema = z.object({
  mime_type: z.enum(GROWTH_VIDEO_ALLOWED_MIME_TYPES as unknown as [string, ...string[]]).optional(),
  file_size_bytes: z.number().int().min(1).max(GROWTH_VIDEO_MAX_UPLOAD_BYTES).optional(),
})

export const growthVideoCompleteUploadSchema = z.object({
  file_size_bytes: z.number().int().min(1).max(GROWTH_VIDEO_MAX_UPLOAD_BYTES).optional(),
  duration_seconds: z.number().min(0).nullable().optional(),
})

export const growthVideoPageCreateSchema = z.object({
  video_asset_id: z.string().uuid(),
  slug: z.string().trim().min(3).max(80).optional(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).nullable().optional(),
  cta_label: z.string().trim().max(120).nullable().optional(),
  cta_url: z.string().trim().url().max(2048).nullable().optional(),
  calendar_url: z.string().trim().url().max(2048).nullable().optional(),
  branding: z
    .object({
      logoUrl: z.string().trim().url().max(2048).nullable().optional(),
      primaryColor: z.string().trim().max(32).nullable().optional(),
      buttonLabelOverride: z.string().trim().max(120).nullable().optional(),
    })
    .optional(),
  personalization: z
    .object({
      variables: z.record(z.string().max(500)).optional(),
      mergeFields: z.array(z.string().max(64)).optional(),
      previewContext: z.record(z.string().max(500)).optional(),
    })
    .optional(),
})

export const growthVideoPageListQuerySchema = z.object({
  status: z.enum(["draft", "published", "archived"]).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const growthVideoPagePatchSchema = z
  .object({
    video_asset_id: z.string().uuid().optional(),
    slug: z.string().trim().min(3).max(80).optional(),
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    cta_label: z.string().trim().max(120).nullable().optional(),
    cta_url: z.string().trim().url().max(2048).nullable().optional(),
    calendar_url: z.string().trim().url().max(2048).nullable().optional(),
    branding: growthVideoPageCreateSchema.shape.branding.optional(),
    personalization: growthVideoPageCreateSchema.shape.personalization.optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict()

export const growthVideoPageEventSchema = z.object({
  slug: z.string().trim().min(3).max(80),
  event_type: z.enum([
    "page_view",
    "video_play",
    "video_progress",
    "video_complete",
    "cta_click",
    "calendar_click",
  ]),
  session_id: z.string().trim().min(8).max(120),
  visitor_identifier: z.string().trim().max(128).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const growthVideoAnalyticsQuerySchema = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  video_asset_id: z.string().uuid().optional(),
  video_page_id: z.string().uuid().optional(),
  visitor_identifier: z.string().trim().max(128).optional(),
  session_id: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})
