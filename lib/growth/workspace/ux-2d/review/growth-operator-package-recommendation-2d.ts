/**
 * GE-AIOS-OPERATOR-UX-2D — Package recommendation presentation (client-safe).
 * Deterministic synthesis from Approvals2AOperatorReviewPacket — no new recommendation authority.
 */

import type { Approvals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  sanitizeOperatorReviewCopy,
  type OperatorPackageDecisionSummary,
} from "@/lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a"

export const GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER =
  "ge-aios-operator-ux-2d-package-recommendation-quality-v1" as const

export type OperatorPackageQualityState = "ready" | "needs_attention" | "limited_evidence"

export type OperatorPackageEvidenceClassification = "verified" | "inferred" | "unknown"

export type OperatorPackageRecommendationAngle = {
  label: string
  rationale: string
  equipifyValue: string | null
}

export type OperatorPackageFirstConversationStrategy = {
  openingPremise: string
  discoveryQuestion: string
  proofPoint: string | null
  desiredNextStep: string
}

export type OperatorPackageDraftAlignment = {
  aligned: boolean
  warnings: string[]
}

export type OperatorPackageRecommendation = {
  qaMarker: typeof GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER
  executiveRecommendation: string
  whyThisAccount: string[]
  whyNow: string
  whyNowHasTrigger: boolean
  recommendedBuyer: {
    name: string | null
    title: string | null
    roleRationale: string
    confidenceLabel: string | null
    weakContact: boolean
  }
  primaryAngle: OperatorPackageRecommendationAngle
  firstConversation: OperatorPackageFirstConversationStrategy
  evidenceAndUncertainty: Record<OperatorPackageEvidenceClassification, string[]>
  draftAlignment: OperatorPackageDraftAlignment
  qualityState: OperatorPackageQualityState
  qualityNotes: string[]
  weakEvidenceIntro: string | null
}

type RankedAngleCandidate = {
  label: string
  score: number
  equipifyValue: string
  evidenceTerms: string[]
}

const PROVIDER_JARGON = /\b(datamoon|apollo|provider|vendor feed|research engine)\b/i

const UNSUPPORTED_URGENCY =
  /\b(urgent|urgency|buying now|ready to buy|immediate purchase|closing soon|act fast|limited time)\b/i

const GENERIC_FIT = /\b(great fit|strong fit|good fit|excellent fit|perfect fit)\b/i

const EQUIPIFY_ANGLE_CATALOG: RankedAngleCandidate[] = [
  {
    label: "Recurring maintenance visibility",
    score: 0,
    equipifyValue: "Preventive maintenance scheduling and history",
    evidenceTerms: [
      "preventive maintenance",
      "recurring pm",
      "maintenance plan",
      "scheduled service",
      "pm contract",
      "recurring maintenance",
    ],
  },
  {
    label: "Field service coordination",
    score: 0,
    equipifyValue: "Dispatch, work orders, and mobile execution",
    evidenceTerms: [
      "field service",
      "field team",
      "dispatch",
      "technician",
      "depot-to-field",
      "depot to field",
      "service coordination",
    ],
  },
  {
    label: "Equipment service history",
    score: 0,
    equipifyValue: "Asset records and service history",
    evidenceTerms: [
      "service history",
      "asset record",
      "equipment record",
      "installed base",
      "serial",
      "asset visibility",
    ],
  },
  {
    label: "Compliance and documentation",
    score: 0,
    equipifyValue: "Documentation and compliance workflows",
    evidenceTerms: [
      "compliance",
      "documentation",
      "audit",
      "inspection",
      "survey",
      "regulatory",
    ],
  },
  {
    label: "Multi-location operations",
    score: 0,
    equipifyValue: "Centralized multi-site visibility",
    evidenceTerms: [
      "multi-location",
      "multiple location",
      "multi site",
      "branch",
      "campus",
      "across markets",
      "multiple markets",
    ],
  },
  {
    label: "Quote-to-cash workflow",
    score: 0,
    equipifyValue: "Quote-to-cash workflow",
    evidenceTerms: [
      "quote",
      "invoice",
      "billing",
      "dispatch-to-cash",
      "dispatch to cash",
      "quote-to-cash",
    ],
  },
  {
    label: "Technician productivity",
    score: 0,
    equipifyValue: "Mobile work orders and technician execution",
    evidenceTerms: [
      "technician productivity",
      "mobile",
      "job visibility",
      "status update",
      "admin overhead",
    ],
  },
]

