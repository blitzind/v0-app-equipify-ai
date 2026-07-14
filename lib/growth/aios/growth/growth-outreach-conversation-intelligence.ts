/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-1A — Reasoning layer inside Sales Strategy Brief (client-safe).
 * No new persistence. Raw evidence → normalized insight → conversation → drafts.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type {
  EquipifyBuyerPersonaKnowledge,
  EquipifyIndustryKnowledge,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import type {
  GrowthOutreachConversationStrategy,
  GrowthOutreachEvidenceCitation,
  GrowthOutreachProspectTruth,
  GrowthOutreachRelationshipStage,
  GrowthOutreachSellerTruth,
} from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER,
  buildEliteSdrObservationSelection,
  type GrowthOutreachLearningThemeWeight,
  type GrowthOutreachObservationCandidate,
  type GrowthOutreachObservationSelection,
} from "@/lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER,
  buildConsultantDiscoveryIntelligence,
  type GrowthOutreachConsultantDiscoveryIntelligence,
} from "@/lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import {
  GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER,
  buildRevenueStrategyIntelligence,
  type GrowthOutreachRevenueStrategyIntelligence,
  type RevenueStrategyBuyingCommitteeSnapshot,
  type RevenueStrategyDecisionMakerCandidate,
} from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import type { ProspectKnowledgePack } from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"
import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import {
  finalizeRelationshipAssessmentStrategyEvolution,
  mergeRelationshipMemoryObjections,
  type GrowthOutreachRelationshipAssessment,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import {
  applyInstitutionalConfidenceBoost,
} from "@/lib/growth/aios/growth/growth-institutional-learning-1a"
import type { GrowthInstitutionalSalesIntelligence } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER =
  "ge-aios-conversation-intelligence-1a-v1" as const

export { GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER, GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER, GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER }
export type {
  GrowthOutreachLearningThemeWeight,
  GrowthOutreachObservationCandidate,
  GrowthOutreachObservationSelection,
  GrowthOutreachConsultantDiscoveryIntelligence,
  GrowthOutreachRevenueStrategyIntelligence,
  RevenueStrategyBuyingCommitteeSnapshot,
  RevenueStrategyDecisionMakerCandidate,
}

export type GrowthOutreachEvidenceInsight = {
  rawSource: string
  /** Internal only — never in customer-facing copy. */
  internalNote: string
  /** Prospect-safe phrasing for drafts. */
  prospectSafeInsight: string
  whyItMatters: string
  showToProspect: boolean
  strength: "strong" | "moderate" | "weak"
}

export type GrowthOutreachEvidenceIntelligence = {
  insights: GrowthOutreachEvidenceInsight[]
  primaryInsight: string | null
  evidenceSummary: string | null
  strongestThemes: string[]
  weakestThemes: string[]
  /** CONVERSATION-INTELLIGENCE-2A — ranked observations + single selected insight. */
  observationSelection?: GrowthOutreachObservationSelection
  rankedObservations?: GrowthOutreachObservationCandidate[]
  selectedObservation?: GrowthOutreachObservationCandidate | null
  selectionRationale?: string | null
  themeKey?: string | null
}

export type GrowthOutreachPersonaInference = {
  rawTitle: string | null
  normalizedRole: string | null
  matchedPersona: EquipifyBuyerPersonaKnowledge | null
  confidence: number
  caresAbout: string[]
  preferredLanguage: string[]
}

export type GrowthOutreachIndustryInference = {
  inferredIndustry: string | null
  matchedIndustry: EquipifyIndustryKnowledge | null
  confidence: number
  signals: string[]
}

export type GrowthOutreachBusinessOutcomeFocus = {
  primaryOutcome: string
  supportingOutcomes: string[]
  leadWithOutcome: string
  featureMentionAllowed: boolean
}

export type GrowthOutreachConversationRisk = {
  overall: number
  evidenceQuality: number
  sellerKnowledge: number
  industryConfidence: number
  personaConfidence: number
  relationshipConfidence: number
  businessOutcomeConfidence: number
  posture: "curious" | "balanced" | "confident"
  risks: string[]
}

export type GrowthOutreachOperatorReasoning = {
  conversationGoal: string
  businessOutcome: string
  primaryInsight: string | null
  evidenceSummary: string | null
  reasonForCta: string
  conversationRisks: string[]
  intentionallyAvoided: string[]
  smallestCommitment: string
}

const EXECUTIVE_TITLE_PATTERN =
  /\b(president|ceo|chief executive|founder|co-founder|cofounder|owner|principal|managing partner|managing director|partner)\b/i

const OPS_TITLE_PATTERN =
  /\b(coo|chief operating|vp operations|vice president operations|director of (service|operations)|operations manager|service manager)\b/i

const RAW_EVIDENCE_NOISE =
  /^(verified|unverified)\s+(description|product|service|signal|indicator|finding)\s*(\(\d+%\))?\s*:?\s*/i

const INTERNAL_ARTIFACT_PATTERN =
  /\b(\d+%|verified description|unverified|service indicator|company summary|source:|pain point:|extraction|confidence|crawler|provider)\b/i

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\s+/g, " ") : null
}

