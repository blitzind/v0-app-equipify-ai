import {
  isPersonalizationPlaybookSource,
} from "@/lib/growth/personalization/personalization-industry-playbook-evidence"
import type { GrowthPersonalizationContext } from "@/lib/growth/personalization/personalization-types"
import type { PersonalizationEvidenceCandidate } from "@/lib/growth/personalization/personalization-evidence-engine"

export function buildPersonalizationSystemPrompt(): string {
  return [
    "You generate evidence-backed outbound personalization for B2B sales.",
    "Use ONLY facts provided in the verified evidence packet for company-specific claims.",
    "Industry context from playbooks describes likely relevance for teams in that space — not verified facts about this company.",
    "Do not invent metrics, awards, funding, or company events.",
    "Do not claim prior conversations unless explicitly evidenced.",
    "Do not claim the company specifically has a pain unless verified in the evidence packet.",
    "When using industry context, phrase as 'teams in this space often...' or 'companies like yours often...'.",
    "Keep tone professional and respectful.",
    "Return JSON with subject and body fields only.",
  ].join(" ")
}

function formatEvidenceSection(
  title: string,
  entries: PersonalizationEvidenceCandidate[],
): string {
  if (entries.length === 0) return `${title}:\n- None.`
  const lines = entries
    .slice(0, 12)
    .map((entry) => `- [${entry.sourceType}] ${entry.claimKey}: ${entry.evidenceSnippet}`)
    .join("\n")
  return `${title}:\n${lines}`
}

export function buildPersonalizationUserPrompt(input: {
  context: GrowthPersonalizationContext
  evidence: PersonalizationEvidenceCandidate[]
}): string {
  const verifiedEvidence = input.evidence.filter((entry) => !isPersonalizationPlaybookSource(entry.sourceType))
  const industryEvidence = input.evidence.filter((entry) => isPersonalizationPlaybookSource(entry.sourceType))

  return [
    `Company: ${input.context.companyName}`,
    input.context.industryLabel ? `Industry: ${input.context.industryLabel}` : null,
    input.context.relationshipStage ? `Relationship stage: ${input.context.relationshipStage}` : null,
    input.context.templateOverlay ? `Approved template overlay:\n${input.context.templateOverlay}` : null,
    formatEvidenceSection("Verified facts (research, memory, engagement — company-specific when stated)", verifiedEvidence),
    formatEvidenceSection(
      "Industry context (playbook intelligence — likely relevance only, NOT verified company facts)",
      industryEvidence,
    ),
    "Write a concise outbound email subject and body.",
    "Ground company-specific statements in verified facts only.",
    "Use industry context to improve relevance without claiming unverified pains or events.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildDeterministicPersonalizationDraft(input: {
  context: GrowthPersonalizationContext
  evidence: PersonalizationEvidenceCandidate[]
}): { subject: string; body: string } {
  const company = input.context.companyName
  const verifiedEvidence = input.evidence.filter((entry) => !isPersonalizationPlaybookSource(entry.sourceType))
  const industryEvidence = input.evidence.filter((entry) => isPersonalizationPlaybookSource(entry.sourceType))

  const opener =
    verifiedEvidence.find((entry) => entry.sourceType === "relationship_memory")?.evidenceSnippet ??
    verifiedEvidence[0]?.evidenceSnippet ??
    industryEvidence[0]?.evidenceSnippet ??
    `Teams like ${company} often evaluate operational improvements this quarter.`

  const objectionLine = input.context.topObjections[0]
    ? `I noted your earlier concern about ${input.context.topObjections[0].slice(0, 80).toLowerCase()} and kept this brief.`
    : null

  const meetingLine = input.context.bookingSignals[0]
    ? "If helpful, we can schedule a short working session based on your recent meeting interest."
    : "If helpful, we can share a short walkthrough tailored to your team."

  const body = [
    `Hi there — reaching out regarding ${company}.`,
    opener,
    objectionLine,
    meetingLine,
    "Happy to adjust based on your preferred communication style.",
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    subject: `Quick note for ${company}`,
    body,
  }
}

export function parsePersonalizationModelOutput(raw: string): { subject: string; body: string } | null {
  try {
    const parsed = JSON.parse(raw) as { subject?: string; body?: string }
    if (!parsed.subject?.trim() || !parsed.body?.trim()) return null
    return { subject: parsed.subject.trim().slice(0, 200), body: parsed.body.trim().slice(0, 4000) }
  } catch {
    return null
  }
}
