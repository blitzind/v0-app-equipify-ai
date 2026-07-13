/**
 * GE-AIOS-OUTREACH-QUALITY-1A / SALES-PLAYBOOK-1B — Sales Strategy Brief (client-safe).
 * Think first: Prospect Truth + Seller Truth → Conversation Strategy → drafts.
 */

import {
  buildOutreachConversationStrategy,
  buildOutreachSellerTruth,
  deriveOutreachRelationshipStage,
  type GrowthOutreachConversationStrategy,
  type GrowthOutreachEvidenceCitation,
  type GrowthOutreachProspectTruth,
  type GrowthOutreachRelationshipStage,
  type GrowthOutreachSellerTruth,
} from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthOutreachSellerKnowledgeQuality } from "@/lib/growth/business-profile/equipify-master-knowledge-quality"
import { scoreOutreachSellerKnowledgeQuality } from "@/lib/growth/business-profile/equipify-master-knowledge-quality"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER,
  GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER,
  enrichOutreachSalesStrategyBrief,
  type GrowthOutreachConsultantDiscoveryIntelligence,
  type GrowthOutreachRevenueStrategyIntelligence,
  type RevenueStrategyBuyingCommitteeSnapshot,
  type RevenueStrategyDecisionMakerCandidate,
  type GrowthOutreachConversationRisk,
  type GrowthOutreachEvidenceIntelligence,
  type GrowthOutreachLearningThemeWeight,
  type GrowthOutreachOperatorReasoning,
} from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { ProspectKnowledgePack } from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"

export type { GrowthOutreachEvidenceCitation }
export {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER,
  GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER,
}

export const GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER =
  "ge-aios-outreach-quality-1a-human-sales-communication-engine-v1" as const

export const GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION =
  "outreach-sales-strategy-brief-v4" as const

export type GrowthOutreachSalesStrategyBrief = {
  version: typeof GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION
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
  /** SALES-PLAYBOOK-1B — keep seller / prospect / conversation distinct. Optional on legacy packages. */
  sellerTruth?: GrowthOutreachSellerTruth
  prospectTruth?: GrowthOutreachProspectTruth
  conversationStrategy?: GrowthOutreachConversationStrategy
  /** MASTER-KNOWLEDGE-1A — pre-draft seller knowledge quality (identifies gaps, never fabricates). */
  sellerKnowledgeQuality?: GrowthOutreachSellerKnowledgeQuality
  /** CONVERSATION-INTELLIGENCE-1A — sanitized evidence + operator reasoning. */
  evidenceIntelligence?: GrowthOutreachEvidenceIntelligence
  conversationRisk?: GrowthOutreachConversationRisk
  operatorReasoning?: GrowthOutreachOperatorReasoning
  /** CONVERSATION-INTELLIGENCE-3A — consultant discovery conclusions (internal). */
  consultantDiscoveryIntelligence?: GrowthOutreachConsultantDiscoveryIntelligence | null
  /** REVENUE-STRATEGY-1A — VP-of-Sales pre-outreach strategy (internal). */
  revenueStrategyIntelligence?: GrowthOutreachRevenueStrategyIntelligence | null
}

export type BuildSalesStrategyBriefInput = {
  leadId: string
  companyName: string
  preparedAt: string
  website?: string | null
  contactName?: string | null
  contactTitle?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  location?: string | null
  employees?: string | null
  revenueEstimate?: string | null
  equipmentServiced?: string[]
  verifiedEvidence?: string[]
  missingEvidence?: string[]
  assumptions?: string[]
  opportunitySummary?: string | null
  fitReason?: string | null
  qualificationConfidence?: number | null
  researchConfidence?: number | null
  personalizationSignals?: string[]
  industry?: string | null
  relationshipStrengthTier?: string | null
  contactTemperature?: string | null
  leadStatus?: string | null
  hasMeetingScheduled?: boolean
  isCustomer?: boolean
  /** Preloaded seller truth (preferred). */
  sellerTruth?: GrowthOutreachSellerTruth | null
  /** Enriched approved profile used for quality scoring. */
  approvedProfile?: BusinessProfileDraftContent | null
  approvedProfileId?: string | null
  sellerCompanyName?: string | null
  biEnrichmentLines?: string[]
  organizationalKnowledge?: OrganizationalKnowledgeItem[]
  knowledgeCenterLines?: string[]
  industryPlaybook?: GrowthIndustryPlaybook | null
  /** CONVERSATION-INTELLIGENCE-2A — structured research observations (existing research run). */
  prospectKnowledgePack?: ProspectKnowledgePack | null
  /** CONVERSATION-INTELLIGENCE-2A — advisory opener theme weights from sequence optimization. */
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  /** REVENUE-STRATEGY-1A — optional pre-outreach strategy inputs. */
  relationshipStrengthTier?: string | null
  opportunityReadinessScore?: number | null
  decisionMakers?: RevenueStrategyDecisionMakerCandidate[]
  buyingCommitteeSnapshot?: RevenueStrategyBuyingCommitteeSnapshot | null
  communicationChannelHint?: string | null
}