function unique(lines: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const c = clean(line)
    if (!c) continue
    const key = c.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

export function sanitizeRawEvidenceForProspect(raw: string): string {
  let text = raw.trim()
  text = text.replace(RAW_EVIDENCE_NOISE, "")
  text = text.replace(/\(\d+%\)/g, "")
  text = text.replace(/^(company summary|service indicator|source|pain point):\s*/i, "")
  text = text.replace(/\s*\/\s*verified product:/gi, ". ")
  text = text.replace(/\s+/g, " ").trim()
  if (text.length > 160) {
    const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text
    text = sentence.length > 40 ? sentence : `${text.slice(0, 157).trim()}…`
  }
  return text
}

export function normalizeOperatorResearchLine(raw: string): string | null {
  const sanitized = sanitizeRawEvidenceForProspect(raw)
  if (!sanitized || sanitized.length < 10) return null
  const lower = sanitized.toLowerCase()
  if (/mri|ct|imaging|diagnostic/.test(lower)) {
    return "Public website confirms diagnostic imaging equipment service."
  }
  if (/refurb|oem/.test(lower)) {
    return "Service mix includes refurbished and OEM equipment support."
  }
  if (/hiring|technician|career|biomedical/.test(lower)) {
    return "Careers page signals active hiring for field and depot capacity."
  }
  if (/nationwide|multi.?site|global|healthcare provider/.test(lower)) {
    return "Operates across multiple customer sites at scale."
  }
  if (/depot|field service|lifecycle/.test(lower)) {
    return "Combines depot and field service operations."
  }
  if (/customer portal|online booking/.test(lower)) {
    return "Customer-facing service portal is part of the operating model."
  }
  const sentence = sanitized.charAt(0).toUpperCase() + sanitized.slice(1)
  return sentence.length > 120 ? `${sentence.slice(0, 117).trim()}…` : sentence
}

export function buildOperatorResearchSummaries(
  lines: Array<string | null | undefined>,
  limit = 6,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    if (!line?.trim()) continue
    const normalized = normalizeOperatorResearchLine(line)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= limit) break
  }
  return out
}

function inferThemeFromEvidence(detail: string): {
  prospectSafe: string
  whyItMatters: string
  strength: GrowthOutreachEvidenceInsight["strength"]
} | null {
  const lower = detail.toLowerCase()
  if (/mri|ct|imaging|x-ray|ultrasound|diagnostic imaging|medical imaging/.test(lower)) {
    return {
      prospectSafe: "You support diagnostic imaging equipment across healthcare providers.",
      whyItMatters: "Imaging service operators juggle depot repair, field service, and uptime commitments.",
      strength: "strong",
    }
  }
  if (/refurbish|lifecycle|installed base|depot|field service/.test(lower)) {
    return {
      prospectSafe: "Your model blends equipment lifecycle support with field and depot service.",
      whyItMatters: "Lifecycle operators need visibility from service event through billing.",
      strength: "strong",
    }
  }
  if (/nationwide|multi.?site|global|healthcare provider/.test(lower)) {
    return {
      prospectSafe: "You operate at scale across multiple customer sites.",
      whyItMatters: "Multi-site service visibility is where handoffs usually break down.",
      strength: "moderate",
    }
  }
  if (/hiring|technician|biomedical|engineer|career/.test(lower)) {
    return {
      prospectSafe: "You're growing skilled field and depot capacity.",
      whyItMatters: "Hiring often exposes dispatch and workflow strain before teams catch up.",
      strength: "moderate",
    }
  }
  if (/hvac|plumbing|dispatch|work order/.test(lower)) {
    return {
      prospectSafe: "You run dispatched field service operations.",
      whyItMatters: "Dispatch-to-cash friction shows up as rework and delayed billing.",
      strength: "moderate",
    }
  }
  if (INTERNAL_ARTIFACT_PATTERN.test(detail)) {
    const sanitized = sanitizeRawEvidenceForProspect(detail)
    if (sanitized.length < 24) return null
    return {
      prospectSafe: sanitized.charAt(0).toUpperCase() + sanitized.slice(1),
      whyItMatters: "Public footprint suggests a real service operations motion worth validating.",
      strength: "weak",
    }
  }
  const sanitized = sanitizeRawEvidenceForProspect(detail)
  if (sanitized.length < 20) return null
  return {
    prospectSafe: sanitized.charAt(0).toUpperCase() + sanitized.slice(1),
    whyItMatters: "Worth validating whether this affects day-to-day service coordination.",
    strength: "weak",
  }
}

