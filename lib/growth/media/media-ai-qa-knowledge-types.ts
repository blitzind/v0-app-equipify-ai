/** Growth Engine S2-I — AI Q&A knowledge source reference types (metadata only, no retrieval). Client-safe. */

export const GROWTH_MEDIA_AI_QA_KNOWLEDGE_QA_MARKER = "growth-media-ai-qa-knowledge-s2i-v1" as const

export const GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES = [
  "share_page_template",
  "share_page",
  "media_asset",
  "campaign",
  "lead",
  "company_research",
  "buying_committee",
  "product_faq",
  "manual_context",
] as const

export type GrowthMediaAiQaKnowledgeSourceType = (typeof GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES)[number]

export type GrowthMediaAiQaKnowledgeSourceRef = {
  sourceType: GrowthMediaAiQaKnowledgeSourceType
  sourceId?: string | null
  label?: string | null
  enabled?: boolean
}

export function validateKnowledgeSourceRef(ref: GrowthMediaAiQaKnowledgeSourceRef | null | undefined): boolean {
  if (!ref?.sourceType) return false
  if (!GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES.includes(ref.sourceType)) return false
  if (ref.enabled === false) return false
  return true
}

export function validateKnowledgeSourceRefs(
  refs: GrowthMediaAiQaKnowledgeSourceRef[] | null | undefined,
): boolean {
  if (!refs || refs.length === 0) return true
  return refs.every((ref) => validateKnowledgeSourceRef(ref))
}

export function normalizeKnowledgeSourceRefs(
  refs: GrowthMediaAiQaKnowledgeSourceRef[] | null | undefined,
): GrowthMediaAiQaKnowledgeSourceRef[] {
  if (!refs) return []
  return refs
    .filter((ref) => ref.sourceType && GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES.includes(ref.sourceType))
    .map((ref) => ({
      sourceType: ref.sourceType,
      sourceId: ref.sourceId ?? null,
      label: ref.label ?? null,
      enabled: ref.enabled !== false,
    }))
}
