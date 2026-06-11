/** Subject line intelligence — research-aware subjects with quality scoring (Phase 4.1). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { detectOutreachIndustry } from "@/lib/growth/outreach/personalization/industry-detection"
import {
  extractMemoryOpenLoop,
  hasMemoryRelationshipEngagement,
  isExistingCustomerRelationship,
  memoryMeetsOutreachThreshold,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import {
  resolveResearchEvidenceConfidenceTier,
  selectResearchEvidenceCandidate,
  truncateResearchSnippet,
} from "@/lib/growth/outreach/personalization/research-evidence-selection"
import type {
  OutreachContextPacket,
  SelectedMessageStrategy,
  SubjectCategory,
  SubjectEvidenceSource,
  SubjectIntelligenceMetadata,
  SubjectQualityScore,
} from "@/lib/growth/outreach/personalization/personalization-types"

export type { SubjectCategory, SubjectEvidenceSource, SubjectQualityScore } from "@/lib/growth/outreach/personalization/personalization-types"

export const GENERIC_SUBJECT_PATTERNS = [
  /quick ops note/i,
  /quick note for/i,
  /quick ops question/i,
  /quick follow-up/i,
  /reaching out/i,
  /touching base/i,
  /checking in/i,
  /^following up$/i,
  /^follow-up$/i,
  /^follow up$/i,
  /^following up —/i,
  /following up on/i,
  /just following up/i,
  /wanted to reach out/i,
  /wanted to connect/i,
] as const

export const SUBJECT_IDEAL_MIN_LENGTH = 28
export const SUBJECT_IDEAL_MAX_LENGTH = 55
export const SUBJECT_ABSOLUTE_MAX_LENGTH = 78

export const MEMORY_SUBJECT_CONFIDENCE_THRESHOLD = 50

export type SubjectIntelligenceResult = SubjectIntelligenceMetadata & {
  subject: string
}

type SubjectCandidate = {
  category: SubjectCategory
  evidenceSource: SubjectEvidenceSource
  evidence: string | null
  templates: string[]
}

function compactSubjectSnippet(text: string, max = 42): string {
  let snippet = truncateResearchSnippet(text, max)
  snippet = snippet.replace(/^(covers|provides|offers|delivers|specializes in|asked for|requested|mentioned|noted)\s+/i, "")
  return snippet.charAt(0).toUpperCase() + snippet.slice(1)
}

function normalizeSubjectKey(subject: string): string {
  return subject.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
}

function genericSubjectFingerprint(subject: string): string | null {
  const normalized = normalizeSubjectKey(subject)
  for (const pattern of GENERIC_SUBJECT_PATTERNS) {
    if (pattern.test(normalized)) return pattern.source
  }
  return null
}

export function isGenericSubjectPattern(subject: string): boolean {
  return genericSubjectFingerprint(subject) != null
}

function isTooSimilarToPrior(subject: string, priorSubjects: string[]): boolean {
  const normalized = normalizeSubjectKey(subject)
  if (!normalized) return false

  for (const prior of priorSubjects) {
    const priorNorm = normalizeSubjectKey(prior)
    if (!priorNorm) continue
    if (normalized === priorNorm) return true
    if (normalized.includes(priorNorm) || priorNorm.includes(normalized)) return true

    const subjectGeneric = genericSubjectFingerprint(subject)
    const priorGeneric = genericSubjectFingerprint(prior)
    if (subjectGeneric && priorGeneric && subjectGeneric === priorGeneric) return true
  }

  return false
}

function trimSubject(subject: string): string {
  const trimmed = subject.trim().replace(/\s+/g, " ")
  if (trimmed.length <= SUBJECT_ABSOLUTE_MAX_LENGTH) return trimmed
  return `${trimmed.slice(0, SUBJECT_ABSOLUTE_MAX_LENGTH - 1).trim()}…`
}

function painSubjectTemplates(painBlockId: string, company: string): string[] {
  switch (painBlockId) {
    case "dispatch_manual":
      return [
        "Still handling dispatch manually?",
        `Dispatch question for ${company}`,
        "Manual dispatch workflow question",
      ]
    case "scheduling_gaps":
      return [
        "Scheduling workflow question",
        `Online booking question — ${company}`,
        "Scheduling handoff question",
      ]
    case "capacity_strain":
      return [
        "Capacity workflow question",
        `Growing volume question — ${company}`,
        "Ops capacity question",
      ]
    case "service_visibility":
    default:
      return [
        "Service visibility question",
        `Field ops visibility — ${company}`,
        "Service queue workflow question",
      ]
  }
}

function curiositySubjectTemplates(company: string, industryLabel: string | null): string[] {
  const industry = industryLabel?.trim()
  return [
    "One workflow question",
    `Dispatch workflow — ${company}`,
    industry ? `${industry} service workflow` : "Field service workflow question",
    `Service visibility — ${company}`,
    `Ops workflow review — ${company}`,
  ]
}

function memoryMeetsConfidenceThreshold(packet: OutreachContextPacket): boolean {
  return memoryMeetsOutreachThreshold(packet)
}

function resolveMemorySubjectCandidate(packet: OutreachContextPacket): SubjectCandidate | null {
  if (!memoryMeetsConfidenceThreshold(packet)) return null

  const openLoop = extractMemoryOpenLoop(packet)
  if (openLoop) {
    const topic = compactSubjectSnippet(openLoop, 36)
    return {
      category: "memory_aware",
      evidenceSource: "memory_open_loop",
      evidence: openLoop,
      templates: [
        `Re: ${topic}`,
        `Following up on ${topic}`,
        `About ${topic}`,
        `Quick follow-up on ${topic}`,
      ],
    }
  }

  if (packet.memoryCommitmentSummaries[0]) {
    const topic = compactSubjectSnippet(packet.memoryCommitmentSummaries[0], 36)
    return {
      category: "memory_aware",
      evidenceSource: "memory_commitment",
      evidence: packet.memoryCommitmentSummaries[0],
      templates: [
        `Following up on ${topic}`,
        `Re: ${topic}`,
        `About the ${topic}`,
        `About ${topic}`,
      ],
    }
  }

  if (packet.memoryInteractionSummaries[0]) {
    const topic = compactSubjectSnippet(packet.memoryInteractionSummaries[0], 36)
    return {
      category: "memory_aware",
      evidenceSource: "memory_interaction",
      evidence: packet.memoryInteractionSummaries[0],
      templates: [
        `Following up on ${topic}`,
        `Re: ${topic}`,
        `About our last note — ${topic}`,
      ],
    }
  }

  if (packet.objectionSummaries[0]) {
    const topic = compactSubjectSnippet(packet.objectionSummaries[0], 36)
    return {
      category: "memory_aware",
      evidenceSource: "memory_objection",
      evidence: packet.objectionSummaries[0],
      templates: [
        `Re: ${topic}`,
        `About ${topic}`,
        `Following up on ${topic}`,
      ],
    }
  }

  if (isExistingCustomerRelationship(packet)) {
    const topic = compactSubjectSnippet(
      packet.memoryInteractionSummaries[0] ?? packet.relationshipSummary ?? packet.companyName,
      36,
    )
    return {
      category: "memory_aware",
      evidenceSource: "relationship_stage",
      evidence: packet.relationshipSummary ?? packet.memoryInteractionSummaries[0] ?? null,
      templates: [
        `Next step on ${topic}`,
        `Following up on ${topic}`,
        `Re: ${topic}`,
      ],
    }
  }

  if (packet.memoryPreferenceSummaries[0] && packet.relationshipSummary) {
    const topic = compactSubjectSnippet(packet.relationshipSummary, 36)
    return {
      category: "memory_aware",
      evidenceSource: "memory_preference",
      evidence: packet.relationshipSummary,
      templates: [
        `Re: ${topic}`,
        `Following up on ${topic}`,
        `Quick follow-up — ${packet.companyName.trim()}`,
      ],
    }
  }

  if (packet.relationshipSummary) {
    const topic = compactSubjectSnippet(packet.relationshipSummary, 36)
    return {
      category: "memory_aware",
      evidenceSource: "relationship_summary",
      evidence: packet.relationshipSummary,
      templates: [
        `Following up on ${topic}`,
        `Re: ${topic}`,
        `Quick follow-up — ${packet.companyName.trim()}`,
      ],
    }
  }

  return null
}

function resolveFollowUpSubjectCandidate(
  packet: OutreachContextPacket,
  strategy: SelectedMessageStrategy,
): SubjectCandidate {
  const company = packet.companyName.trim()
  const painBlock = strategy.blocks.find((block) => block.key === "pain")
  const painId = painBlock?.blockId ?? "service_visibility"

  const replyTopic = packet.priorReplySummaries[0]
    ? compactSubjectSnippet(packet.priorReplySummaries[0], 36)
    : null
  const sequenceStep = packet.sequenceHistorySummaries.length

  if (replyTopic) {
    return {
      category: "follow_up",
      evidenceSource: "sequence_context",
      evidence: packet.priorReplySummaries[0] ?? null,
      templates: [
        `Re: ${replyTopic}`,
        `${replyTopic} — next step`,
        `Workflow note — ${company}`,
      ],
    }
  }

  if (sequenceStep > 0) {
    const painTemplates = painSubjectTemplates(painId, company)
    return {
      category: "follow_up",
      evidenceSource: "sequence_context",
      evidence: packet.sequenceHistorySummaries[0] ?? null,
      templates: [
        `Following up — ${company}`,
        painTemplates[0] ?? `Quick follow-up — ${company}`,
        `Re: ${company} workflow`,
      ],
    }
  }

  return {
    category: "follow_up",
    evidenceSource: "sequence_context",
    evidence: null,
    templates: [
      `Quick follow-up — ${company}`,
      `Following up — ${company}`,
      ...painSubjectTemplates(painId, company).slice(0, 1),
    ],
  }
}

function resolveResearchSubjectCandidate(
  packet: OutreachContextPacket,
  confidenceTier: "high" | "medium",
): SubjectCandidate | null {
  const candidate = selectResearchEvidenceCandidate(packet, confidenceTier)
  if (!candidate) return null

  const company = packet.companyName.trim()
  const snippet = compactSubjectSnippet(candidate.evidence, 40)

  if (candidate.source === "research_pain_point") {
    const dispatchPain = /dispatch|spreadsheet|schedul|manual/i.test(candidate.evidence)
    return {
      category: "pain_point",
      evidenceSource: candidate.source,
      evidence: candidate.evidence,
      templates: dispatchPain
        ? painSubjectTemplates("dispatch_manual", company)
        : [
            snippet.endsWith("?") ? snippet : `${snippet}?`,
            `Workflow question — ${company}`,
            `Service ops question — ${company}`,
          ],
    }
  }

  if (candidate.source === "outreach_angle") {
    return {
      category: "research_observation",
      evidenceSource: candidate.source,
      evidence: candidate.evidence,
      templates: [
        compactSubjectSnippet(candidate.evidence, 50),
        `Question about ${snippet.toLowerCase()}`,
        `Dispatch question for ${company}`,
      ],
    }
  }

  if (candidate.source === "website_finding" || candidate.source === "company_summary") {
    const dispatchHint = /dispatch|schedul|field service|technician|service area|24\/7|emergency/i.test(
      candidate.evidence,
    )
    return {
      category: "research_observation",
      evidenceSource: candidate.source,
      evidence: candidate.evidence,
      templates: dispatchHint
        ? [
            `Dispatch question for ${company}`,
            `Field service workflow — ${company}`,
            `${snippet} — ${company}`,
          ]
        : [
            `About your field service workflow`,
            `${snippet} — ${company}`,
            `Question for ${company}`,
          ],
    }
  }

  return {
    category: "research_observation",
    evidenceSource: candidate.source,
    evidence: candidate.evidence,
    templates: [
      `Question about ${snippet.toLowerCase()}`,
      `Field service workflow — ${company}`,
      `${snippet} — ${company}`,
    ],
  }
}

function resolveCuriositySubjectCandidate(
  packet: OutreachContextPacket,
  strategy: SelectedMessageStrategy,
): SubjectCandidate {
  const company = packet.companyName.trim()
  const painBlock = strategy.blocks.find((block) => block.key === "pain")
  const painId = painBlock?.blockId ?? "service_visibility"
  const industry = detectOutreachIndustry(packet)

  if (strategy.angle === "dispatch_pain_capacity" || painId === "dispatch_manual") {
    return {
      category: "curiosity",
      evidenceSource: "pain_signal",
      evidence: null,
      templates: painSubjectTemplates("dispatch_manual", company),
    }
  }

  if (industry === "medical_equipment") {
    return {
      category: "curiosity",
      evidenceSource: "industry_signal",
      evidence: packet.industryLabel,
      templates: [
        "Service visibility question",
        `Medical service workflow — ${company}`,
        "One workflow question",
      ],
    }
  }

  if (industry === "hvac") {
    return {
      category: "curiosity",
      evidenceSource: "industry_signal",
      evidence: packet.industryLabel,
      templates: [
        `Dispatch workflow — ${company}`,
        "One dispatch question",
        "Field service workflow question",
      ],
    }
  }

  return {
    category: "curiosity",
    evidenceSource: "pain_signal",
    evidence: null,
    templates: curiositySubjectTemplates(company, packet.industryLabel),
  }
}

/** Legacy subject templates from pre-4.1 deterministic generation. */
export function buildLegacyDeterministicSubject(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
}): string {
  const company = input.packet.companyName.trim()
  if (input.strategy.angle === "breakup_respectful") return `Closing the loop — ${company}`
  if (input.strategy.angle === "reply_response") return `Re: ${company} follow-up`
  if (input.strategy.angle === "executive_outcome") return `${company} — ops workflow review`
  if (input.strategy.industry === "hvac") return `${company} dispatch workflow`
  if (input.strategy.industry === "medical_equipment") return `${company} service visibility`
  return `Workflow question — ${company}`
}

