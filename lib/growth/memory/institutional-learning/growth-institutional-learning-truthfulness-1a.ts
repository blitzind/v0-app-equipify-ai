/** GE-AIOS-INSTITUTIONAL-LEARNING-TRUTHFULNESS-1A — Validated institutional learning projection (client-safe). */

import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"

export const GROWTH_INSTITUTIONAL_LEARNING_TRUTHFULNESS_1A_QA_MARKER =
  "ge-aios-institutional-learning-truthfulness-1a-v1" as const

export const GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE =
  "No validated organizational learnings yet." as const

export const GROWTH_INSTITUTIONAL_LEARNING_VALIDATED_LABEL = "Validated learnings" as const

/** Demo / fixture strings that must never appear as operator learnings. */
export const GROWTH_INSTITUTIONAL_LEARNING_FORBIDDEN_DEMO_STRINGS = [
  "We target hospitals before private clinics.",
  "Research consistently precedes successful outreach.",
  "Mike prefers shorter outreach.",
  "Don't recommend companies under 10 employees.",
  "Medical equipment companies convert better than HVAC.",
  "Companies with 20–100 employees respond more often.",
  "Outreach approved within one day performs better.",
  "Most qualified companies use disconnected software.",
] as const

export function isValidatedInstitutionalLearningItem(
  item: OrganizationalKnowledgeItem,
): boolean {
  if (!item.active || item.superseded_by) return false
  if (!item.finding.trim()) return false
  if (item.supporting_event_count < 1) return false
  return !GROWTH_INSTITUTIONAL_LEARNING_FORBIDDEN_DEMO_STRINGS.some((demo) =>
    item.finding.includes(demo.replace(/\.$/, "")),
  )
}

export function filterValidatedInstitutionalLearnings(
  items: OrganizationalKnowledgeItem[] | null | undefined,
): OrganizationalKnowledgeItem[] {
  return (items ?? [])
    .filter(isValidatedInstitutionalLearningItem)
    .sort((left, right) => right.confidence - left.confidence)
}

export function buildValidatedInstitutionalLearningBullets(
  items: OrganizationalKnowledgeItem[] | null | undefined,
  limit = 3,
): string[] {
  return filterValidatedInstitutionalLearnings(items)
    .slice(0, limit)
    .map((row) => row.finding.replace(/\.$/, "") + ".")
}

export function containsForbiddenDemoInstitutionalLearning(text: string): boolean {
  const normalized = text.trim()
  return GROWTH_INSTITUTIONAL_LEARNING_FORBIDDEN_DEMO_STRINGS.some(
    (demo) => normalized === demo || normalized.includes(demo.replace(/\.$/, "")),
  )
}
