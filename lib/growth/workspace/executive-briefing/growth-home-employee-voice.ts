/** GE-AI-UX-4A — First-person timeline and journal voice (client-safe). */

import { translateOperatorActivityHeadline } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-event-translator"
import { employeeFirstPerson } from "@/lib/workspace/ai-employee-experience"
import { sanitizeHomeNarrative } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"

const FIRST_PERSON_OVERRIDES: Record<string, string> = {
  "AI prepared a communication strategy.": "I prepared a communication strategy.",
  "Revenue Director reviewed the current pipeline.": "I reviewed the pipeline and prioritized next moves.",
  "AI ranked the next best actions.": "I ranked the next best actions for today.",
  "AI reprioritized active objectives.": "I reprioritized active objectives.",
  "Approval queue updated.": "I prepared items that need your review.",
  "Research completed.": "I completed research on a prospect.",
  "Qualification score updated.": "I qualified new opportunities.",
  "Outreach draft created.": "I finished preparing outreach.",
  "Waiting for your approval.": "I'm waiting for your approval.",
  "Meeting brief prepared.": "I prepared a meeting brief.",
  "AI learned from recent outcomes.": "I learned from recent outcomes.",
}

export function translateHomeTimelineFirstPerson(title: string, summary?: string | null): string {
  const translated = translateOperatorActivityHeadline({ title, summary: summary ?? "" }).headline
  const sanitized = sanitizeHomeNarrative(translated)

  if (FIRST_PERSON_OVERRIDES[sanitized]) {
    return FIRST_PERSON_OVERRIDES[sanitized]
  }

  if (/research.*completed/i.test(title)) {
    const match = title.match(/for\s+(.+)/i)
    return match ? `I completed research for ${match[1]?.trim()}.` : "I completed research on a prospect."
  }
  if (/qualification/i.test(title)) {
    return "I qualified new opportunities."
  }
  if (/communication.*plan/i.test(title)) {
    return "I prepared a communication strategy."
  }
  if (/campaign.*prepar/i.test(title) || /outreach.*draft/i.test(title)) {
    return "I finished preparing a campaign."
  }
  if (/meeting/i.test(title)) {
    return "I prepared or confirmed a meeting."
  }
  if (/approval/i.test(title)) {
    return "I prepared something that needs your review."
  }

  if (sanitized.toLowerCase().startsWith("i ")) return sanitized
  return employeeFirstPerson(sanitized.replace(/\.$/, ""))
}
