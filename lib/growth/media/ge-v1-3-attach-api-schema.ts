/** GE-v1-3 — Attach generated video API schema (client-safe). */

import { z } from "zod"

export const geV13AttachGeneratedVideoSchema = z.object({
  video_page_id: z.string().uuid(),
  media_asset_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  media_generation_run_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
})
