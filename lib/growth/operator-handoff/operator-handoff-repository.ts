import type { RevenueQueueRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthOperatorHandoffInput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  GROWTH_OPERATOR_HANDOFF_QA_MARKER,
  type GrowthOperatorHandoffOutput,
  type GrowthOperatorHandoffPackage,
} from "@/lib/growth/operator-handoff/operator-handoff-types"

export const GROWTH_OPERATOR_HANDOFF_METADATA_KEY = "operator_handoff" as const

function isHandoffPackage(value: unknown): value is GrowthOperatorHandoffPackage {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  if (row.qa_marker !== GROWTH_OPERATOR_HANDOFF_QA_MARKER) return false
  if (!row.handoff || typeof row.handoff !== "object") return false
  return typeof row.generated_at === "string"
}

export function buildOperatorHandoffPackage(
  input: GrowthOperatorHandoffInput,
  handoff: GrowthOperatorHandoffOutput,
  generatedAt: string = new Date().toISOString(),
): GrowthOperatorHandoffPackage {
  return {
    qa_marker: GROWTH_OPERATOR_HANDOFF_QA_MARKER,
    growth_lead_id: input.leadInbox?.metadata?.growth_lead_id ?? input.leadInbox?.id ?? null,
    generated_at: generatedAt,
    handoff,
  }
}

/** Read operator handoff from pseudo inbox row / growth.leads metadata (GE-LEADS-CANONICAL-4E). */
export function loadOperatorHandoffFromRevenueQueue(
  row: RevenueQueueRow,
): GrowthOperatorHandoffPackage | null {
  const stored = row.metadata[GROWTH_OPERATOR_HANDOFF_METADATA_KEY]
  if (!isHandoffPackage(stored)) return null
  return stored
}

/** @deprecated Use loadOperatorHandoffFromRevenueQueue (GE-LEADS-CANONICAL-4G). */
export const loadOperatorHandoffFromRevenueQueueRow = loadOperatorHandoffFromRevenueQueue

/** @deprecated Use loadOperatorHandoffFromRevenueQueue (GE-LEADS-CANONICAL-4G). */
export const loadOperatorHandoffFromLeadInbox = loadOperatorHandoffFromRevenueQueue