export function buildEvidenceIntelligence(input: {
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  website?: string | null
  companyName?: string | null
  prospectKnowledgePack?: ProspectKnowledgePack | null
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  matchedIndustry?: EquipifyIndustryKnowledge | null
}): GrowthOutreachEvidenceIntelligence {
  const insights: GrowthOutreachEvidenceInsight[] = []

  for (const row of input.evidence) {
    if (row.source === "Website" && input.website) {
      insights.push({
        rawSource: row.source,
        internalNote: `Website reviewed: ${input.website}`,
        prospectSafeInsight: `Your public footprint shows an active service operation.`,
        whyItMatters: "A real service motion is the baseline for a useful workflow conversation.",
        showToProspect: true,
        strength: "moderate",
      })
      continue
    }
    if (row.source === "Decision maker role") {
      insights.push({
        rawSource: row.source,
        internalNote: row.detail,
        prospectSafeInsight: "Role context suggests influence over service performance and vendor choices.",
        whyItMatters: "Outreach should match how this role measures success.",
        showToProspect: false,
        strength: "moderate",
      })
      continue
    }
    const theme = inferThemeFromEvidence(row.detail)
    if (!theme) continue
    insights.push({
      rawSource: row.source,
      internalNote: row.detail,
      prospectSafeInsight: theme.prospectSafe,
      whyItMatters: theme.whyItMatters,
      showToProspect: theme.strength !== "weak" || !INTERNAL_ARTIFACT_PATTERN.test(row.detail),
      strength: theme.strength,
    })
  }

  for (const item of input.equipment.slice(0, 2)) {
    insights.push({
      rawSource: "Equipment serviced",
      internalNote: item,
      prospectSafeInsight: `Your team services ${item} in the field.`,
      whyItMatters: "Equipment mix shapes dispatch, parts, and technician skill routing.",
      showToProspect: true,
      strength: "strong",
    })
  }

  const prospectSafe = insights.filter((row) => row.showToProspect)
  const observationSelection = buildEliteSdrObservationSelection({
    evidence: input.evidence,
    equipment: input.equipment,
    companyName: input.companyName,
    website: input.website,
    prospectKnowledgePack: input.prospectKnowledgePack,
    learningWeights: input.learningWeights,
    matchedIndustry: input.matchedIndustry,
  })
  const selected = observationSelection.selected
  const primary =
    selected?.consultantObservation ??
    prospectSafe.find((row) => row.strength === "strong")?.prospectSafeInsight ??
    prospectSafe[0]?.prospectSafeInsight ??
    null

  const strongestThemes = unique(
    [
      selected?.consultantObservation ?? null,
      ...insights.filter((r) => r.strength === "strong").map((r) => r.prospectSafeInsight),
    ],
    3,
  )
  const weakestThemes = unique(
    insights.filter((r) => r.strength === "weak").map((r) => r.internalNote),
    3,
  )

  return {
    insights,
    primaryInsight: primary,
    evidenceSummary: selected?.consultantObservation
      ? selected.consultantObservation
      : prospectSafe.length
        ? prospectSafe
            .slice(0, 2)
            .map((r) => r.prospectSafeInsight)
            .join(" ")
        : null,
    strongestThemes,
    weakestThemes,
    observationSelection,
    rankedObservations: observationSelection.candidates,
    selectedObservation: selected,
    selectionRationale: observationSelection.selectionRationale,
    themeKey: observationSelection.themeKey,
  }
}

export function inferPersonaFromTitle(
  title: string | null | undefined,
  personas: EquipifyBuyerPersonaKnowledge[],
): GrowthOutreachPersonaInference {
  const rawTitle = clean(title)
  if (!rawTitle) {
    return {
      rawTitle: null,
      normalizedRole: null,
      matchedPersona: null,
      confidence: 0.35,
      caresAbout: [],
      preferredLanguage: [],
    }
  }

  const lower = rawTitle.toLowerCase()
  let normalizedRole: string | null = null
  let matched: EquipifyBuyerPersonaKnowledge | null = null

  if (EXECUTIVE_TITLE_PATTERN.test(lower)) {
    normalizedRole = "Executive decision maker"
    matched =
      personas.find((p) => /owner/i.test(p.persona)) ??
      personas.find((p) => /coo/i.test(p.persona)) ??
      null
  } else if (OPS_TITLE_PATTERN.test(lower)) {
    normalizedRole = "Operations leader"
    matched =
      personas.find((p) => /operations manager|service manager/i.test(p.persona)) ??
      personas.find((p) => /coo/i.test(p.persona)) ??
      null
  } else if (/dispatch/i.test(lower)) {
    normalizedRole = "Dispatch leader"
    matched = personas.find((p) => /dispatcher/i.test(p.persona)) ?? null
  } else if (/cfo|controller|finance/i.test(lower)) {
    normalizedRole = "Finance leader"
    matched = personas.find((p) => /cfo|controller/i.test(p.persona)) ?? null
  } else if (/director|vp|manager/i.test(lower)) {
    normalizedRole = "Functional leader"
    matched = personas.find((p) => /service manager|operations manager/i.test(p.persona)) ?? null
  }

  if (!matched) {
    matched =
      personas.find((row) =>
        row.persona
          .toLowerCase()
          .split("/")
          .some((part) => lower.includes(part.trim())),
      ) ?? null
  }

  const confidence = matched ? (normalizedRole ? 0.88 : 0.72) : 0.45

  return {
    rawTitle,
    normalizedRole,
    matchedPersona: matched,
    confidence,
    caresAbout: matched?.desiredBusinessOutcomes ?? [],
    preferredLanguage: matched?.preferredLanguage ?? [],
  }
}

const INDUSTRY_SIGNAL_RULES: Array<{
  industry: string
  patterns: RegExp[]
  weight: number
}> = [
  {
    industry: "Biomedical and medical equipment service",
    patterns: [/imaging|mri|ct|x-ray|ultrasound|biomedical|medical equipment|healthcare|hospital|diagnostic/i],
    weight: 3,
  },
  {
    industry: "Medical Imaging",
    patterns: [/imaging|mri|ct|refurbish|diagnostic imaging|block imaging/i],
    weight: 4,
  },
  {
    industry: "HVAC service",
    patterns: [/hvac|heating|cooling|rooftop|truck roll/i],
    weight: 3,
  },
  {
    industry: "Industrial equipment service",
    patterns: [/industrial|compressor|pump|forklift|depot repair|installed base/i],
    weight: 2,
  },
  {
    industry: "Facilities maintenance",
    patterns: [/facilities|building systems|property maintenance/i],
    weight: 2,
  },
]

