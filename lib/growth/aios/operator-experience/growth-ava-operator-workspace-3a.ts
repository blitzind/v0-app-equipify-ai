/**
 * AVA-OPERATOR-WORKSPACE-3A — Operator-facing Ava workspace presentation (client-safe).
 * Transforms engineering copilot metadata into advisor-style review copy.
 */

import type { GrowthAiCopilotGeneration, GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER =
  "ava-operator-workspace-3a-v1" as const

const ENGINEERING_LABEL_PATTERN =
  /^(ava_direct|canonical_send|default|draft|approved|discarded|pursue|hold|reject|ava_direct_production_cutover_1a|ge-aios|qa_marker)/i

export type GrowthAvaOperatorRecommendationView = {
  contactName: string | null
  contactTitle: string | null
  contactEmail: string | null
  companyName: string
  rationale: string | null
  confidenceLabel: string
  whatStoodOut: string | null
}

function classificationRecord(generation: GrowthAiCopilotGeneration): Record<string, unknown> {
  const raw = generation.classification
  if (raw && typeof raw === "object") return raw as Record<string, unknown>
  return {}
}

export function isEngineeringOperatorLabel(label: string | null | undefined): boolean {
  const normalized = label?.trim()
  if (!normalized) return true
  if (ENGINEERING_LABEL_PATTERN.test(normalized)) return true
  if (/^v\d|qa_marker|cutover|send_plane|prompt_/i.test(normalized)) return true
  return false
}

export function formatOperatorGenerationTypeLabel(type: GrowthAiCopilotGenerationType): string {
  switch (type) {
    case "cold_email":
      return "Recommended Email"
    case "follow_up_email":
      return "Follow-up Email"
    case "reengagement_email":
      return "Re-engagement Email"
    case "executive_email":
      return "Executive Email"
    case "breakup_email":
      return "Closing Email"
    case "response_draft":
      return "Reply Draft"
    case "call_opening":
      return "Call Opening"
    case "call_objection_response":
      return "Objection Response"
    case "call_risk_brief":
      return "Call Brief"
    case "call_summary":
      return "Call Summary"
    case "meeting_prep":
      return "Meeting Prep"
    case "next_message":
      return "Next Message"
    default:
      return "Prepared Message"
  }
}

export function formatOperatorGenerationStatusLabel(
  status: GrowthAiCopilotGeneration["status"],
): string {
  switch (status) {
    case "draft":
      return "Ready for your review"
    case "approved":
      return "Approved"
    case "discarded":
      return "Declined"
    case "expired":
      return "Expired"
    default:
      return "Prepared"
  }
}

export function resolveOperatorConfidenceLabel(generation: GrowthAiCopilotGeneration): string {
  const classification = classificationRecord(generation)
  const primary = typeof classification.primary === "string" ? classification.primary.trim().toLowerCase() : ""
  if (primary === "pursue") return "Recommended"
  if (primary === "hold") return "Needs more information"
  if (primary === "reject") return "Not recommended"
  if (typeof classification.confidence === "number" && classification.confidence >= 0.75) {
    return "Recommended"
  }
  if (generation.status === "approved") return "Approved"
  return "Ready for review"
}

function recommendedContactFromGeneration(generation: GrowthAiCopilotGeneration): {
  name: string | null
  title: string | null
  email: string | null
} {
  const classification = classificationRecord(generation)
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const row = recommended as { name?: string; title?: string; email?: string }
    return {
      name: row.name?.trim() || null,
      title: row.title?.trim() || null,
      email: row.email?.trim() || null,
    }
  }

  const snapshot = generation.inputSnapshot ?? {}
  const contacts = Array.isArray(snapshot.contactsSupplied) ? snapshot.contactsSupplied : []
  for (const entry of contacts) {
    if (!entry || typeof entry !== "object") continue
    const contact = entry as { name?: string; title?: string; email?: string; contactabilityStatus?: string }
    if (contact.contactabilityStatus === "contactable" && contact.email?.trim()) {
      return {
        name: contact.name?.trim() || null,
        title: contact.title?.trim() || null,
        email: contact.email.trim(),
      }
    }
  }

  const decisionMakers = Array.isArray(snapshot.decisionMakers) ? snapshot.decisionMakers : []
  for (const entry of decisionMakers) {
    if (!entry || typeof entry !== "object") continue
    const dm = entry as { name?: string; title?: string; email?: string }
    if (dm.email?.trim() || dm.name?.trim()) {
      return {
        name: dm.name?.trim() || null,
        title: dm.title?.trim() || null,
        email: dm.email?.trim() || null,
      }
    }
  }

  if (typeof snapshot.contactName === "string" || typeof snapshot.contactEmail === "string") {
    return {
      name: typeof snapshot.contactName === "string" ? snapshot.contactName.trim() || null : null,
      title: null,
      email: typeof snapshot.contactEmail === "string" ? snapshot.contactEmail.trim() || null : null,
    }
  }

  return { name: null, title: null, email: null }
}

