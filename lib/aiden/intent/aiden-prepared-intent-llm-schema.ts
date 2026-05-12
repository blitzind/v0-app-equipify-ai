import { z } from "zod"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const actionIdEnum = z.enum(AIDEN_PREPARED_WORKSPACE_ACTION_IDS)

const bulkInvoiceDateRangeSchema = z
  .object({
    rangeStartIso: z.string().max(40),
    rangeEndIso: z.string().max(40),
    label: z.string().max(120),
  })
  .strict()

/**
 * Strict JSON shape returned by the LLM and validated with Zod before any merge.
 * No record UUIDs in free-text fields — only registered `actionId` and human references.
 */
export const AidenPreparedWorkspaceIntentLlmSchema = z
  .object({
    actionId: actionIdEnum,
    confidence: z.number().min(0).max(1),
    customerReference: z.string().max(200).optional().nullable(),
    equipmentReference: z.string().max(200).optional().nullable(),
    workOrderReference: z
      .union([z.literal("latest"), z.literal("latest_completed"), z.string().max(64)])
      .optional()
      .nullable(),
    bulkInvoiceDateRange: bulkInvoiceDateRangeSchema.optional().nullable(),
    /** Optional copy suggestion for draft-style actions only — never executed without resolver + confirm. */
    suggestedDraftCopy: z.string().max(8000).optional().nullable(),
    /** Short question to ask the user when confidence is medium or fields are missing. */
    clarificationQuestion: z.string().max(500).optional().nullable(),
    /** Internal rationale — not shown to customers as fact. */
    rationale: z.string().max(1200).optional().nullable(),
  })
  .strict()

export type AidenPreparedWorkspaceIntentLlmOutput = z.infer<typeof AidenPreparedWorkspaceIntentLlmSchema>

export function stripUuidLikeStrings(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const t = value.trim()
  if (!t) return undefined
  if (UUID_RE.test(t)) return undefined
  return t
}

export function normalizeLlmIntentOutput(raw: unknown):
  | { ok: true; value: AidenPreparedWorkspaceIntentLlmOutput }
  | { ok: false; error: string } {
  const parsed = AidenPreparedWorkspaceIntentLlmSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message }
  }
  const v = parsed.data
  return {
    ok: true,
    value: {
      ...v,
      customerReference: stripUuidLikeStrings(v.customerReference ?? undefined) ?? null,
      equipmentReference: stripUuidLikeStrings(v.equipmentReference ?? undefined) ?? null,
      workOrderReference:
        typeof v.workOrderReference === "string" && UUID_RE.test(v.workOrderReference.trim()) ?
          null
        : v.workOrderReference,
    },
  }
}