export function inferIndustryFromSignals(input: {
  hintIndustry?: string | null
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  companyName?: string | null
  website?: string | null
  canonicalIndustries: EquipifyIndustryKnowledge[]
}): GrowthOutreachIndustryInference {
  const corpus = [
    input.hintIndustry ?? "",
    input.companyName ?? "",
    input.website ?? "",
    ...input.evidence.map((e) => e.detail),
    ...input.equipment,
  ]
    .join(" ")
    .toLowerCase()

  const scores = new Map<string, { score: number; signals: string[] }>()

  for (const rule of INDUSTRY_SIGNAL_RULES) {
    const hits = rule.patterns.filter((p) => p.test(corpus)).map((p) => p.source)
    if (!hits.length) continue
    const prev = scores.get(rule.industry) ?? { score: 0, signals: [] }
    scores.set(rule.industry, {
      score: prev.score + rule.weight * hits.length,
      signals: [...prev.signals, ...hits],
    })
  }

  let bestIndustry: string | null = null
  let bestScore = 0
  let bestSignals: string[] = []
  for (const [industry, row] of scores) {
    if (row.score > bestScore) {
      bestIndustry = industry
      bestScore = row.score
      bestSignals = row.signals
    }
  }

  const matchedIndustry =
    input.canonicalIndustries.find((row) => row.industry === bestIndustry) ??
    input.canonicalIndustries.find((row) =>
      bestIndustry ? row.industry.toLowerCase().includes(bestIndustry.toLowerCase().slice(0, 12)) : false,
    ) ??
    null

  const confidence = bestScore >= 8 ? 0.92 : bestScore >= 4 ? 0.78 : bestScore >= 2 ? 0.58 : 0.4

  return {
    inferredIndustry: matchedIndustry?.industry ?? bestIndustry,
    matchedIndustry,
    confidence,
    signals: unique(bestSignals, 6),
  }
}

export function deriveBusinessOutcomeFocus(input: {
  persona: GrowthOutreachPersonaInference
  industry: GrowthOutreachIndustryInference
  evidence: GrowthOutreachEvidenceIntelligence
  seller: GrowthOutreachSellerTruth
}): GrowthOutreachBusinessOutcomeFocus {
  const personaOutcome = input.persona.matchedPersona?.desiredBusinessOutcomes[0]
  const industryOutcome = input.industry.matchedIndustry?.ownerPriorities[0]

  const outcomeCandidates = unique(
    [
      input.evidence.selectedObservation?.businessOutcome,
      /imaging|medical|biomedical/i.test(input.industry.inferredIndustry ?? "")
        ? "Keep imaging uptime and depot turnaround predictable as installed base grows"
        : null,
      personaOutcome,
      industryOutcome,
      /multi.?site|nationwide|global/i.test(input.evidence.evidenceSummary ?? "")
        ? "Maintain workflow consistency across sites without adding admin drag"
        : null,
      input.evidence.strongestThemes[0]?.includes("hiring")
        ? "Absorb technician growth without dispatch chaos"
        : null,
      "Reduce quiet delay between field completion and billing readiness",
      "Improve dispatch-to-cash visibility without ripping out current systems",
      input.seller.businessOutcomes[0]?.replace(/^Help customers resolve:\s*/i, ""),
    ],
    4,
  )

  const primaryOutcome = outcomeCandidates[0] ?? "Clarify whether service workflow friction is costing time or margin"
  const leadWithOutcome = primaryOutcome.replace(/\.$/, "")

  return {
    primaryOutcome,
    supportingOutcomes: outcomeCandidates.slice(1),
    leadWithOutcome,
    featureMentionAllowed: false,
  }
}

export function buildDynamicObjections(input: {
  persona: GrowthOutreachPersonaInference
  industry: GrowthOutreachIndustryInference
  seller: GrowthOutreachSellerTruth
  businessOutcome: string
  posture: GrowthOutreachConversationRisk["posture"]
}): Array<{ objection: string; response: string }> {
  const educate =
    "Acknowledge it, return to the specific workflow outcome, and keep the next step small."

  const profileObjections = input.seller.objections.slice(0, 2)
  const industryObjections =
    input.industry.matchedIndustry?.typicalObjections.slice(0, 2).map((objection) => ({
      objection,
      response: educate,
    })) ?? []

  const dynamic = [
    {
      objection: "We already have software for this.",
      response:
        "Fair — most teams do. The useful question is whether handoffs and visibility still create quiet delay between field work and billing.",
    },
    {
      objection: "Implementation would be too disruptive.",
      response:
        "Understood. A short comparison usually clarifies whether the friction is big enough to warrant any change — no rip-and-replace implied.",
    },
    {
      objection: "Not a priority right now.",
      response: `Makes sense. If ${input.businessOutcome.toLowerCase()} becomes noisy this quarter, a small working session is an easy restart.`,
    },
    {
      objection: "We built our own tools.",
      response:
        "That often works until scale adds coordination cost. Happy to compare notes on where homegrown tools usually strain first.",
    },
    {
      objection: "I'm not convinced this is a problem.",
      response:
        input.posture === "curious"
          ? "That's reasonable — I'd rather validate whether there's friction than assume there is."
          : "Worth pressure-testing with one concrete workflow question before deciding.",
    },
  ]

  return unique(
    [...dynamic, ...profileObjections, ...industryObjections].map((row) => JSON.stringify(row)),
    5,
  ).map((row) => JSON.parse(row) as { objection: string; response: string })
}

