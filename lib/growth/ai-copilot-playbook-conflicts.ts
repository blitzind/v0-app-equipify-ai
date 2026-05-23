import type {
  GrowthAiCopilotPlaybookApprovedRule,
  GrowthAiCopilotPlaybookConflict,
  GrowthAiCopilotPlaybookDraftRule,
} from "@/lib/growth/ai-copilot-playbook-types"

const OPPOSITE_PAIRS: Array<[RegExp, RegExp, string]> = [
  [/\bconcise\b|\bbrief\b|\bshort\b/i, /\blong[- ]form\b|\bdetailed\b|\bverbose\b/i, "Length guidance conflicts"],
  [/\bcasual\b|\bconversational\b/i, /\bformal\b|\bprofessional\b|\bexecutive\b/i, "Tone formality conflicts"],
  [/\burgent\b|\bpressure\b|\bscarcity\b/i, /\bpatient\b|\bno pressure\b|\blow pressure\b/i, "Urgency conflicts"],
  [/\bavoid\b|\bnever\b|\bdo not\b/i, /\balways\b|\bmust include\b|\brequire\b/i, "Mandatory vs avoid conflicts"],
]

function ruleKeyForDraft(rule: Pick<GrowthAiCopilotDraftRule, "title" | "category">, index: number): string {
  return `${rule.category}:${rule.title.toLowerCase().slice(0, 40)}:${index}`
}

function ruleKeyForApproved(rule: Pick<GrowthAiCopilotPlaybookApprovedRule, "ruleKey">): string {
  return rule.ruleKey
}

function detectPairConflict(
  a: { key: string; category: string; text: string },
  b: { key: string; category: string; text: string },
): GrowthAiCopilotPlaybookConflict | null {
  if (a.key === b.key) return null
  if (a.category !== b.category && a.category !== "tone" && b.category !== "tone") return null

  for (const [left, right, reason] of OPPOSITE_PAIRS) {
    const aLeft = left.test(a.text)
    const aRight = right.test(a.text)
    const bLeft = left.test(b.text)
    const bRight = right.test(b.text)
    if ((aLeft && bRight) || (aRight && bLeft)) {
      return {
        key: `${a.key}__${b.key}`,
        ruleKeyA: a.key,
        ruleKeyB: b.key,
        category: a.category,
        reason,
        severity: a.category === "tone" || b.category === "tone" ? "critical" : "warning",
      }
    }
  }

  if (a.category === "words_to_avoid" && b.category === "email_style") {
    const avoidMatch = a.text.match(/(?:avoid|never|don't)\s+["']?([^"'.]+)["']?/i)
    if (avoidMatch && b.text.toLowerCase().includes(avoidMatch[1].trim().toLowerCase())) {
      return {
        key: `${a.key}__${b.key}`,
        ruleKeyA: a.key,
        ruleKeyB: b.key,
        category: "words_to_avoid",
        reason: "Style guidance references a phrase marked as words to avoid",
        severity: "critical",
      }
    }
  }

  return null
}

export function detectPlaybookDraftConflicts(
  rules: GrowthAiCopilotPlaybookDraftRule[],
): GrowthAiCopilotPlaybookConflict[] {
  const indexed = rules.map((rule, index) => ({
    key: ruleKeyForDraft(rule, index),
    category: rule.category,
    text: `${rule.title}. ${rule.principle}`,
  }))

  const conflicts: GrowthAiCopilotPlaybookConflict[] = []
  for (let i = 0; i < indexed.length; i++) {
    for (let j = i + 1; j < indexed.length; j++) {
      const conflict = detectPairConflict(indexed[i], indexed[j])
      if (conflict && !conflicts.some((entry) => entry.key === conflict.key)) {
        conflicts.push(conflict)
      }
    }
  }
  return conflicts
}

export function detectPlaybookApprovedConflicts(
  rules: GrowthAiCopilotPlaybookApprovedRule[],
): GrowthAiCopilotPlaybookConflict[] {
  const indexed = rules.map((rule) => ({
    key: ruleKeyForApproved(rule),
    category: rule.category,
    text: `${rule.title}. ${rule.principle}`,
  }))

  const conflicts: GrowthAiCopilotPlaybookConflict[] = []
  for (let i = 0; i < indexed.length; i++) {
    for (let j = i + 1; j < indexed.length; j++) {
      const conflict = detectPairConflict(indexed[i], indexed[j])
      if (conflict && !conflicts.some((entry) => entry.key === conflict.key)) {
        conflicts.push(conflict)
      }
    }
  }
  return conflicts
}