function cleanLine(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\s+/g, " ")
}

function uniqueLines(lines: Array<string | null | undefined>, limit = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const cleaned = cleanLine(line)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= limit) break
  }
  return out
}

function evidenceFromSignals(input: BuildSalesStrategyBriefInput): GrowthOutreachEvidenceCitation[] {
  const citations: GrowthOutreachEvidenceCitation[] = []
  if (input.website) {
    citations.push({ source: "Website", detail: input.website })
  }
  for (const item of input.equipmentServiced ?? []) {
    citations.push({ source: "Equipment serviced", detail: item })
  }
  if (input.industry) {
    citations.push({ source: "Industries served", detail: input.industry })
  }
  if (input.contactName || input.contactTitle) {
    citations.push({
      source: "Decision maker role",
      detail: [input.contactName, input.contactTitle].filter(Boolean).join(" · "),
    })
  }
  for (const line of input.verifiedEvidence ?? []) {
    const lower = line.toLowerCase()
    let source = "Research findings"
    if (/website|site/.test(lower)) source = "Website"
    else if (/pricing|price/.test(lower)) source = "Service pages"
    else if (/career|hiring|job/.test(lower)) source = "Hiring"
    else if (/linkedin/.test(lower)) source = "LinkedIn"
    else if (/service indicator|equipment|mri|ct|imaging|fleet/.test(lower)) source = "Equipment serviced"
    else if (/pain|growth|expand|news/.test(lower)) source = "Growth signals"
    citations.push({
      source,
      detail: line.replace(/^(Company summary|Service indicator|Source|Pain point):\s*/i, ""),
    })
  }
  for (const signal of input.personalizationSignals ?? []) {
    if (/strategy version|deterministic|warning/i.test(signal)) continue
    citations.push({ source: "Research findings", detail: signal })
  }
  return citations.slice(0, 12)
}

function problemsFromEvidence(
  evidence: GrowthOutreachEvidenceCitation[],
  equipment: string[],
  sellerPainOutcomes: string[],
): string[] {
  const problems: string[] = []
  if (equipment.length > 0) {
    problems.push(
      `Keeping ${equipment.slice(0, 2).join(" / ")} service operations consistent across sites as demand changes.`,
    )
  }
  if (evidence.some((row) => /hiring|technician|career/i.test(row.detail))) {
    problems.push("Covering skilled service capacity while hiring is still catching up.")
  }
  if (evidence.some((row) => /nationwide|multi.?site|depot|fleet/i.test(row.detail))) {
    problems.push("Coordinating multi-site or depot workflows without losing visibility.")
  }
  if (evidence.some((row) => /pain|downtime|aging|replacement|service opportunity/i.test(row.detail))) {
    problems.push("Reducing downtime and service friction on aging or high-utilization equipment.")
  }
  // Seller-taught outcomes can name problems only when prospect evidence already supports the theme.
  for (const outcome of sellerPainOutcomes.slice(0, 2)) {
    const theme = outcome.replace(/^Help customers resolve:\s*/i, "")
    if (
      theme &&
      evidence.some((row) => row.detail.toLowerCase().includes(theme.toLowerCase().slice(0, 18)))
    ) {
      problems.push(theme)
    }
  }
  return uniqueLines(problems, 4)
}

function pickCta(input: {
  sellerCtas: string[]
  hasPhone: boolean
  hasEmail: boolean
  evidence: GrowthOutreachEvidenceCitation[]
  relationshipStage: GrowthOutreachRelationshipStage
}): string {
  if (input.sellerCtas[0]) return input.sellerCtas[0]
  if (input.relationshipStage === "Engaged" || input.relationshipStage === "Interested") {
    return "Discovery call"
  }
  if (input.evidence.some((row) => /workflow|operations|depot|service/i.test(row.detail))) {
    return "Workflow review"
  }
  if (input.hasPhone) return "15-minute conversation"
  if (input.evidence.some((row) => /industry|imaging|equipment/i.test(row.detail))) {
    return "Industry discussion"
  }
  return "Discovery call"
}

