/** Growth Engine C1 — AI voice generation API schemas (client-safe). */

import { z } from "zod"

export const growthAiVoiceGenerateSchema = z.object({
  video_page_id: z.string().uuid(),
  script_version_id: z.string().uuid().nullable().optional(),
  voice_id: z.string().trim().min(1).max(120),
  provider: z.string().trim().max(120).optional(),
  settings: z
    .object({
      stability: z.number().min(0).max(1).optional(),
      similarity: z.number().min(0).max(1).optional(),
      speed: z.number().min(0.5).max(2).optional(),
    })
    .optional(),
  dry_run: z.boolean().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  company_candidate_id: z.string().uuid().nullable().optional(),
  person_candidate_id: z.string().uuid().nullable().optional(),
  personalization_profile_id: z.string().uuid().nullable().optional(),
  sender_profile_id: z.string().uuid().nullable().optional(),
  operator_instructions: z.string().trim().max(4000).nullable().optional(),
})

export const growthAiVoiceJobActionSchema = z
  .object({
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
