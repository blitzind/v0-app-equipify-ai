import type {
  GrowthAiCopilotPlaybookAttribution,
  GrowthAiCopilotPlaybookResolvedRule,
} from "@/lib/growth/ai-copilot-playbook-types"

export function computePlaybookInfluenceScore(rules: GrowthAiCopilotPlaybookResolvedRule[]): number {
  if (rules.length === 0) return 0
  const raw = rules.reduce((sum, rule) => sum + Math.max(0, Math.min(100, rule.priority)), 0)
  const normalized = Math.round(Math.min(100, (raw / Math.max(rules.length * 50, 1)) * 100))
  return Math.max(0, Math.min(100, normalized))
}

export function buildPlaybookAttribution(input: {
  rules: GrowthAiCopilotPlaybookResolvedRule[]
  conflicts: GrowthAiCopilotPlaybookAttribution["conflicts"]
}): GrowthAiCopilotPlaybookAttribution {
  const sourceTitles = new Map<string, string>()
  const trainerProfiles = new Map<string, string>()

  for (const rule of input.rules) {
    if (rule.sourceId && rule.sourceTitle) sourceTitles.set(rule.sourceId, rule.sourceTitle)
    const trainer = rule.trainerProfile
    if (trainer?.name) trainerProfiles.set(trainer.name, JSON.stringify(trainer))
  }

  return {
    ruleIds: input.rules.map((rule) => rule.id),
    sourceIds: [...new Set(input.rules.map((rule) => rule.sourceId).filter(Boolean))] as string[],
    categories: [...new Set(input.rules.map((rule) => rule.category))],
    ruleTitles: input.rules.map((rule) => rule.title),
    sourceTitles: [...sourceTitles.values()],
    trainerProfiles: [...trainerProfiles.values()].map((value) => JSON.parse(value)),
    conflicts: input.conflicts,
  }
}
