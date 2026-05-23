import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import type {
  GrowthAiCopilotPlaybookResolvedRule,
  GrowthAiCopilotPlaybookSource,
} from "@/lib/growth/ai-copilot-playbook-types"

export function buildGrowthAiCopilotPlaybookExtractionSystemPrompt(): string {
  return [
    "You are Equipify Growth Engine AI Copilot Playbook Trainer.",
    "Extract concise operating principles — not verbatim transcripts.",
    "Each rule must be actionable guidance for outbound email or call copy.",
    "Do not invent facts not supported by the source material.",
    "Return JSON with keys: rules (array), summary (optional string).",
    "Each rule: category, title, principle, appliesTo (generation types), priority (0-100), optional industryScope, optional trainerProfile.",
  ].join("\n")
}

export function buildGrowthAiCopilotPlaybookExtractionUserPrompt(input: {
  source: Pick<GrowthAiCopilotPlaybookSource, "title" | "sourceKind" | "sourceUrl" | "trainerProfile" | "industryScope">
  content: string
}): string {
  return JSON.stringify(
    {
      source: {
        title: input.source.title,
        sourceKind: input.source.sourceKind,
        sourceUrl: input.source.sourceUrl,
        trainerProfile: input.source.trainerProfile,
        industryScope: input.source.industryScope,
      },
      content: input.content.slice(0, 120_000),
    },
    null,
    2,
  )
}

export function formatPlaybookRulesForCopilotPrompt(
  rules: GrowthAiCopilotPlaybookResolvedRule[],
  generationType: GrowthAiCopilotGenerationType,
): string {
  const applicable = rules.filter(
    (rule) => rule.appliesTo.length === 0 || rule.appliesTo.includes(generationType),
  )
  if (applicable.length === 0) return ""

  const lines = applicable.map((rule, index) => {
    const trainer = rule.trainerProfile?.name ? ` (trainer: ${rule.trainerProfile.name})` : ""
    return `${index + 1}. [${rule.category}] ${rule.title}${trainer}: ${rule.principle}`
  })

  return [
    "Approved playbook operating rules (human-reviewed — follow unless they conflict with governance or facts):",
    ...lines,
  ].join("\n")
}
