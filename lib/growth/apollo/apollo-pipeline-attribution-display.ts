/** Apollo pipeline attribution display helpers — client-safe. */

export const APOLLO_PIPELINE_ATTRIBUTION_DISPLAY_QA_MARKER =
  "apollo-pipeline-attribution-display-v1" as const

export type ApolloPipelineAttributionDisplay = {
  attribution_chain: string[]
  approver_email: string | null
  approver_user_id: string | null
  approved_at: string | null
  rejection_note: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function readApolloAttributionChain(
  source: Record<string, unknown> | null | undefined,
): string[] {
  if (!source) return []
  if (!Array.isArray(source.attribution_chain)) return []
  return (source.attribution_chain as unknown[])
    .map((entry) => asString(entry))
    .filter(Boolean)
}

export function buildApolloPipelineAttributionDisplay(input: {
  source_attribution?: Record<string, unknown> | null
  approved_at?: string | null
  approved_email?: string | null
  approved_by?: string | null
  rejection_note?: string | null
}): ApolloPipelineAttributionDisplay {
  return {
    attribution_chain: readApolloAttributionChain(input.source_attribution ?? null),
    approver_email: input.approved_email ?? null,
    approver_user_id: input.approved_by ?? null,
    approved_at: input.approved_at ?? null,
    rejection_note: input.rejection_note ?? null,
  }
}

export function formatApolloAttributionChain(chain: string[]): string {
  if (!chain.length) return "Attribution chain unavailable"
  return chain.join(" → ")
}