function resolveSubjectCandidate(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
  generationType: GrowthAiCopilotGenerationType
}): SubjectCandidate {
  const { packet, strategy, generationType } = input
  const company = packet.companyName.trim()

  if (strategy.angle === "breakup_respectful") {
    return {
      category: "legacy_fallback",
      evidenceSource: "legacy_template",
      evidence: null,
      templates: [`Closing the loop — ${company}`],
    }
  }

  if (strategy.angle === "reply_response") {
    return {
      category: "follow_up",
      evidenceSource: "sequence_context",
      evidence: packet.priorReplySummaries[0] ?? null,
      templates: [`Re: ${company} follow-up`],
    }
  }

  const memoryCandidate = resolveMemorySubjectCandidate(packet)
  const isFollowUpType =
    generationType === "follow_up_email" ||
    generationType === "reengagement_email" ||
    generationType === "next_message" ||
    strategy.angle === "engagement_follow_up"

  if (memoryCandidate && (isFollowUpType || isExistingCustomerRelationship(packet))) {
    return memoryCandidate
  }

  if (isFollowUpType && memoryCandidate) {
    return memoryCandidate
  }

  if (isFollowUpType) {
    return resolveFollowUpSubjectCandidate(packet, strategy)
  }

  if (
    memoryCandidate &&
    (hasMemoryRelationshipEngagement(packet) ||
      isExistingCustomerRelationship(packet) ||
      packet.objectionSummaries.length > 0)
  ) {
    return memoryCandidate
  }

  const confidenceTier = resolveResearchEvidenceConfidenceTier(packet.researchConfidence)
  if (confidenceTier) {
    const researchCandidate = resolveResearchSubjectCandidate(packet, confidenceTier)
    if (researchCandidate) return researchCandidate
  }

  if (strategy.researchOpener?.evidence) {
    const fromOpener = resolveResearchSubjectCandidate(packet, confidenceTier ?? "medium")
    if (fromOpener) return fromOpener
  }

  if (generationType === "executive_email") {
    return {
      category: "curiosity",
      evidenceSource: "industry_signal",
      evidence: null,
      templates: [
        `Ops workflow review — ${company}`,
        "Executive workflow question",
        `Field ops review — ${company}`,
      ],
    }
  }

  const painBlock = strategy.blocks.find((block) => block.key === "pain")
  if (painBlock && confidenceTier === "medium") {
    return {
      category: "pain_point",
      evidenceSource: "pain_signal",
      evidence: painBlock.text,
      templates: painSubjectTemplates(painBlock.blockId, company),
    }
  }

  return resolveCuriositySubjectCandidate(packet, strategy)
}

