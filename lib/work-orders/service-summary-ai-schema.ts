import { z } from "zod"

/** Structured output for `work_order_summary` when generating service summary drafts. */
export const WorkOrderServiceSummaryAiSchema = z.object({
  summary: z.string().max(8000),
  highlights: z.array(z.string().max(500)).max(12).optional(),
})

export type WorkOrderServiceSummaryAi = z.infer<typeof WorkOrderServiceSummaryAiSchema>

export function formatWorkOrderServiceSummaryDraft(answer: WorkOrderServiceSummaryAi): string {
  const head = answer.summary.trim()
  const hs = answer.highlights?.map((h) => h.trim()).filter(Boolean) ?? []
  if (!hs.length) return head
  return [head, "", "Key points:", ...hs.map((h) => `• ${h}`)].join("\n").trim()
}