function uniqueLines(lines: Array<string | null | undefined>, limit = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const sanitized = sanitizeOperatorRecommendationCopy(line)
    if (!sanitized || seen.has(sanitized.toLowerCase())) continue
    seen.add(sanitized.toLowerCase())
    out.push(sanitized)
    if (out.length >= limit) break
  }
  return out
}

function stripCompanyPrefix(text: string, companyName: string): string {
  const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text
    .replace(new RegExp(`^${escaped}\\s*[-—:.,\\s]+`, "i"), "")
    .replace(new RegExp(`\\b${escaped}\\b`, "gi"), "this account")
    .replace(/\bthis account this account\b/gi, "this account")
    .trim()
}

export function sanitizeOperatorRecommendationCopy(text: string | null | undefined): string | null {
  const base = sanitizeOperatorReviewCopy(text)
  if (!base) return null

  if (/appears to be unknown/i.test(base)) return null
  if (/could potentially/i.test(base)) {
    return base.replace(/\bcould potentially\b/gi, "may")
  }
  if (PROVIDER_JARGON.test(base)) {
    return base
      .replace(/\b(?:from|via|using)\s+datamoon\b/gi, "from research")
      .replace(/\bdatamoon\b/gi, "research")
      .replace(/\bapollo\b/gi, "contact research")
      .replace(/\bresearch engine\b/gi, "research")
  }
  if (/^(unknown|not classified|unclassified|n\/a|none)[.]?$/i.test(base)) return null

  let normalized = base
    .replace(/\blooks like\b/gi, "")
    .replace(/\bappears to be\b/gi, "is")
    .replace(/\(\s*\d+\s*%\s*confidence\s*\)/gi, "")
    .replace(/\b(?:ICP fit|Fit):\s*/gi, "")
    .replace(/\bEquipment focus:\s*/gi, "")
    .replace(/\bDecision maker:\s*/gi, "")
    .replace(/\bSales recommendation:\s*/gi, "")
    .replace(/\bWhy:\s*/gi, "")
    .replace(/\bRecommended entry:\s*/gi, "")
    .replace(/\bConversation angle:\s*/gi, "")
    .replace(/\bTop business pressure:\s*/gi, "")
    .replace(/\bOperational bottleneck:\s*/gi, "")
    .replace(/\bPrimary buying trigger.*?:\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (!normalized || normalized.length < 12) return null
  if (GENERIC_FIT.test(normalized) && normalized.length < 48) return null
  return normalized.endsWith(".") ? normalized : `${normalized}.`
}

function collectEvidenceHaystack(packet: Approvals2AOperatorReviewPacket): string {
  return [
    ...packet.explainability.supportingEvidence,
    ...packet.operatorReviewLayout.researchSummary,
    ...packet.knowledgeLayers.prospectTruth,
    ...packet.whySelected,
    ...(packet.salesStrategy?.evidence.map((row) => row.detail) ?? []),
    ...(packet.salesStrategy?.prospectTruth?.evidence.map((row) => row.detail) ?? []),
    ...(packet.salesStrategy?.businessProblems ?? []),
    packet.company.equipmentServiced.join(" "),
    packet.company.industry ?? "",
    packet.salesStrategy?.prospectTruth?.fitReason ?? "",
    packet.salesStrategy?.prospectTruth?.opportunitySummary ?? "",
  ]
    .join(" ")
    .toLowerCase()
}

function rankOperationalAngles(packet: Approvals2AOperatorReviewPacket): RankedAngleCandidate[] {
  const haystack = collectEvidenceHaystack(packet)
  const strategy = packet.salesStrategy
  const revenue = strategy?.revenueStrategyIntelligence ?? null
  const consultant = strategy?.consultantDiscoveryIntelligence ?? null

  return EQUIPIFY_ANGLE_CATALOG.map((candidate, index) => {
    let score = 0
    for (const term of candidate.evidenceTerms) {
      if (haystack.includes(term)) score += 12
    }
    if (revenue?.primaryEntryPoint?.label.toLowerCase().includes(candidate.label.toLowerCase())) {
      score += 18
    }
    if (consultant?.conversationAngle?.toLowerCase().includes(candidate.label.toLowerCase())) {
      score += 14
    }
    if (strategy?.primaryHook?.toLowerCase().includes(candidate.label.split(" ")[0]?.toLowerCase() ?? "")) {
      score += 8
    }
    if (strategy?.evidenceIntelligence?.themeKey?.replace(/_/g, " ").includes(candidate.label.toLowerCase())) {
      score += 10
    }
    return { ...candidate, score: score + Math.max(0, 3 - index) }
  }).sort((a, b) => b.score - a.score)
}

function resolvePrimaryAngle(packet: Approvals2AOperatorReviewPacket): OperatorPackageRecommendationAngle {
  const ranked = rankOperationalAngles(packet)
  const top = ranked[0]
  const strategy = packet.salesStrategy
  const revenue = strategy?.revenueStrategyIntelligence ?? null
  const consultant = strategy?.consultantDiscoveryIntelligence ?? null

  const selected =
    top && top.score >= 12
      ? top
      : ranked.find((row) => row.score > 0) ?? top ?? EQUIPIFY_ANGLE_CATALOG[0]

  const label = selected.label

  const rationale =
    uniqueLines([
      revenue?.recommendationSummary,
      consultant?.operationalBottleneck,
      consultant?.primaryBusinessPressure?.label,
      strategy?.prospectTruth?.opportunitySummary,
      strategy?.businessProblems[0],
      selected.score >= 12
        ? `Observed evidence points to ${selected.label.toLowerCase()} as the strongest operational entry point.`
        : "Limited direct evidence — this angle is the best available operational hypothesis.",
    ], 1)[0] ?? "Review supporting research to confirm the recommended entry angle."

  return {
    label,
    rationale: stripCompanyPrefix(rationale, packet.company.name),
    equipifyValue: selected.equipifyValue,
  }
}

function buildWhyThisAccount(packet: Approvals2AOperatorReviewPacket): string[] {
  const strategy = packet.salesStrategy
  const reasons = uniqueLines([
    strategy?.prospectTruth?.fitReason,
    ...packet.whySelected,
    ...packet.explainability.supportingEvidence,
    ...packet.knowledgeLayers.prospectTruth,
    strategy?.prospectTruth?.opportunitySummary,
    packet.company.equipmentServiced[0]
      ? `Services and maintains ${packet.company.equipmentServiced.slice(0, 2).join(" and ")} equipment.`
      : null,
    packet.company.location ? `Operates from ${packet.company.location}.` : null,
    ...(strategy?.businessProblems.slice(0, 2) ?? []),
    ...packet.operatorReviewLayout.revenueStrategyEssentials.slice(0, 1),
  ], 6).map((line) => stripCompanyPrefix(line, packet.company.name))

  return reasons.slice(0, 3)
}

function hasVerifiedTimingEvidence(packet: Approvals2AOperatorReviewPacket): boolean {
  const verifiedHaystack = [
    ...packet.explainability.supportingEvidence,
    ...packet.operatorReviewLayout.researchSummary,
    ...(packet.salesStrategy?.evidence.map((row) => row.detail) ?? []),
    ...(packet.salesStrategy?.prospectTruth?.evidence.map((row) => row.detail) ?? []),
  ]
    .join(" ")
    .toLowerCase()

  const timingPatterns = [
    /\bhiring\b|\bjob posting\b|\bopen role\b|\brecruiting\b|\bnow hiring\b/i,
    /\bexpansion\b|\bnew location\b|\bopened\b|\bopening\b|\bnew office\b/i,
    /\bacquisition\b|\bmerger\b/i,
    /\bregulatory\b|\bcompliance deadline\b|\baudit deadline\b/i,
    /\brecent engagement\b|\breplied\b|\bvisited\b|\bwebinar\b/i,
    /\btechnology change\b|\bmigration\b|\breplacing\b/i,
    /\bservice growth\b|\bgrowing service\b/i,
  ]

  return timingPatterns.some((pattern) => pattern.test(verifiedHaystack))
}

function buildWhyNow(packet: Approvals2AOperatorReviewPacket): { text: string; hasTrigger: boolean } {
  if (!hasVerifiedTimingEvidence(packet)) {
    return {
      text: "No verified timing event was found. This is a fit-based opportunity rather than a trigger-based opportunity.",
      hasTrigger: false,
    }
  }

  const strategy = packet.salesStrategy
  const revenue = strategy?.revenueStrategyIntelligence ?? null
  const consultant = strategy?.consultantDiscoveryIntelligence ?? null

  const triggerLines = uniqueLines([
    ...(revenue?.timingSignals ?? []),
    revenue?.timingRationale,
    consultant?.conversationTiming?.reason,
    consultant?.primaryBuyingTrigger?.label
      ? `${consultant.primaryBuyingTrigger.label} (${consultant.primaryBuyingTrigger.impact} impact)`
      : null,
    consultant?.conversationTiming?.internalNote,
  ], 2).filter((line) => !UNSUPPORTED_URGENCY.test(line))

  if (triggerLines.length > 0) {
    return {
      text: triggerLines.slice(0, 2).join(" "),
      hasTrigger: true,
    }
  }

  return {
    text: "No verified timing event was found. This is a fit-based opportunity rather than a trigger-based opportunity.",
    hasTrigger: false,
  }
}

function buildRecommendedBuyer(packet: Approvals2AOperatorReviewPacket): OperatorPackageRecommendation["recommendedBuyer"] {
  const strategy = packet.salesStrategy
  const dm = packet.decisionMaker
  const weakContact =
    !dm.name?.trim() ||
    (!dm.email?.trim() && !dm.phone?.trim()) ||
    (dm.contactConfidence != null && dm.contactConfidence < 0.45)

  const roleRationale =
    sanitizeOperatorRecommendationCopy(strategy?.decisionMakerAnalysis.whyThisPerson) ??
    sanitizeOperatorRecommendationCopy(strategy?.decisionMakerAnalysis.whyTheyCare) ??
    sanitizeOperatorRecommendationCopy(packet.explainability.whyContact) ??
    (dm.title
      ? `${dm.title} is the strongest initial buyer because the likely pain centers on service execution and operational coordination.`
      : weakContact
        ? "Contact identity is weak — keep outreach role-focused until a buyer is verified."
        : "Operations leadership is the strongest initial buyer because the likely pain centers on service execution, asset visibility, and recurring maintenance coordination.")

  const confidenceLabel =
    dm.contactConfidence != null
      ? `${Math.round(dm.contactConfidence * 100)}% buyer confidence`
      : dm.verificationStatus?.trim() || null

  return {
    name: dm.name,
    title: dm.title,
    roleRationale: stripCompanyPrefix(roleRationale, packet.company.name),
    confidenceLabel,
    weakContact,
  }
}

function buildExecutiveRecommendation(
  packet: Approvals2AOperatorReviewPacket,
  primaryAngle: OperatorPackageRecommendationAngle,
  whyThisAccount: string[],
): string {
  const company = packet.company.name
  const confidence = packet.risk.overallConfidence
  const fitLead = whyThisAccount[0] ?? "the operational profile matches Equipify's service-operator ICP"
  const motion = primaryAngle.label.toLowerCase()

  if (confidence < 0.35) {
    return `${company} may be worth exploratory outreach, but Ava found limited evidence to support a confident recommendation. Review assumptions before authorizing.`
  }

  if (confidence < 0.5) {
    return `Ava found a plausible operational fit with ${company}, but the evidence is limited. ${fitLead.replace(/\.$/, "")}. Lead with ${motion} and validate assumptions before authorizing outreach.`
  }

  const fitBecause = whyThisAccount.slice(0, 2).join("; ").replace(/\.$/, "")
  return `${company} appears to be a strong fit because ${fitBecause.toLowerCase()}. Ava recommends leading with ${motion} rather than a broad software pitch.`
}

function buildFirstConversation(
  packet: Approvals2AOperatorReviewPacket,
  primaryAngle: OperatorPackageRecommendationAngle,
): OperatorPackageFirstConversationStrategy {
  const strategy = packet.salesStrategy
  const consultant = strategy?.consultantDiscoveryIntelligence ?? null

  const openingPremise =
    sanitizeOperatorRecommendationCopy(strategy?.recommendedConversation) ??
    sanitizeOperatorRecommendationCopy(strategy?.evidenceIntelligence?.selectedObservation?.consultantObservation) ??
    sanitizeOperatorRecommendationCopy(strategy?.operatorReasoning?.primaryInsight) ??
    sanitizeOperatorRecommendationCopy(strategy?.primaryHook) ??
    `Lead with how ${packet.company.name} currently handles ${primaryAngle.label.toLowerCase()}.`

  const discoveryQuestion =
    sanitizeOperatorRecommendationCopy(consultant?.recommendedFirstQuestion) ??
    sanitizeOperatorRecommendationCopy(strategy?.conversationStrategy?.discoveryQuestions?.[0]) ??
    sanitizeOperatorRecommendationCopy(strategy?.sellerTruth?.discoveryQuestions?.[0]) ??
    `Ask where the team loses visibility between scheduled service, job execution, and customer documentation.`

  const proofPoint =
    sanitizeOperatorRecommendationCopy(strategy?.trustBuilders[0]) ??
    sanitizeOperatorRecommendationCopy(strategy?.sellerTruth?.proofPoints?.[0]) ??
    sanitizeOperatorRecommendationCopy(primaryAngle.equipifyValue)

  const desiredNextStep =
    sanitizeOperatorRecommendationCopy(strategy?.recommendedCta) ??
    sanitizeOperatorRecommendationCopy(strategy?.conversationStrategy?.smallestCommitment) ??
    sanitizeOperatorRecommendationCopy(strategy?.operatorReasoning?.smallestCommitment) ??
    "Earn a short workflow review, not a full platform pitch."

  return {
    openingPremise: stripCompanyPrefix(openingPremise, packet.company.name),
    discoveryQuestion: stripCompanyPrefix(discoveryQuestion, packet.company.name),
    proofPoint: proofPoint ? stripCompanyPrefix(proofPoint, packet.company.name) : null,
    desiredNextStep: stripCompanyPrefix(desiredNextStep, packet.company.name),
  }
}

function classifyLineAsVerified(text: string): boolean {
  return !/\b(likely|appears|may|might|suggest|inferred|assume|unknown|hypothesis)\b/i.test(text)
}

function buildEvidenceAndUncertainty(
  packet: Approvals2AOperatorReviewPacket,
): Record<OperatorPackageEvidenceClassification, string[]> {
  const verified = uniqueLines([
    ...packet.explainability.supportingEvidence,
    ...packet.operatorReviewLayout.researchSummary,
    ...(packet.salesStrategy?.evidence.map((row) => row.detail) ?? []),
    ...(packet.salesStrategy?.prospectTruth?.evidence.map((row) => row.detail) ?? []),
    ...packet.evidenceCards.filter((card) => card.present).map((card) => card.detail ?? card.label),
    packet.company.equipmentServiced[0]
      ? `Provides service for ${packet.company.equipmentServiced.slice(0, 3).join(", ")} equipment.`
      : null,
    !/^(unknown|not classified|unclassified)$/i.test(packet.company.industry ?? "")
      ? `Industry context: ${packet.company.industry}.`
      : null,
  ], 8).filter(classifyLineAsVerified)

  const inferred = uniqueLines([
    ...(packet.salesStrategy?.businessProblems ?? []),
    packet.salesStrategy?.prospectTruth?.opportunitySummary,
    packet.salesStrategy?.consultantDiscoveryIntelligence?.consultantHypothesis,
    packet.salesStrategy?.consultantDiscoveryIntelligence?.operationalBottleneck,
    ...(packet.salesStrategy?.prospectTruth?.businessProblems ?? []),
    ...packet.explainability.unknownAssumptions.filter((line) =>
      /\b(likely|appears|may|assume|inferred|hypothesis)\b/i.test(line),
    ),
  ], 6).filter((line) => !classifyLineAsVerified(line))

  const unknown = uniqueLines([
    ...packet.risk.unknownFields.map((field) => humanizeUnknownField(field)),
    ...packet.explainability.unknownAssumptions,
    ...(packet.salesStrategy?.missingPersonalizationOpportunities.map((gap) => gap) ?? []),
  ], 8)

  return {
    verified: verified.slice(0, 4),
    inferred: inferred.slice(0, 4),
    unknown: unknown.slice(0, 4),
  }
}

function humanizeUnknownField(field: string): string {
  return field
    .replace(/^Unknown or incomplete:\s*/i, "")
    .replace(/^Missing personalization:\s*/i, "")
    .replace(/_/g, " ")
    .replace(/\b(email|phone|linkedin|website)\b/i, (match) => match.toLowerCase())
}

function evaluateDraftAlignment(
  packet: Approvals2AOperatorReviewPacket,
  primaryAngle: OperatorPackageRecommendationAngle,
  firstConversation: OperatorPackageFirstConversationStrategy,
): OperatorPackageDraftAlignment {
  const warnings: string[] = []
  const emailDraft = packet.drafts.find((row) => row.channel === "email" && row.prepared)?.preview ?? ""
  const linkedInDraft = packet.drafts.find((row) => row.channel === "linkedin" && row.prepared)?.preview ?? ""
  const callDraft = packet.drafts.find((row) => row.channel === "call" && row.prepared)?.preview ?? ""

  const angleTerms = [
    ...primaryAngle.label.toLowerCase().split(/\s+/),
    ...primaryAngle.rationale.toLowerCase().split(/\s+/),
  ].filter((term) => term.length > 4)

  const draftTexts = [
    { label: "Primary email draft", text: emailDraft },
    { label: "LinkedIn draft", text: linkedInDraft },
    { label: "Call guide", text: callDraft },
  ].filter((row) => row.text.trim())

  for (const draft of draftTexts) {
    const lower = draft.text.toLowerCase()
    const matchesAngle = angleTerms.some((term) => lower.includes(term))
    if (!matchesAngle && draft.label === "Primary email draft") {
      warnings.push(`${draft.label} does not clearly reflect the recommended angle (${primaryAngle.label}).`)
    }
  }

  if (packet.decisionMaker.name?.trim()) {
    const firstName = packet.decisionMaker.name.split(/\s+/)[0]?.toLowerCase()
    if (firstName && emailDraft && !emailDraft.toLowerCase().includes(firstName)) {
      warnings.push("Primary email draft does not reference the recommended buyer by name.")
    }
  }

  if (callDraft) {
    const premiseSnippet = firstConversation.openingPremise.slice(0, 40).toLowerCase()
    if (premiseSnippet.length > 12 && !callDraft.toLowerCase().includes(premiseSnippet.slice(0, 24))) {
      warnings.push("Call guide may use a different opening premise than the package recommendation.")
    }
  }

  if (linkedInDraft && emailDraft) {
    const linkedinLower = linkedInDraft.toLowerCase()
    const emailLower = emailDraft.toLowerCase()
    const sharedTerms = angleTerms.filter((term) => linkedinLower.includes(term) && emailLower.includes(term))
    if (sharedTerms.length === 0) {
      warnings.push("LinkedIn draft may introduce a different strategy than the primary email draft.")
    }
  }

  return {
    aligned: warnings.length === 0,
    warnings,
  }
}

function evaluatePackageQuality(input: {
  executiveRecommendation: string
  whyThisAccount: string[]
  recommendedBuyer: OperatorPackageRecommendation["recommendedBuyer"]
  primaryAngle: OperatorPackageRecommendationAngle
  firstConversation: OperatorPackageFirstConversationStrategy
  evidenceAndUncertainty: Record<OperatorPackageEvidenceClassification, string[]>
  draftAlignment: OperatorPackageDraftAlignment
  confidence: number
}): { state: OperatorPackageQualityState; notes: string[] } {
  const notes: string[] = []
  let score = 0

  if (input.executiveRecommendation.trim()) score += 1
  else notes.push("Executive recommendation is missing.")

  if (input.whyThisAccount.length >= 2) score += 1
  else notes.push("Fewer than two evidence-backed fit reasons are available.")

  if (input.recommendedBuyer.roleRationale.trim()) score += 1
  else notes.push("Buyer rationale is missing.")

  if (input.primaryAngle.label.trim()) score += 1
  else notes.push("Primary angle is not selected.")

  if (input.firstConversation.openingPremise.trim() && input.firstConversation.desiredNextStep.trim()) {
    score += 1
  } else {
    notes.push("First-conversation strategy is incomplete.")
  }

  if (input.evidenceAndUncertainty.verified.length > 0 && input.evidenceAndUncertainty.unknown.length >= 0) {
    score += 1
  } else {
    notes.push("Verified and uncertainty sections are thin.")
  }

  if (!input.draftAlignment.aligned) {
    notes.push(...input.draftAlignment.warnings)
  } else {
    score += 1
  }

  if (UNSUPPORTED_URGENCY.test(input.executiveRecommendation)) {
    notes.push("Executive recommendation contains unsupported urgency language.")
  }

  if (input.confidence < 0.35 || input.evidenceAndUncertainty.verified.length === 0) {
    return { state: "limited_evidence", notes }
  }

  if (score >= 6 && notes.length === 0) {
    return { state: "ready", notes }
  }

  if (score >= 4) {
    return { state: "needs_attention", notes }
  }

  return { state: "limited_evidence", notes }
}

function resolveWeakEvidenceIntro(state: OperatorPackageQualityState): string | null {
  if (state === "limited_evidence") {
    return "This package does not yet have enough evidence for a confident recommendation."
  }
  if (state === "needs_attention") {
    return "Ava found a plausible operational fit, but the evidence is limited. Review the assumptions before authorizing outreach."
  }
  return null
}

export function projectOperatorPackageRecommendation2D(input: {
  packet: Approvals2AOperatorReviewPacket
  summary?: OperatorPackageDecisionSummary | null
}): OperatorPackageRecommendation {
  const packet = input.packet
  const primaryAngle = resolvePrimaryAngle(packet)
  const whyThisAccount = buildWhyThisAccount(packet)
  const whyNow = buildWhyNow(packet)
  const recommendedBuyer = buildRecommendedBuyer(packet)
  const firstConversation = buildFirstConversation(packet, primaryAngle)
  const evidenceAndUncertainty = buildEvidenceAndUncertainty(packet)
  const executiveRecommendation = buildExecutiveRecommendation(packet, primaryAngle, whyThisAccount)
  const draftAlignment = evaluateDraftAlignment(packet, primaryAngle, firstConversation)
  const quality = evaluatePackageQuality({
    executiveRecommendation,
    whyThisAccount,
    recommendedBuyer,
    primaryAngle,
    firstConversation,
    evidenceAndUncertainty,
    draftAlignment,
    confidence: packet.risk.overallConfidence,
  })

  return {
    qaMarker: GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER,
    executiveRecommendation,
    whyThisAccount,
    whyNow: whyNow.text,
    whyNowHasTrigger: whyNow.hasTrigger,
    recommendedBuyer,
    primaryAngle,
    firstConversation,
    evidenceAndUncertainty,
    draftAlignment,
    qualityState: quality.state,
    qualityNotes: quality.notes,
    weakEvidenceIntro: resolveWeakEvidenceIntro(quality.state),
  }
}