function rationaleFromGeneration(generation: GrowthAiCopilotGeneration): string | null {
  const classification = classificationRecord(generation)
  if (typeof classification.rationale === "string" && classification.rationale.trim()) {
    return classification.rationale.trim()
  }

  const snapshot = generation.inputSnapshot ?? {}
  if (typeof snapshot.nextBestActionReason === "string" && snapshot.nextBestActionReason.trim()) {
    return snapshot.nextBestActionReason.trim()
  }

  const personalization = generation.classification.personalization
  const contextPacket = personalization?.contextPacket
  if (contextPacket?.researchRecommendedNextAction?.trim()) {
    return contextPacket.researchRecommendedNextAction.trim()
  }
  if (contextPacket?.websiteSummary?.trim()) {
    return contextPacket.websiteSummary.trim()
  }

  return null
}

function whatStoodOutFromGeneration(generation: GrowthAiCopilotGeneration): string | null {
  const personalization = generation.classification.personalization
  const signals = personalization?.sourceSignals
  if (Array.isArray(signals) && signals.length > 0) {
    const lines = signals
      .map((row) => (typeof row === "string" ? row.replace(/_/g, " ").trim() : ""))
      .filter(Boolean)
      .slice(0, 3)
    if (lines.length > 0) return lines.join(" · ")
  }

  const findings = personalization?.contextPacket?.websiteFindings
  if (Array.isArray(findings) && findings.length > 0) {
    return findings.slice(0, 2).join(" · ")
  }

  const snapshot = generation.inputSnapshot ?? {}
  if (typeof snapshot.nextBestAction === "string" && snapshot.nextBestAction.trim()) {
    return snapshot.nextBestAction.trim()
  }

  return null
}

export function projectAvaRecommendationFromGeneration(input: {
  generation: GrowthAiCopilotGeneration
  lead: Pick<GrowthLead, "companyName" | "contactName" | "contactEmail">
}): GrowthAvaOperatorRecommendationView {
  const contact = recommendedContactFromGeneration(input.generation)
  return {
    contactName: contact.name ?? input.lead.contactName?.trim() ?? null,
    contactTitle: contact.title,
    contactEmail: contact.email ?? input.lead.contactEmail?.trim() ?? null,
    companyName: input.lead.companyName,
    rationale: rationaleFromGeneration(input.generation),
    confidenceLabel: resolveOperatorConfidenceLabel(input.generation),
    whatStoodOut: whatStoodOutFromGeneration(input.generation),
  }
}

export function resolvePrimaryOperatorReviewGeneration(
  generations: GrowthAiCopilotGeneration[],
): GrowthAiCopilotGeneration | null {
  const active = generations.filter((entry) => entry.status === "draft" || entry.status === "approved")
  if (active.length === 0) return generations[0] ?? null

  const draftEmail = active.find(
    (entry) =>
      entry.status === "draft" &&
      entry.generationType === "cold_email" &&
      Boolean(entry.generatedSubject?.trim()) &&
      Boolean(entry.generatedContent?.trim()),
  )
  if (draftEmail) return draftEmail

  const draftAny = active.find((entry) => entry.status === "draft")
  if (draftAny) return draftAny

  const approvedEmail = active.find(
    (entry) =>
      entry.status === "approved" &&
      entry.generationType === "cold_email" &&
      Boolean(entry.generatedContent?.trim()),
  )
  if (approvedEmail) return approvedEmail

  return active[0] ?? null
}

export function formatAvaRecommendsContactHeading(teammate: AiTeammatePresentation): string {
  return `${teammate.name} recommends contacting`
}

export function formatOperatorWorkspaceReviewIntro(teammate: AiTeammatePresentation): string {
  return `Review what ${teammate.name} prepared before outreach continues. Nothing sends without your approval.`
}

export function formatOperatorDecisionPrompt(teammate: AiTeammatePresentation): string {
  return `Would you like ${teammate.name} to proceed with this recommendation?`
}

export function summarizeOperatorWorkspaceHeader(generations: GrowthAiCopilotGeneration[]): string {
  const primary = resolvePrimaryOperatorReviewGeneration(generations)
  if (!primary) return "No recommendation yet"
  if (primary.status === "draft") {
    const emailCount = generations.filter((entry) => entry.status === "draft").length
    return emailCount === 1 ? "1 email ready for review" : `${emailCount} emails ready for review`
  }
  if (primary.status === "approved") return "Recommendation approved"
  return formatOperatorGenerationTypeLabel(primary.generationType)
}

export function buildOperatorWorkspaceDiagnostics(generation: GrowthAiCopilotGeneration): Array<{
  label: string
  value: string
}> {
  const classification = classificationRecord(generation)
  const rows: Array<{ label: string; value: string }> = [
    { label: "Generation ID", value: generation.id },
    { label: "Status", value: generation.status },
    { label: "Prompt variant", value: generation.promptVariant },
    { label: "Prompt version", value: generation.promptVersion },
  ]
  if (typeof classification.generationMode === "string") {
    rows.push({ label: "Generation mode", value: classification.generationMode })
  }
  if (typeof classification.primary === "string") {
    rows.push({ label: "Decision", value: classification.primary })
  }
  if (typeof classification.directQaMarker === "string") {
    rows.push({ label: "Direct QA marker", value: classification.directQaMarker })
  }
  if (typeof classification.qaMarker === "string") {
    rows.push({ label: "QA marker", value: classification.qaMarker })
  }
  return rows
}