function fallbackObjections(cta: string, problem: string | null): Array<{ objection: string; response: string }> {
  return [
    {
      objection: "We're set with our current process.",
      response:
        "Fair — the goal of a short call is to compare notes, not rip anything out. If nothing is broken, we end quickly.",
    },
    {
      objection: "Not a priority right now.",
      response: `Understood. If ${problem ? problem.toLowerCase() : "service coordination"} becomes noisy later, a ${cta.toLowerCase()} is an easy place to restart.`,
    },
    {
      objection: "Send information first.",
      response:
        "Happy to. A brief note after we align on the real workflow issue is usually more useful than a generic overview.",
    },
  ]
}

/**
 * Build an internal sales strategy brief from Prospect Truth + Seller Truth.
 * Does not invent pain points, initiatives, or technology.
 */
export function buildOutreachSalesStrategyBrief(
  input: BuildSalesStrategyBriefInput,
): GrowthOutreachSalesStrategyBrief {
  const companyName = cleanLine(input.companyName) || "this company"
  const evidence = evidenceFromSignals(input)
  const equipment = uniqueLines(input.equipmentServiced ?? [], 4)
  const dmName = cleanLine(input.contactName)
  const dmTitle = cleanLine(input.contactTitle)

  const sellerTruth =
    input.sellerTruth ??
    buildOutreachSellerTruth({
      profileId: input.approvedProfileId,
      profile: input.approvedProfile,
      sellerCompanyName: input.sellerCompanyName,
      biEnrichmentLines: input.biEnrichmentLines,
      organizationalKnowledge: input.organizationalKnowledge,
      knowledgeCenterLines: input.knowledgeCenterLines,
      industryPlaybook: input.industryPlaybook,
      prospectIndustry: input.industry,
      prospectTitle: input.contactTitle,
    })

  const relationshipStage = deriveOutreachRelationshipStage({
    relationshipStrengthTier: input.relationshipStrengthTier,
    contactTemperature: input.contactTemperature,
    leadStatus: input.leadStatus,
    hasMeetingScheduled: input.hasMeetingScheduled,
    isCustomer: input.isCustomer,
  })

  const businessProblems = problemsFromEvidence(
    evidence,
    equipment,
    sellerTruth.businessOutcomes,
  )

  const confidence = Math.max(
    0.35,
    Math.min(
      0.95,
      input.qualificationConfidence ??
        input.researchConfidence ??
        (evidence.length >= 4 ? 0.72 : evidence.length >= 2 ? 0.58 : 0.45),
    ),
  )

  const primaryEvidence = evidence[0]?.detail
  const secondaryEvidence = evidence[1]?.detail
  const hookParts = [
    equipment[0] ? `${companyName}'s ${equipment[0]} service work` : null,
    primaryEvidence && !equipment[0] ? primaryEvidence.slice(0, 90) : null,
    businessProblems[0]?.replace(/\.$/, "") ?? null,
  ].filter(Boolean)

  const primaryHook =
    hookParts[0] && businessProblems[0]
      ? `${hookParts[0]} is exactly where a short conversation on service visibility usually pays off.`
      : `${companyName} looks like a fit for a focused operations conversation based on the research on file.`

  const recommendedConversation = businessProblems[0]
    ? `How ${companyName} currently handles ${businessProblems[0].replace(/\.$/, "").toLowerCase()}, and where a tighter workflow would help.`
    : sellerTruth.discoveryQuestions[0]
      ? sellerTruth.discoveryQuestions[0]
      : `How ${companyName} prioritizes service operations this quarter, based on what shows up in your public footprint.`

  const whyThisPerson = dmName
    ? `${dmName}${dmTitle ? ` (${dmTitle})` : ""} is the best available decision-maker context for outreach.`
    : "No verified decision maker is on file — keep outreach role-agnostic until a contact is confirmed."

  const responsibilities = uniqueLines(
    [
      dmTitle && /president|ceo|owner|founder/i.test(dmTitle)
        ? "Overall business and service performance"
        : null,
      dmTitle && /ops|operations|service|coo/i.test(dmTitle)
        ? "Day-to-day service operations and capacity"
        : null,
      dmTitle && /director|vp|manager/i.test(dmTitle)
        ? "Team outcomes and process consistency"
        : null,
      equipment.length ? "Equipment service quality and uptime" : null,
      "Vendor and workflow decisions that affect service delivery",
    ],
    4,
  )

  const whyTheyCare = businessProblems[0]
    ? `Those issues sit close to service reliability and cost — areas ${dmName ?? "this contact"} is positioned to care about.`
    : `A short conversation can clarify whether current workflows are already working or creating avoidable friction.`

  const sellerName = sellerTruth.sellerCompanyName || "our team"
  const businessValue =
    sellerTruth.elevatorPitch ||
    sellerTruth.primaryValueProposition ||
    (equipment.length
      ? `${sellerName} helps teams like ${companyName} keep service operations visible and coordinated so ${equipment.slice(0, 2).join(" / ")} work stays on track without adding admin drag.`
      : `${sellerName} helps field-service and equipment teams replace scattered handoffs with a clearer operating rhythm — less chasing, more completed work.`)

  const trustBuilders = uniqueLines(
    [
      input.website ? `Public company footprint reviewed (${input.website})` : null,
      equipment[0] ? `Equipment focus confirmed: ${equipment.join(", ")}` : null,
      dmName ? `Decision-maker context prepared for ${dmName}` : null,
      input.location ? `Location context: ${input.location}` : null,
      secondaryEvidence ? `Supporting research: ${secondaryEvidence.slice(0, 100)}` : null,
      sellerTruth.differentiators[0]
        ? `Seller differentiator on file: ${sellerTruth.differentiators[0]}`
        : null,
      sellerTruth.enrichments.fromKnowledgeCenter[0]
        ? `Supporting knowledge: ${sellerTruth.enrichments.fromKnowledgeCenter[0]}`
        : null,
    ],
    6,
  )

  const cta = pickCta({
    sellerCtas: sellerTruth.ctaPreferences,
    hasPhone: Boolean(input.contactPhone),
    hasEmail: Boolean(input.contactEmail),
    evidence,
    relationshipStage,
  })

  const objections =
    sellerTruth.objections.length > 0
      ? sellerTruth.objections
      : fallbackObjections(cta, businessProblems[0] ?? null)

  const missing = uniqueLines(
    [
      ...(input.missingEvidence ?? []),
      input.contactEmail ? null : "Verified email",
      input.contactPhone ? null : "Verified phone",
      dmName ? null : "Confirmed decision maker",
      equipment.length ? null : "Specific equipment mix",
      input.industry ? null : "Industry classification",
      sellerTruth.source === "fallback_defaults" ? "Approved Business Profile" : null,
      input.employees ? null : null,
      input.revenueEstimate ? null : null,
    ],
    8,
  )

  const executiveSummary = uniqueLines(
    [
      input.opportunitySummary,
      input.fitReason,
      evidence.length
        ? `${companyName} was selected because research turned up concrete service and operations signals — not a generic list match.`
        : `${companyName} was selected for review, but evidence is still thin; keep messaging conservative.`,
      businessProblems[0]
        ? `The clearest opening is how they handle ${businessProblems[0].replace(/\.$/, "").toLowerCase()}.`
        : null,
      sellerTruth.primaryValueProposition
        ? `Seller positioning on file: ${sellerTruth.primaryValueProposition}`
        : null,
    ],
    4,
  ).join(" ")

  const tone =
    sellerTruth.tonePreference?.trim() ||
    (sellerTruth.source === "approved_business_profile" ? "consultative" : "consultative")

  const decisionMakerAnalysis = {
    name: dmName,
    title: dmTitle,
    whyThisPerson,
    likelyResponsibilities: responsibilities,
    whyTheyCare,
  }

  const prospectTruth: GrowthOutreachProspectTruth = {
    companyName,
    evidence,
    businessProblems,
    decisionMaker: {
      name: dmName,
      title: dmTitle,
      whyThisPerson,
      whyTheyCare,
    },
    opportunitySummary: cleanLine(input.opportunitySummary),
    fitReason: cleanLine(input.fitReason),
    assumptions: uniqueLines(input.assumptions ?? [], 6),
    missingEvidence: uniqueLines(input.missingEvidence ?? [], 6),
    relationshipStage,
  }

  const conversationStrategy = buildOutreachConversationStrategy({
    seller: sellerTruth,
    prospect: prospectTruth,
    recommendedConversation,
    primaryHook,
  })

  const sellerKnowledgeQuality = scoreOutreachSellerKnowledgeQuality({
    profile: input.approvedProfile,
    sellerTruth,
    evidence,
    missingEvidence: uniqueLines(input.missingEvidence ?? [], 8),
    contactTitle: input.contactTitle,
    conversationJustification: conversationStrategy.conversationJustification,
    primaryHook,
    confidence,
  })

  const baseBrief = {
    version: GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION,
    leadId: input.leadId,
    companyName,
    preparedAt: input.preparedAt,
    executiveSummary,
    businessProblems,
    evidence,
    decisionMakerAnalysis,
    recommendedConversation,
    primaryHook,
    businessValue,
    trustBuilders,
    objections,
    recommendedCta: cta,
    conversationObjective: recommendedConversation,
    businessObjective:
      conversationStrategy.businessOutcomeThatMatters ||
      `Determine whether ${companyName} has an active service-operations problem worth a deeper working conversation.`,
    conversationJustification: conversationStrategy.conversationJustification,
    relationshipStage,
    tone,
    confidence,
    missingPersonalizationOpportunities: missing,
    sellerTruth,
    prospectTruth,
    conversationStrategy,
    sellerKnowledgeQuality,
  }

  const enriched = enrichOutreachSalesStrategyBrief({
    brief: baseBrief,
    approvedProfile: input.approvedProfile,
    website: input.website,
    contactTitle: input.contactTitle,
    equipmentServiced: equipment,
    industryHint: input.industry,
    prospectKnowledgePack: input.prospectKnowledgePack,
    learningWeights: input.learningWeights,
    relationshipStrengthTier: input.relationshipStrengthTier,
    opportunityReadinessScore: input.opportunityReadinessScore,
    decisionMakers: input.decisionMakers,
    buyingCommitteeSnapshot: input.buyingCommitteeSnapshot,
    communicationChannelHint: input.communicationChannelHint,
  })

  const finalSellerKnowledgeQuality = scoreOutreachSellerKnowledgeQuality({
    profile: input.approvedProfile,
    sellerTruth: enriched.sellerTruth ?? sellerTruth,
    evidence,
    missingEvidence: uniqueLines(input.missingEvidence ?? [], 8),
    contactTitle: input.contactTitle,
    conversationJustification: enriched.conversationJustification,
    primaryHook: enriched.primaryHook,
    confidence: enriched.confidence,
    personaConfidence: enriched.conversationRisk.personaConfidence,
    industryConfidence: enriched.conversationRisk.industryConfidence,
    evidenceSanitized: true,
    conversationIntelligenceApplied: true,
    eliteSdrIntelligenceApplied: Boolean(enriched.evidenceIntelligence.selectedObservation),
    consultantDiscoveryApplied: Boolean(enriched.consultantDiscoveryIntelligence),
    revenueStrategyApplied: Boolean(enriched.revenueStrategyIntelligence),
  })

  return {
    ...baseBrief,
    businessProblems: enriched.businessProblems,
    primaryHook: enriched.primaryHook,
    businessValue: enriched.businessValue,
    trustBuilders: enriched.trustBuilders,
    objections: enriched.objections,
    recommendedCta: enriched.recommendedCta,
    recommendedConversation: enriched.conversationObjective,
    conversationObjective: enriched.conversationObjective,
    businessObjective: enriched.businessObjective,
    conversationJustification: enriched.conversationJustification,
    confidence: enriched.confidence,
    decisionMakerAnalysis: enriched.decisionMakerAnalysis,
    sellerTruth: enriched.sellerTruth,
    conversationStrategy: enriched.conversationStrategy,
    evidenceIntelligence: enriched.evidenceIntelligence,
    conversationRisk: enriched.conversationRisk,
    operatorReasoning: enriched.operatorReasoning,
    consultantDiscoveryIntelligence: enriched.consultantDiscoveryIntelligence,
    revenueStrategyIntelligence: enriched.revenueStrategyIntelligence,
    sellerKnowledgeQuality: finalSellerKnowledgeQuality,
  }
}

const FORBIDDEN_CLICHE_PATTERNS = [
  /hope you(?:'|’)re doing well/i,
  /\bi noticed\b/i,
  /wanted to reach out/i,
  /just checking in/i,
  /circle back/i,
  /synerg/i,
  /leverage our solution/i,
  /cutting-edge/i,
  /game[- ]changer/i,
]

export function assertOutreachCopyQuality(text: string): string[] {
  const failures: string[] = []
  for (const pattern of FORBIDDEN_CLICHE_PATTERNS) {
    if (pattern.test(text)) failures.push(`cliche:${pattern.source}`)
  }
  if (/growth 5f|draft factory|sendr|pilot run|apollo/i.test(text)) {
    failures.push("internal_terminology")
  }
  return failures
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function estimateReadTimeSeconds(text: string): number {
  return Math.max(5, Math.round((countWords(text) / 200) * 60))
}
