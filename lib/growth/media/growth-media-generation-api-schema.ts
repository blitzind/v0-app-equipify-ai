/** Growth Engine C3 — Media generation jobs API schemas (client-safe). */

import { z } from "zod"
import {
  GROWTH_MEDIA_GENERATION_STATUSES,
  GROWTH_MEDIA_GENERATION_TYPES,
} from "@/lib/growth/media/growth-media-generation-types"

const metadataHooksSchema = z
  .object({
    video_page_id: z.string().uuid().nullable().optional(),
    video_asset_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
    company_candidate_id: z.string().uuid().nullable().optional(),
    person_candidate_id: z.string().uuid().nullable().optional(),
    personalization_profile_id: z.string().uuid().nullable().optional(),
    sequence_candidate_id: z.string().trim().max(120).nullable().optional(),
    script_version_id: z.string().uuid().nullable().optional(),
  })
  .partial()

export const growthMediaGenerationJobCreateSchema = z.object({
  generation_type: z.enum(GROWTH_MEDIA_GENERATION_TYPES as unknown as [string, ...string[]]),
  provider: z.string().trim().min(1).max(120),
  metadata_hooks: metadataHooksSchema.optional(),
  provider_request: z.record(z.unknown()).optional(),
  writeback_target: z.enum(["media_asset", "video_asset"]).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const growthMediaGenerationJobListQuerySchema = z.object({
  status: z.enum(GROWTH_MEDIA_GENERATION_STATUSES as unknown as [string, ...string[]]).optional(),
  generation_type: z.enum(GROWTH_MEDIA_GENERATION_TYPES as unknown as [string, ...string[]]).optional(),
  video_page_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export const growthMediaGenerationJobPatchSchema = z
  .object({
    status: z.enum(GROWTH_MEDIA_GENERATION_STATUSES as unknown as [string, ...string[]]).optional(),
    progress_percent: z.number().int().min(0).max(100).optional(),
    error: z.record(z.unknown()).optional(),
    retry: z.boolean().optional(),
    retry_reason: z.string().trim().max(500).nullable().optional(),
    cancel: z.boolean().optional(),
    cancel_reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
