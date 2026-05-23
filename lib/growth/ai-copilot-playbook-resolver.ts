import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { detectPlaybookApprovedConflicts } from "@/lib/growth/ai-copilot-playbook-conflicts"
import {
  listActiveGrowthAiCopilotPlaybookApprovedRules,
  listGrowthAiCopilotPlaybookSourcesByIds,
} from "@/lib/growth/ai-copilot-playbook-repository"
import type {
  GrowthAiCopilotPlaybookIndustryScope,
  GrowthAiCopilotPlaybookResolvedRule,
} from "@/lib/growth/ai-copilot-playbook-types"

function industryMatches(
  scope: GrowthAiCopilotPlaybookIndustryScope,
  leadIndustryTags: string[],
): boolean {
  if (scope.appliesGlobally !== false) return true
  const industries = scope.industries ?? []
  const tags = scope.tags ?? []
  if (industries.length === 0 && tags.length === 0) return true
  const haystack = new Set(leadIndustryTags.map((tag) => tag.toLowerCase()))
  return [...industries, ...tags].some((tag) => haystack.has(tag.toLowerCase()))
}

export async function resolveGrowthAiCopilotPlaybookRules(
  admin: SupabaseClient,
  input: {
    generationType: GrowthAiCopilotGenerationType
    maxRules: number
    leadIndustryTags?: string[]
  },
): Promise<{
  rules: GrowthAiCopilotPlaybookResolvedRule[]
  conflicts: ReturnType<typeof detectPlaybookApprovedConflicts>
}> {
  const active = await listActiveGrowthAiCopilotPlaybookApprovedRules(admin)
  const leadTags = input.leadIndustryTags ?? []

  const filtered = active
    .filter((rule) => rule.appliesTo.length === 0 || rule.appliesTo.includes(input.generationType))
    .filter((rule) => industryMatches(rule.industryScope, leadTags))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, input.maxRules))

  const sourceIds = [...new Set(filtered.map((rule) => rule.sourceId).filter(Boolean))] as string[]
  const sources = await listGrowthAiCopilotPlaybookSourcesByIds(admin, sourceIds)
  const sourceTitleById = new Map(sources.map((source) => [source.id, source.title]))

  const rules: GrowthAiCopilotPlaybookResolvedRule[] = filtered.map((rule) => ({
    ...rule,
    sourceTitle: rule.sourceId ? (sourceTitleById.get(rule.sourceId) ?? null) : null,
  }))

  const conflicts = detectPlaybookApprovedConflicts(filtered)
  return { rules, conflicts }
}
