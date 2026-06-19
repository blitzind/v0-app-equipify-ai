/** Growth Engine C2 — AI avatar generation API schemas (client-safe). */

import { z } from "zod"
import { GROWTH_AI_AVATAR_PROVIDERS } from "@/lib/growth/media/growth-ai-avatar-generation-types"

export const growthAiAvatarGenerateSchema = z.object({
  video_page_id: z.string().uuid(),
  script_version_id: z.string().uuid().nullable().optional(),
  avatar_id: z.string().trim().min(1).max(120),
  provider: z.enum(GROWTH_AI_AVATAR_PROVIDERS).optional(),
  voice_media_asset_id: z.string().uuid().nullable().optional(),
  settings: z
    .object({
      resolution: z.string().trim().max(40).optional(),
      background: z.string().trim().max(80).optional(),
      theme: z.string().trim().max(80).optional(),
    })
    .optional(),
  dry_run: z.boolean().optional(),
})

export const growthAiAvatarJobActionSchema = z
  .object({
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
