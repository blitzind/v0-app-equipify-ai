/** Growth Engine SR-2B-5 — Share page platform API schemas. */

import { z } from "zod"
import {
  GROWTH_SHARE_PAGE_HERO_MEDIA_TYPES,
  GROWTH_SHARE_PAGE_SOURCE_CHANNELS,
  GROWTH_SHARE_PAGE_STATUSES,
} from "@/lib/growth/share-pages/share-page-types"

const ctaSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  kind: z.enum(["primary", "secondary", "link"]),
  action: z.enum(["book_meeting", "open_url", "download_resource", "reply_email"]),
  destinationUrl: z.string().max(2048).nullable().optional(),
  resourceId: z.string().max(80).nullable().optional(),
  trackingKey: z.string().min(1).max(80),
})

const resourceSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  description: z.string().max(500).nullable().optional(),
  kind: z.enum(["pdf", "link", "case_study", "one_pager"]),
  url: z.string().min(1).max(2048),
  thumbnailUrl: z.string().max(2048).nullable().optional(),
})

export const growthSharePageListQuerySchema = z.object({
  status: z.enum(GROWTH_SHARE_PAGE_STATUSES).optional(),
  source_channel: z.enum(GROWTH_SHARE_PAGE_SOURCE_CHANNELS).optional(),
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(5000).optional(),
})

export const growthSharePageCreateSchema = z.object({
  lead_id: z.string().uuid(),
  company_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  enrollment_id: z.string().uuid().nullable().optional(),
  sequence_step_id: z.string().uuid().nullable().optional(),
  sequence_enrollment_step_id: z.string().uuid().nullable().optional(),
  sequence_execution_job_id: z.string().uuid().nullable().optional(),
  source_channel: z.enum(GROWTH_SHARE_PAGE_SOURCE_CHANNELS).optional(),
  booking_page_id: z.string().uuid().nullable().optional(),
  headline: z.string().max(240).optional(),
  subheadline: z.string().max(240).nullable().optional(),
  hero_message: z.string().max(4000).optional(),
  why_reaching_out: z.string().max(2000).nullable().optional(),
  company_observations: z.array(z.string().max(500)).max(12).optional(),
  cta_config: z.array(ctaSchema).max(8).optional(),
  resources: z.array(resourceSchema).max(12).optional(),
  build_context: z.boolean().optional(),
})

export const growthSharePagePatchSchema = z.object({
  headline: z.string().max(240).optional(),
  subheadline: z.string().max(240).nullable().optional(),
  hero_message: z.string().max(4000).optional(),
  why_reaching_out: z.string().max(2000).nullable().optional(),
  company_observations: z.array(z.string().max(500)).max(12).optional(),
  cta_config: z.array(ctaSchema).max(8).optional(),
  resources: z.array(resourceSchema).max(12).optional(),
  booking_page_id: z.string().uuid().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_views: z.number().int().min(1).max(100000).nullable().optional(),
  hero_media_type: z.enum(GROWTH_SHARE_PAGE_HERO_MEDIA_TYPES).optional(),
  hero_media_url: z.string().max(2048).nullable().optional(),
  hero_media_thumbnail_url: z.string().max(2048).nullable().optional(),
})

export const growthSharePagePreviewSchema = z.object({
  rebuild_context: z.boolean().optional(),
})

export const growthSharePageOperatorWorkspaceListQuerySchema = z.object({
  lead_id: z.string().uuid().optional(),
  page_id: z.string().uuid().optional(),
})

export const growthSharePageOperatorWorkspaceQuerySchema = z.object({
  lead_id: z.string().uuid(),
  page_id: z.string().uuid().optional(),
})

export const growthSharePageOperatorWorkspaceActionSchema = z.object({
  lead_id: z.string().uuid(),
})

export const growthSharePageIntelligenceQuerySchema = z.object({
  share_page_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  session_id: z.string().min(8).max(120).optional(),
})