export function scoreSubjectQuality(input: {
  subject: string
  category: SubjectCategory
  evidence: string | null
  generationType: GrowthAiCopilotGenerationType
  priorSubjects: string[]
  companyName: string
}): SubjectQualityScore {
  const subject = input.subject.trim()
  const len = subject.length
  const isGenericPattern = isGenericSubjectPattern(subject)

  let specificity = 15
  if (input.evidence && input.evidence.length >= 12) specificity += 55
  else if (!/quick ops note|quick note for/i.test(subject)) specificity += 20
  if (subject.toLowerCase().includes(input.companyName.toLowerCase())) specificity += 10
  if (input.category === "research_observation" || input.category === "memory_aware") specificity += 15
  specificity = Math.min(100, specificity)

  let relevance = 60
  if (input.category === "legacy_fallback") relevance = 35
  if (input.category === "follow_up" && /follow|re:/i.test(subject)) relevance = 85
  if (input.category === "memory_aware") relevance = 90
  if (input.category === "research_observation") relevance = 88
  if (input.category === "pain_point") relevance = 82
  if (input.generationType === "executive_email" && /review|executive|ops/i.test(subject)) relevance += 10
  relevance = Math.min(100, relevance)

  let nonGeneric = isGenericPattern ? 10 : 85
  if (/— quick ops note|quick note for/i.test(subject)) nonGeneric = 5

  let lengthScore = 50
  if (len >= SUBJECT_IDEAL_MIN_LENGTH && len <= SUBJECT_IDEAL_MAX_LENGTH) lengthScore = 100
  else if (len >= 20 && len <= 65) lengthScore = 75
  else if (len < 20) lengthScore = 40
  else lengthScore = 55

  let curiosity = 40
  if (subject.includes("?")) curiosity += 45
  if (/\b(question|curious|about|workflow|dispatch|still)\b/i.test(subject)) curiosity += 20
  curiosity = Math.min(100, curiosity)

  let diversity = 90
  if (isTooSimilarToPrior(subject, input.priorSubjects)) diversity = 25
  else if (input.priorSubjects.length > 0) diversity = 80

  const overall = Math.round(
    specificity * 0.25 +
      relevance * 0.2 +
      nonGeneric * 0.2 +
      lengthScore * 0.1 +
      curiosity * 0.15 +
      diversity * 0.1,
  )

  return {
    overall,
    specificity,
    relevance,
    nonGeneric,
    length: lengthScore,
    curiosity,
    diversity,
    isGenericPattern,
  }
}