export function pickDynamicCta(input: {
  seller: GrowthOutreachSellerTruth
  posture: GrowthOutreachConversationRisk["posture"]
  businessOutcome: string
  relationshipStage: GrowthOutreachRelationshipStage
  hasStrongEvidence: boolean
}): { cta: string; reason: string; smallestCommitment: string } {
  if (input.posture === "curious" && !input.hasStrongEvidence) {
    return {
      cta: "Quick question",
      reason: "Evidence is thin — curiosity beats a meeting ask.",
      smallestCommitment: "A one-line reply validating or correcting one assumption.",
    }
  }

  if (/implementation|disrupt|priority/i.test(input.businessOutcome)) {
    return {
      cta: "Validate one operational assumption",
      reason: "Low-pressure framing when change tolerance is unclear.",
      smallestCommitment: "One email reply confirming or correcting a workflow detail.",
    }
  }

  if (input.relationshipStage === "Engaged" || input.relationshipStage === "Interested") {
    return {
      cta: "Compare workflows",
      reason: "Relationship is warming — peer comparison is appropriate.",
      smallestCommitment: "15-minute working session.",
    }
  }

  if (input.hasStrongEvidence) {
    return {
      cta: "Discuss one operational issue",
      reason: "Strong evidence supports a focused issue conversation, not a product tour.",
      smallestCommitment: "Short call about one workflow handoff.",
    }
  }

  const sellerCta = input.seller.ctaPreferences.find(
    (row) => !/15-minute workflow review/i.test(row),
  )
  if (sellerCta) {
    return {
      cta: sellerCta,
      reason: "Seller profile CTA preference after outcome framing.",
      smallestCommitment: sellerCta,
    }
  }

  return {
    cta: "Exchange observations",
    reason: "Default smallest consultative step when evidence is moderate.",
    smallestCommitment: "Brief async exchange — no demo required.",
  }
}

export function scoreConversationRisk(input: {
  evidence: GrowthOutreachEvidenceIntelligence
  sellerKnowledgeScore: number
  industry: GrowthOutreachIndustryInference
  persona: GrowthOutreachPersonaInference
  relationshipStage: GrowthOutreachRelationshipStage
  businessOutcomeConfidence: number
  baseConfidence: number
}): GrowthOutreachConversationRisk {
  const evidenceQuality =
    input.evidence.insights.length === 0
      ? 0.35
      : input.evidence.insights.some((r) => r.strength === "strong")
        ? 0.85
        : 0.62

  const relationshipConfidence =
    input.relationshipStage === "Cold"
      ? 0.45
      : input.relationshipStage === "Aware"
        ? 0.55
        : input.relationshipStage === "Interested" || input.relationshipStage === "Engaged"
          ? 0.78
          : 0.5

  const overall = Math.min(
    0.95,
    (evidenceQuality +
      input.sellerKnowledgeScore +
      input.industry.confidence +
      input.persona.confidence +
      relationshipConfidence +
      input.businessOutcomeConfidence +
      input.baseConfidence) /
      7,
  )

  const posture: GrowthOutreachConversationRisk["posture"] =
    overall < 0.58 ? "curious" : overall >= 0.8 ? "confident" : "balanced"

  const risks = unique(
    [
      input.evidence.weakestThemes[0] ? `Weak evidence: ${input.evidence.weakestThemes[0]}` : null,
      input.persona.confidence < 0.6 ? "Persona match uncertain — keep role language broad." : null,
      input.industry.confidence < 0.6 ? "Industry inference soft — avoid vertical jargon." : null,
      posture === "curious" ? "Low confidence — ask more than you assert." : null,
    ],
    4,
  )

  return {
    overall,
    evidenceQuality,
    sellerKnowledge: input.sellerKnowledgeScore,
    industryConfidence: input.industry.confidence,
    personaConfidence: input.persona.confidence,
    relationshipConfidence,
    businessOutcomeConfidence: input.businessOutcomeConfidence,
    posture,
    risks,
  }
}

export function buildOperatorReasoning(input: {
  conversationGoal: string
  businessOutcome: string
  evidence: GrowthOutreachEvidenceIntelligence
  cta: string
  ctaReason: string
  risks: GrowthOutreachConversationRisk
  doNotDiscuss: string[]
  smallestCommitment: string
}): GrowthOutreachOperatorReasoning {
  return {
    conversationGoal: input.conversationGoal,
    businessOutcome: input.businessOutcome,
    primaryInsight: input.evidence.primaryInsight,
    evidenceSummary: input.evidence.evidenceSummary,
    reasonForCta: input.ctaReason,
    conversationRisks: input.risks.risks,
    intentionallyAvoided: input.doNotDiscuss.slice(0, 6),
    smallestCommitment: input.smallestCommitment,
  }
}

