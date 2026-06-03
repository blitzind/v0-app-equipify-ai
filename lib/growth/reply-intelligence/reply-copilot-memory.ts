/** Client-safe memory → reply copilot / draft helpers (Sprint 3 verification fixes). */

import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"

export type ReplyCopilotRelationshipMemory = {
  relationshipSummary: string | null
  topObjections: string[]
  topPreferences: string[]
  avoidRepeating: string[]
  commitmentSummaries: string[]
}

export function mapMemoryInfluenceToReplyCopilotRelationship(
  memory: GrowthLeadMemoryInfluenceContext | null | undefined,
): ReplyCopilotRelationshipMemory | undefined {
  if (!memory?.available) return undefined
  return {
    relationshipSummary: memory.relationshipSummary,
    topObjections: memory.topObjections,
    topPreferences: memory.topPreferences,
    avoidRepeating: memory.avoidRepeating,
    commitmentSummaries: memory.commitmentSummaries,
  }
}

function contactGreeting(contactLabel: string | null | undefined): string {
  return contactLabel?.trim() ? `, ${contactLabel.trim()}` : ""
}

function memoryObjectionLabel(objection: string): string {
  const label = objection.split(":")[0]?.trim() ?? objection
  return label.slice(0, 80)
}

function buildDraftForMemoryObjection(objection: string, contactLabel: string | null | undefined): string {
  const label = memoryObjectionLabel(objection)
  const lower = `${label} ${objection}`.toLowerCase()
  const hi = contactLabel?.trim() ? `Hi ${contactLabel.trim()}` : "Hi"

  if (/\b(budget|price|cost|expensive|afford)\b/.test(lower)) {
    return `${hi},\n\nThanks for your reply — I remember budget was a concern earlier. Happy to share options that fit your scope without repeating what you've already covered.\n\nBest regards`
  }
  if (/\b(timing|timeline|quarter|deadline|later|not now)\b/.test(lower)) {
    return `${hi},\n\nThanks for your reply — I'll respect the timing you shared previously and follow up when it makes sense on your side.\n\nBest regards`
  }
  if (/\b(competitor|vendor|incumbent|existing tool)\b/.test(lower)) {
    return `${hi},\n\nThanks for your reply — I'll focus on where we differ from what you're using today rather than rehashing prior points.\n\nBest regards`
  }

  return `${hi},\n\nThanks for your reply — I want to address your earlier concern (${label}) thoughtfully in my follow-up.\n\nBest regards`
}

export function applyAvoidRepeatingToReplyDraft(draft: string, avoidRepeating: string[] | undefined): string {
  if (!avoidRepeating?.length) return draft

  let result = draft.trim()
  const avoidHaystack = avoidRepeating.join(" ").toLowerCase()

  if (result.includes("?")) {
    const questionPatterns = [
      /\bwhat\b.*\?/gi,
      /\bwhen\b.*\?/gi,
      /\bhow\b.*\?/gi,
      /\bcould you\b.*\?/gi,
      /\bcan you\b.*\?/gi,
      /\bwould you\b.*\?/gi,
    ]
    for (const pattern of questionPatterns) {
      if (pattern.test(result) && avoidHaystack.length > 0) {
        result = result.replace(pattern, "").replace(/\s{2,}/g, " ").trim()
      }
    }
  }

  if (!/\balready shared\b/i.test(result) && !/\bearlier\b/i.test(result)) {
    result = `${result.replace(/\s+$/, "")} I'll avoid re-asking details you've already shared.`
  }

  return result
}

export function buildMemoryAwareSuggestedReplyDraft(input: {
  contactLabel?: string | null
  intent: GrowthReplyIntent
  bodyObjectionDraft: string | null | undefined
  relationshipMemory?: ReplyCopilotRelationshipMemory
}): string {
  const contact = contactGreeting(input.contactLabel)
  const memory = input.relationshipMemory

  if (input.bodyObjectionDraft?.trim()) {
    return applyAvoidRepeatingToReplyDraft(input.bodyObjectionDraft.trim(), memory?.avoidRepeating)
  }

  const memoryObjection = memory?.topObjections[0]
  if (memoryObjection?.trim()) {
    return applyAvoidRepeatingToReplyDraft(
      buildDraftForMemoryObjection(memoryObjection, input.contactLabel),
      memory?.avoidRepeating,
    )
  }

  if (input.intent === "positive_interest") {
    return applyAvoidRepeatingToReplyDraft(
      `Thanks for your interest${contact} — happy to share next steps when you're ready.`,
      memory?.avoidRepeating,
    )
  }

  const preference = memory?.topPreferences[0]
  if (preference?.trim()) {
    return applyAvoidRepeatingToReplyDraft(
      `Thanks for your reply — I'll keep your preference in mind (${preference.slice(0, 80)}).`,
      memory?.avoidRepeating,
    )
  }

  const commitment = memory?.commitmentSummaries[0]
  if (commitment?.trim()) {
    return applyAvoidRepeatingToReplyDraft(
      `Thanks for your reply${contact} — I'll follow up on our prior commitment shortly.`,
      memory?.avoidRepeating,
    )
  }

  if (memory?.relationshipSummary?.trim()) {
    return applyAvoidRepeatingToReplyDraft(
      `Thanks for your reply${contact} — picking up from our earlier conversation.`,
      memory?.avoidRepeating,
    )
  }

  return applyAvoidRepeatingToReplyDraft(
    "Thanks for your reply — I'll follow up with details shortly.",
    memory?.avoidRepeating,
  )
}

export function formatRelationshipMemoryForReplyPrompt(
  memory: GrowthReplyDraftRelationshipMemory | undefined,
): string[] {
  if (!memory?.available) return []
  const lines: string[] = ["Relationship memory (honor avoidRepeatingTopics — do not re-ask answered questions):"]
  if (memory.relationshipSummary?.trim()) lines.push(`Summary: ${memory.relationshipSummary.trim()}`)
  if (memory.relationshipStage) lines.push(`Stage: ${memory.relationshipStage}`)
  for (const objection of memory.topObjections.slice(0, 3)) lines.push(`Known objection: ${objection}`)
  for (const preference of memory.topPreferences.slice(0, 3)) lines.push(`Known preference: ${preference}`)
  for (const commitment of memory.commitments.slice(0, 2)) lines.push(`Prior commitment: ${commitment}`)
  for (const topic of memory.avoidRepeatingTopics.slice(0, 5)) lines.push(`Do not repeat: ${topic}`)
  return lines
}

export type GrowthReplyDraftRelationshipMemory = {
  available: boolean
  relationshipStage: string | null
  relationshipSummary: string | null
  topObjections: string[]
  topPreferences: string[]
  priorInteractions: string[]
  commitments: string[]
  avoidRepeatingTopics: string[]
}
