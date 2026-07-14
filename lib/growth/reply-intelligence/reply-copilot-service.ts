import type {
  GrowthReplyConfidenceTier,
  GrowthReplyCopilotAssist,
  GrowthReplyIntent,
  GrowthReplyUncertaintyState,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import { GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { extractBuyingSignals } from "@/lib/growth/reply-intelligence/buying-signal-extractor"
import { detectReplyObjections } from "@/lib/growth/reply-intelligence/objection-detection"
import { classifyReplyIntentV2 } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import {
  buildMemoryAwareSuggestedReplyDraft,
  type ReplyCopilotRelationshipMemory,
} from "@/lib/growth/reply-intelligence/reply-copilot-memory"
import { applyChannelParityConstitution } from "@/lib/growth/aios/growth/growth-channels-1a-parity"

export type { ReplyCopilotRelationshipMemory } from "@/lib/growth/reply-intelligence/reply-copilot-memory"
export { mapMemoryInfluenceToReplyCopilotRelationship } from "@/lib/growth/reply-intelligence/reply-copilot-memory"

function buildSummary(bodyPreview: string | null | undefined, intent: GrowthReplyIntent): string {
  const excerpt = bodyPreview?.trim().slice(0, 180) ?? "No reply body available."
  return `Prospect reply (${intent.replace(/_/g, " ")}): "${excerpt}"`
}

function buildSuggestedNextStep(intent: GrowthReplyIntent, recommendedOperatorAction: string): string {
  return `${recommendedOperatorAction} (human executes — no auto-send).`
}

function buildInternalNote(input: {
  intent: GrowthReplyIntent
  buyingSignals: string[]
  objections: string[]
  confidenceTier: GrowthReplyConfidenceTier
}): string {
  const parts = [`Intent: ${input.intent}`, `Confidence tier: ${input.confidenceTier}`]
  if (input.buyingSignals.length) parts.push(`Buying signals: ${input.buyingSignals.join(", ")}`)
  if (input.objections.length) parts.push(`Objections: ${input.objections.join(", ")}`)
  parts.push("AI-assisted summary — verify against reply evidence before acting.")
  return parts.join(" · ")
}

function buildCallPrepBullets(intent: GrowthReplyIntent, buyingSignals: string[], objections: string[]): string[] {
  const bullets = [`Confirm intent: ${intent.replace(/_/g, " ")}.`]
  if (buyingSignals.length) bullets.push(`Discuss signals: ${buyingSignals.slice(0, 3).join(", ")}.`)
  if (objections.length) bullets.push(`Address objections: ${objections.slice(0, 2).join(", ")}.`)
  bullets.push("Do not commit pricing or calendar without operator approval.")
  return bullets
}

export function buildReplyCopilotAssist(input: {
  bodyPreview: string | null | undefined
  companyName?: string | null
  contactLabel?: string | null
  relationshipMemory?: ReplyCopilotRelationshipMemory
}): GrowthReplyCopilotAssist {
  const classified = classifyReplyIntentV2(input.bodyPreview)
  const buying = extractBuyingSignals(input.bodyPreview)
  const objections = detectReplyObjections(input.bodyPreview)
  const evidenceExcerpts = [
    ...classified.matchedPhrases.map((m) => m.excerpt),
    ...buying.map((s) => s.excerpt),
    ...objections.map((o) => o.excerpt),
  ].filter(Boolean)

  const memoryContext = [
    input.relationshipMemory?.relationshipSummary,
    ...(input.relationshipMemory?.topObjections ?? []),
    ...(input.relationshipMemory?.topPreferences ?? []),
    ...(input.relationshipMemory?.commitmentSummaries ?? []),
  ].filter((entry): entry is string => Boolean(entry?.trim()))

  const rawSuggestedReplyDraft = buildMemoryAwareSuggestedReplyDraft({
    contactLabel: input.contactLabel,
    intent: classified.intent,
    bodyObjectionDraft: objections[0]?.suggestedReplyDraft,
    relationshipMemory: input.relationshipMemory,
  })
  const suggestedReplyDraft = applyChannelParityConstitution(
    rawSuggestedReplyDraft,
    input.companyName?.trim() || "Prospect",
  ).body

  const mergedObjectionLabels = [
    ...objections.map((o) => o.category),
    ...(input.relationshipMemory?.topObjections ?? []).map((entry) => entry.split(":")[0]?.trim() ?? entry),
  ].filter(Boolean)

  const uncertaintyState: GrowthReplyUncertaintyState = classified.uncertaintyState
  const confidenceTier: GrowthReplyConfidenceTier = classified.confidenceTier

  return {
    qaMarker: GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
    assistedLabel: "AI-assisted",
    summary: buildSummary(input.bodyPreview, classified.intent),
    intent: classified.intent,
    objections: objections.map((o) => o.category),
    suggestedNextStep: buildSuggestedNextStep(classified.intent, classified.recommendedOperatorAction),
    suggestedReplyDraft,
    suggestedInternalNote: buildInternalNote({
      intent: classified.intent,
      buyingSignals: buying.map((s) => s.signal),
      objections: mergedObjectionLabels,
      confidenceTier,
    }),
    callPrepBullets: buildCallPrepBullets(classified.intent, buying.map((s) => s.signal), mergedObjectionLabels),
    confidenceTier,
    uncertaintyState,
    evidenceExcerpts: evidenceExcerpts.slice(0, 8),
    memoryContext: memoryContext.length ? memoryContext.slice(0, 6) : undefined,
    memoryAvoidRepeating: input.relationshipMemory?.avoidRepeating?.slice(0, 5),
  }
}