export function enhanceConversationStrategy(input: {
  base: GrowthOutreachConversationStrategy
  evidence: GrowthOutreachEvidenceIntelligence
  persona: GrowthOutreachPersonaInference
  industry: GrowthOutreachIndustryInference
  outcome: GrowthOutreachBusinessOutcomeFocus
  risks: GrowthOutreachConversationRisk
  cta: string
  companyName: string
  dmName: string | null
}): GrowthOutreachConversationStrategy {
  const grateful =
    input.outcome.leadWithOutcome && input.evidence.primaryInsight
      ? `They would appreciate a short note that respects their time — one observation about ${input.outcome.leadWithOutcome.toLowerCase()}, not a platform pitch.`
      : input.base.gratefulReplyOutcome

  return {
    ...input.base,
    whyThisCompany:
      input.evidence.primaryInsight ??
      input.base.whyThisCompany,
    whyThisPerson: input.persona.normalizedRole
      ? `${input.dmName ?? "This contact"} is best approached as an ${input.persona.normalizedRole.toLowerCase()} — ${input.persona.matchedPersona?.conversationStyle ?? "keep it practical and outcome-led."}`
      : input.base.whyThisPerson,
    businessOutcomeThatMatters: input.outcome.primaryOutcome,
    conversationJustification: [
      `One respectful opening for ${input.companyName}:`,
      `lead with ${input.outcome.leadWithOutcome.toLowerCase()}`,
      input.evidence.primaryInsight
        ? `grounded in the observation that ${input.evidence.primaryInsight.charAt(0).toLowerCase()}${input.evidence.primaryInsight.slice(1)}`
        : "grounded in public service signals",
      `— then see if ${input.cta.toLowerCase()} is worth their time.`,
    ].join(" "),
    conversationThatEarnsReply:
      input.risks.posture === "curious"
        ? `A curious, specific question about ${input.outcome.leadWithOutcome.toLowerCase()} — not a pitch.`
        : input.base.conversationThatEarnsReply,
    gratefulReplyOutcome: grateful,
    strongestEvidence: input.evidence.strongestThemes,
    weakestEvidence: input.evidence.weakestThemes,
    safestRecommendation: input.cta,
    smallestCommitment: input.cta,
    conversationGoal: `Validate whether ${input.outcome.leadWithOutcome.toLowerCase()} is worth a short conversation.`,
    primaryInsight: input.evidence.primaryInsight,
    evidenceSummary: input.evidence.evidenceSummary,
    reasonForCta: input.risks.posture === "curious" ? "Curious posture — smallest ask." : "Outcome-led smallest next step.",
    conversationRisks: input.risks.risks,
    intentionallyAvoided: input.base.doNotDiscuss.slice(0, 6),
  }
}