function pickDiverseSubject(input: {
  candidate: SubjectCandidate
  variationSeed: string
  priorSubjects: string[]
}): string {
  const nonGenericTemplates = input.candidate.templates.filter(
    (template) => !isGenericSubjectPattern(trimSubject(template)),
  )
  const templates =
    nonGenericTemplates.length > 0 ? nonGenericTemplates : input.candidate.templates
  const templateCount = templates.length
  const startIndex = pickVariantIndex(`${input.variationSeed}:subject:${input.candidate.category}`, templateCount)

  for (let offset = 0; offset < templateCount; offset += 1) {
    const template = templates[(startIndex + offset) % templateCount]!
    const subject = trimSubject(template)
    if (isGenericSubjectPattern(subject)) continue
    if (!isTooSimilarToPrior(subject, input.priorSubjects)) return subject
  }

  return trimSubject(templates[startIndex] ?? templates[0]!)
}

function buildResearchAwareSubjectFallback(packet: OutreachContextPacket): string {
  const company = packet.companyName.trim()
  const pain = packet.researchPainPoints[0]
  if (pain) return trimSubject(`${compactSubjectSnippet(pain, 42)} — ${company}`)
  const finding = packet.websiteFindings[0]
  if (finding) return trimSubject(`${compactSubjectSnippet(finding, 42)} — ${company}`)
  return trimSubject(`Workflow question — ${company}`)
}

export function buildIntelligentSubject(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
  generationType: GrowthAiCopilotGenerationType
  variationSeed: string
}): SubjectIntelligenceResult {
  const legacySubject = buildLegacyDeterministicSubject({
    packet: input.packet,
    strategy: input.strategy,
  })
  const priorSubjects = input.packet.priorOutboundSubjects
  const candidate = resolveSubjectCandidate(input)
  let subject = pickDiverseSubject({
    candidate,
    variationSeed: input.variationSeed,
    priorSubjects,
  })
  if (isGenericSubjectPattern(subject)) {
    subject = buildResearchAwareSubjectFallback(input.packet)
  }
  const qualityScore = scoreSubjectQuality({
    subject,
    category: candidate.category,
    evidence: candidate.evidence,
    generationType: input.generationType,
    priorSubjects,
    companyName: input.packet.companyName,
  })

  return {
    subject,
    category: candidate.category,
    evidenceSource: candidate.evidenceSource,
    evidence: candidate.evidence,
    qualityScore,
    legacySubject,
  }
}