const FORBIDDEN_DRAFT_PATTERNS = [
  /verified description/i,
  /\(\d+%\)/,
  /unverified/i,
  /service indicator:/i,
  /company summary:/i,
  /growth 5f|draft factory|sendr|pilot run/i,
  /hope you(?:'|’)re doing well/i,
  /hope this finds you well/i,
  /\bi noticed\b/i,
  /wanted to reach out/i,
  /i came across\b/i,
  /i wanted to introduce/i,
  /i thought i(?:'|’)d connect/i,
  /based on my research/i,
  /based on my analysis/i,
  /i analyzed your website/i,
  /our ai noticed/i,
  /our system found/i,
  /our research determined/i,
  /using artificial intelligence/i,
  /confidence score|fit score|evidence rating/i,
  /\bwe help\b/i,
  /\bi help companies\b/i,
  /\bour platform\b/i,
  /\bi'd appreciate\b/i,
  /quick 15 minutes/i,
  /following up/i,
  /\bsomething i kept coming back to\b/i,
  /\bone thing that stood out\b/i,
  /\bit looks like\b/i,
  /\bfrom what i found\b/i,
  /\bwhile researching\b/i,
]

export function reviewOutreachDraftCopy(text: string): string[] {
  const failures: string[] = []
  for (const pattern of FORBIDDEN_DRAFT_PATTERNS) {
    if (pattern.test(text)) failures.push(`draft_review:${pattern.source}`)
  }
  return failures
}

export function assertNoRawResearchLeakage(text: string): boolean {
  return !FORBIDDEN_DRAFT_PATTERNS.slice(0, 5).some((p) => p.test(text))
}

export function resolveCanonicalIndustries(
  profile: BusinessProfileDraftContent | null | undefined,
): EquipifyIndustryKnowledge[] {
  return profile?.canonicalSellerKnowledge?.industries ?? []
}

export function resolveCanonicalPersonas(
  profile: BusinessProfileDraftContent | null | undefined,
): EquipifyBuyerPersonaKnowledge[] {
  return profile?.canonicalSellerKnowledge?.personas ?? []
}

export function enrichOutreachSalesStrategyBrief(input: {
  brief: {
    leadId: string
    companyName: string
    preparedAt: string
    executiveSummary: string
    businessProblems: string[]
    evidence: GrowthOutreachEvidenceCitation[]
    decisionMakerAnalysis: {
      name: string | null
      title: string | null
      whyThisPerson: string
      likelyResponsibilities: string[]
      whyTheyCare: string
    }
    recommendedConversation: string
    primaryHook: string
    businessValue: string
    trustBuilders: string[]
    objections: Array<{ objection: string; response: string }>
    recommendedCta: string
    conversationObjective: string
    businessObjective: string
    conversationJustification?: string
    relationshipStage?: GrowthOutreachRelationshipStage
    tone: string
    confidence: number
    missingPersonalizationOpportunities: string[]
    sellerTruth?: GrowthOutreachSellerTruth
    prospectTruth?: GrowthOutreachProspectTruth
    conversationStrategy?: GrowthOutreachConversationStrategy
    sellerKnowledgeQuality?: import("@/lib/growth/business-profile/equipify-master-knowledge-quality").GrowthOutreachSellerKnowledgeQuality
  }
  approvedProfile?: BusinessProfileDraftContent | null
  website?: string | null
  contactTitle?: string | null
  equipmentServiced?: string[]
  industryHint?: string | null
  prospectKnowledgePack?: ProspectKnowledgePack | null
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  relationshipStrengthTier?: string | null
  opportunityReadinessScore?: number | null
  decisionMakers?: RevenueStrategyDecisionMakerCandidate[]
  buyingCommitteeSnapshot?: RevenueStrategyBuyingCommitteeSnapshot | null
  communicationChannelHint?: string | null
  relationshipAssessment?: GrowthOutreachRelationshipAssessment | null
  leadMemory?: GrowthLeadMemoryInfluenceContext | null
  institutionalLearning?: GrowthInstitutionalSalesIntelligence | null
}): {
  businessProblems: string[]
  primaryHook: string
  businessValue: string
  trustBuilders: string[]
  objections: Array<{ objection: string; response: string }>
  recommendedCta: string
  conversationObjective: string
  businessObjective: string
  conversationJustification: string
  confidence: number
  decisionMakerAnalysis: typeof input.brief.decisionMakerAnalysis
  sellerTruth?: GrowthOutreachSellerTruth
  conversationStrategy: GrowthOutreachConversationStrategy
  evidenceIntelligence: GrowthOutreachEvidenceIntelligence
  conversationRisk: GrowthOutreachConversationRisk
  operatorReasoning: GrowthOutreachOperatorReasoning
  consultantDiscoveryIntelligence: GrowthOutreachConsultantDiscoveryIntelligence | null
  revenueStrategyIntelligence: GrowthOutreachRevenueStrategyIntelligence | null
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
} {
  const seller = input.brief.sellerTruth!
  const prospect = input.brief.prospectTruth!
  const equipment = input.equipmentServiced ?? []
  const relationshipStage =
    input.brief.relationshipStage ?? prospect.relationshipStage ?? "Cold"

  const persona = inferPersonaFromTitle(
    input.contactTitle ?? input.brief.decisionMakerAnalysis.title,
    resolveCanonicalPersonas(input.approvedProfile),
  )

  const industry = inferIndustryFromSignals({
    hintIndustry: input.industryHint,
    evidence: input.brief.evidence,
    equipment,
    companyName: input.brief.companyName,
    website: input.website,
    canonicalIndustries: resolveCanonicalIndustries(input.approvedProfile),
  })

  const evidenceIntelligence = buildEvidenceIntelligence({
    evidence: input.brief.evidence,
    equipment,
    website: input.website,
    companyName: input.brief.companyName,
    prospectKnowledgePack: input.prospectKnowledgePack,
    learningWeights: input.learningWeights,
    matchedIndustry: industry.matchedIndustry,
  })

  const outcome = deriveBusinessOutcomeFocus({
    persona,
    industry,
    evidence: evidenceIntelligence,
    seller,
  })

  const sellerKnowledgeScore =
    input.brief.sellerKnowledgeQuality?.overallScore ??
    (seller.source === "approved_business_profile" ? 0.82 : 0.45)

  const conversationRisk = scoreConversationRisk({
    evidence: evidenceIntelligence,
    sellerKnowledgeScore,
    industry,
    persona,
    relationshipStage,
    businessOutcomeConfidence: outcome.primaryOutcome ? 0.78 : 0.5,
    baseConfidence: input.brief.confidence,
  })

  const dynamicCta = pickDynamicCta({
    seller,
    posture: conversationRisk.posture,
    businessOutcome: outcome.primaryOutcome,
    relationshipStage,
    hasStrongEvidence: evidenceIntelligence.strongestThemes.length > 0,
  })

  const objections = mergeRelationshipMemoryObjections(
    buildDynamicObjections({
      persona,
      industry,
      seller,
      businessOutcome: outcome.primaryOutcome,
      posture: conversationRisk.posture,
    }),
    input.leadMemory,
  )

  const businessProblems = unique(
    [
      outcome.primaryOutcome.endsWith(".") ? outcome.primaryOutcome : `${outcome.primaryOutcome}.`,
      ...outcome.supportingOutcomes.slice(0, 2).map((line) => (line.endsWith(".") ? line : `${line}.`)),
      equipment.length
        ? `Keeping ${equipment.slice(0, 2).join(" / ")} service operations consistent as volume shifts.`
        : null,
    ],
    4,
  )

  const company = input.brief.companyName
  const dmName = input.brief.decisionMakerAnalysis.name
  const sellerName = seller.sellerCompanyName || "Equipify"

  const primaryHook =
    evidenceIntelligence.primaryInsight && outcome.leadWithOutcome
      ? `${company} — ${outcome.leadWithOutcome.toLowerCase()} looks like the right opening given your service footprint.`
      : input.brief.primaryHook

  const businessValue =
    conversationRisk.posture === "curious"
      ? `Worth a short exchange on whether ${outcome.leadWithOutcome.toLowerCase()} is actually a friction point — ${sellerName} compares notes with similar operators, no product tour implied.`
      : `${outcome.leadWithOutcome} — if that's on your radar, ${sellerName} is worth a brief comparison with how similar teams coordinate field and depot work.`

  const trustBuilders = unique(
    [
      input.website ? `Public footprint reviewed` : null,
      equipment[0] ? `Equipment focus: ${equipment.join(", ")}` : null,
      evidenceIntelligence.primaryInsight,
      persona.normalizedRole ? `Role context: ${persona.normalizedRole}` : null,
      industry.inferredIndustry ? `Industry context: ${industry.inferredIndustry}` : null,
      dmName ? `Decision-maker context prepared for ${dmName}` : null,
    ],
    6,
  )

  const recommendedConversation = `Whether ${outcome.leadWithOutcome.toLowerCase()} is worth a focused conversation for ${company}.`

  const baseStrategy =
    input.brief.conversationStrategy ??
    ({
      whyThisCompany: evidenceIntelligence.primaryInsight ?? "",
      whyThisPerson: input.brief.decisionMakerAnalysis.whyThisPerson,
      whyNow: "",
      whySeller: "",
      whyThisConversation: recommendedConversation,
      conversationJustification: input.brief.conversationJustification ?? "",
      businessOutcomeThatMatters: outcome.primaryOutcome,
      doNotDiscuss: [],
      supportingEvidence: [],
      remainingAssumptions: [],
      missingInformation: [],
      conversationThatEarnsReply: primaryHook,
      relationshipStage,
    } satisfies GrowthOutreachConversationStrategy)

  const conversationStrategy = enhanceConversationStrategy({
    base: baseStrategy,
    evidence: evidenceIntelligence,
    persona,
    industry,
    outcome,
    risks: conversationRisk,
    cta: dynamicCta.cta,
    companyName: company,
    dmName,
  })

  conversationStrategy.reasonForCta = dynamicCta.reason
  conversationStrategy.smallestCommitment = dynamicCta.smallestCommitment

  const operatorReasoning = buildOperatorReasoning({
    conversationGoal: conversationStrategy.conversationGoal ?? recommendedConversation,
    businessOutcome: outcome.primaryOutcome,
    evidence: evidenceIntelligence,
    cta: dynamicCta.cta,
    ctaReason: dynamicCta.reason,
    risks: conversationRisk,
    doNotDiscuss: conversationStrategy.doNotDiscuss,
    smallestCommitment: dynamicCta.smallestCommitment,
  })

  const updatedSellerTruth: GrowthOutreachSellerTruth = {
    ...seller,
    matchedPersona: persona.matchedPersona?.persona ?? seller.matchedPersona,
    matchedIndustryKnowledge: industry.matchedIndustry?.industry ?? industry.inferredIndustry ?? seller.matchedIndustryKnowledge,
  }

  const whyTheyCare = persona.matchedPersona?.desiredBusinessOutcomes[0]
    ? `${persona.normalizedRole ?? "This role"} typically cares about ${persona.matchedPersona.desiredBusinessOutcomes[0].toLowerCase()}.`
    : input.brief.decisionMakerAnalysis.whyTheyCare

  const consultantDiscoveryIntelligence = buildConsultantDiscoveryIntelligence({
    selectedObservation: evidenceIntelligence.selectedObservation ?? null,
    evidence: input.brief.evidence,
    equipment,
    companyName: company,
    leadId: input.brief.leadId,
    sellerTruth: updatedSellerTruth,
    persona,
    industry,
    learningWeights: input.learningWeights,
    posture: conversationRisk.posture,
    answeredThemes: input.relationshipAssessment?.answeredThemes ?? input.leadMemory?.avoidRepeating,
    relationshipConfidence: input.relationshipAssessment?.relationshipConfidence.level,
  })

  const revenueStrategyIntelligence = buildRevenueStrategyIntelligence({
    leadId: input.brief.leadId,
    companyName: company,
    primaryDmName: dmName,
    primaryDmTitle: input.brief.decisionMakerAnalysis.title,
    decisionMakers: input.decisionMakers,
    relationshipStage,
    relationshipStrengthTier: input.relationshipStrengthTier,
    opportunityReadinessScore: input.opportunityReadinessScore,
    missingEvidence: input.brief.missingPersonalizationOpportunities,
    evidenceIntelligence,
    consultantDiscoveryIntelligence,
    conversationRisk,
    sellerTruth: updatedSellerTruth,
    sellerKnowledgeQuality: input.brief.sellerKnowledgeQuality,
    persona,
    buyingCommitteeSnapshot: input.buyingCommitteeSnapshot ?? null,
    communicationChannelHint: input.communicationChannelHint ?? null,
    relationshipAssessment: input.relationshipAssessment ?? null,
    institutionalLearning: input.institutionalLearning ?? null,
  })

  const relationshipAssessment = input.relationshipAssessment
    ? finalizeRelationshipAssessmentStrategyEvolution(input.relationshipAssessment, {
        currentRecommendation: revenueStrategyIntelligence.recommendation,
        currentConfidence: revenueStrategyIntelligence.confidenceScore,
        previousRecommendation: input.relationshipAssessment.strategyEvolution.previousRecommendation,
        previousConfidence: input.relationshipAssessment.previousStrategyConfidence,
      })
    : null

  return {
    businessProblems,
    primaryHook,
    businessValue,
    trustBuilders,
    objections,
    recommendedCta: dynamicCta.cta,
    conversationObjective: recommendedConversation,
    businessObjective: outcome.primaryOutcome,
    conversationJustification: conversationStrategy.conversationJustification,
    confidence: applyInstitutionalConfidenceBoost(
      conversationRisk.overall,
      input.institutionalLearning,
    ),
    decisionMakerAnalysis: {
      ...input.brief.decisionMakerAnalysis,
      whyThisPerson: persona.normalizedRole
        ? `${dmName ?? "This contact"} (${input.brief.decisionMakerAnalysis.title ?? "title on file"}) — approach as ${persona.normalizedRole.toLowerCase()}.`
        : input.brief.decisionMakerAnalysis.whyThisPerson,
      whyTheyCare,
      likelyResponsibilities: unique(
        [
          persona.normalizedRole === "Executive decision maker"
            ? "Overall business and service performance"
            : null,
          persona.normalizedRole === "Operations leader"
            ? "Day-to-day service operations and capacity"
            : null,
          ...(persona.matchedPersona?.desiredBusinessOutcomes.slice(0, 2) ?? []),
          equipment.length ? "Equipment service quality and uptime" : null,
        ],
        4,
      ),
    },
    sellerTruth: updatedSellerTruth,
    conversationStrategy,
    evidenceIntelligence,
    conversationRisk,
    operatorReasoning,
    consultantDiscoveryIntelligence,
    revenueStrategyIntelligence,
    relationshipAssessment,
  }
}
